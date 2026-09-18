/**
 * Firecrawl URL scraper — extracts clean markdown from a given URL.
 * Free tier: 500 credits/month, more than enough for this project.
 */

interface FirecrawlResponse {
  success: boolean;
  data?: {
    markdown?: string;
    metadata?: {
      title?: string;
      description?: string;
      sourceURL?: string;
    };
  };
  error?: string;
}

interface ScrapeResult {
  success: boolean;
  title: string;
  markdown: string;
  url: string;
  error?: string;
}

/**
 * Maps an HTTP status from the scrape service to something a user can act on.
 * Raw status text and upstream error bodies are never surfaced.
 */
function messageForStatus(status: number): string {
  if (status === 404) return "This page doesn't exist (404). Please check the URL.";
  if (status === 401 || status === 403) {
    return "This page is behind a login or paywall, so we couldn't read it. Try a publicly accessible source.";
  }
  if (status === 408 || status === 504) {
    return "The page took too long to load. Try again or use a different source.";
  }
  if (status === 429) {
    return "We've hit the rate limit for reading pages. Please wait a moment and try again.";
  }
  if (status >= 500) {
    return "The page couldn't be read right now because the service is unavailable. Please try again shortly.";
  }
  return "We couldn't access this URL. Please check it's publicly accessible and try again.";
}

/**
 * Turns a thrown fetch/network error into a user-facing sentence. Error
 * objects and stack traces are deliberately not included.
 */
function messageForNetworkError(err: unknown): string {
  const raw = err instanceof Error ? `${err.message} ${(err as any).cause?.message || ""}` : "";
  const text = raw.toLowerCase();

  if (text.includes("enotfound") || text.includes("eai_again") || text.includes("getaddrinfo")) {
    return "This URL couldn't be reached — please check the address and try again.";
  }
  if (text.includes("timeout") || text.includes("etimedout") || text.includes("abort")) {
    return "The page took too long to load. Try again or use a different source.";
  }
  if (text.includes("econnrefused") || text.includes("econnreset") || text.includes("certificate") || text.includes("tls")) {
    return "We couldn't connect to that site. Please check the address and try again.";
  }
  return "We couldn't access this URL. Please check it's publicly accessible and try again.";
}

export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      title: "",
      markdown: "",
      url,
      error: "Reading source URLs isn't configured yet. Please contact your administrator.",
    };
  }

  try {
    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        timeout: 30000,
      }),
    });

    if (!response.ok) {
      return {
        success: false,
        title: "",
        markdown: "",
        url,
        error: messageForStatus(response.status),
      };
    }

    const data: FirecrawlResponse = await response.json();

    if (!data.success || !data.data?.markdown) {
      return {
        success: false,
        title: "",
        markdown: "",
        url,
        error: "We couldn't read any content from this page. It may be empty, require JavaScript, or be behind a paywall.",
      };
    }

    return {
      success: true,
      title: data.data.metadata?.title || url,
      markdown: data.data.markdown,
      url: data.data.metadata?.sourceURL || url,
    };
  } catch (err) {
    return {
      success: false,
      title: "",
      markdown: "",
      url,
      error: messageForNetworkError(err),
    };
  }
}
