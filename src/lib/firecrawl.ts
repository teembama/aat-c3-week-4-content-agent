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

export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      title: "",
      markdown: "",
      url,
      error: "FIRECRAWL_API_KEY is not set. Add it to .env.local.",
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
      const errText = await response.text().catch(() => "unknown error");
      return {
        success: false,
        title: "",
        markdown: "",
        url,
        error: `Firecrawl returned ${response.status}: ${errText.slice(0, 200)}`,
      };
    }

    const data: FirecrawlResponse = await response.json();

    if (!data.success || !data.data?.markdown) {
      return {
        success: false,
        title: "",
        markdown: "",
        url,
        error: data.error || "Firecrawl returned no content",
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
      error: `Failed to scrape URL: ${err instanceof Error ? err.message : "unknown error"}`,
    };
  }
}
