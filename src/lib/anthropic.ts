import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set.");
    client = new Anthropic({ apiKey, timeout: 120_000 });
  }
  return client;
}

// ── Cost tracking ──
// Sonnet 4.5: $3/M input, $15/M output (approximate)
const INPUT_COST_PER_TOKEN = 3 / 1_000_000;
const OUTPUT_COST_PER_TOKEN = 15 / 1_000_000;

export interface CostEntry {
  stage: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  model: string;
}

/**
 * Pull a JSON object/array out of a model response that may include
 * leading/trailing prose and/or a ```json code fence anywhere in the text
 * (not just at the very start/end) — Claude doesn't always follow
 * "return ONLY JSON" literally, especially after using tools like web search.
 */
export function extractJson(raw: string): string {
  const text = raw.trim();
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) return fenceMatch[1].trim();

  const firstBracket = text.search(/[[{]/);
  if (firstBracket === -1) return text;
  const lastBracket = Math.max(text.lastIndexOf("]"), text.lastIndexOf("}"));
  if (lastBracket > firstBracket) return text.slice(firstBracket, lastBracket + 1);
  return text;
}

/**
 * Call Claude with structured JSON output.
 * Tracks cost per call.
 */
export async function callClaude<T>(
  systemPrompt: string,
  userMessage: string,
  options?: { maxTokens?: number; stage?: string }
): Promise<{ result: T; cost: CostEntry }> {
  const anthropic = getAnthropicClient();
  const stage = options?.stage ?? "unknown";

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: options?.maxTokens ?? 4096,
    messages: [{ role: "user", content: userMessage }],
    system: systemPrompt,
  });

  const cost: CostEntry = {
    stage,
    input_tokens: response.usage?.input_tokens ?? 0,
    output_tokens: response.usage?.output_tokens ?? 0,
    cost_usd:
      (response.usage?.input_tokens ?? 0) * INPUT_COST_PER_TOKEN +
      (response.usage?.output_tokens ?? 0) * OUTPUT_COST_PER_TOKEN,
    model: "claude-sonnet-4-5-20250929",
  };

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text content");
  }

  const raw = extractJson(textBlock.text);

  try {
    return { result: JSON.parse(raw) as T, cost };
  } catch {
    throw new Error(`Invalid JSON from Claude. First 300 chars: ${raw.slice(0, 300)}`);
  }
}

/**
 * Call Claude with web search for topic research.
 */
export async function callClaudeWithSearch(
  systemPrompt: string,
  userMessage: string
): Promise<{ text: string; citations: Array<{ url: string; title: string }>; cost: CostEntry }> {
  const anthropic = getAnthropicClient();

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 8192,
    messages: [{ role: "user", content: userMessage }],
    system: systemPrompt,
    // web_search_20250305 is valid server-side; SDK types lag
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }] as any,
  });

  const cost: CostEntry = {
    stage: "research_web_search",
    input_tokens: response.usage?.input_tokens ?? 0,
    output_tokens: response.usage?.output_tokens ?? 0,
    cost_usd:
      (response.usage?.input_tokens ?? 0) * INPUT_COST_PER_TOKEN +
      (response.usage?.output_tokens ?? 0) * OUTPUT_COST_PER_TOKEN,
    model: "claude-sonnet-4-5-20250929",
  };

  const textBlocks = response.content.filter((b) => b.type === "text");
  const text = textBlocks.map((b) => (b.type === "text" ? b.text : "")).join("\n");

  const citations: Array<{ url: string; title: string }> = [];
  for (const block of response.content) {
    // @ts-ignore
    if (block.type === "web_search_tool_result" && "content" in block) {
      for (const result of (block as any).content) {
        if (result.type === "web_search_result" && result.url) {
          citations.push({ url: result.url, title: result.title || result.url });
        }
      }
    }
  }

  return { text, citations, cost };
}
