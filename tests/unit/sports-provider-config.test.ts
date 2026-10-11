import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("Odds API configuration isolation", () => {
  async function healthUrl(provider: string, dedicatedUrl = "", dedicatedKey = "test-odds-key") {
    vi.resetModules();
    vi.stubEnv("SPORTS_PROVIDER", provider);
    vi.stubEnv("SPORTS_PROVIDER_BASE_URL", "https://legacy.example.test");
    vi.stubEnv("SPORTS_PROVIDER_API_KEY", "test-legacy-key");
    vi.stubEnv("ODDS_API_BASE_URL", dedicatedUrl);
    vi.stubEnv("ODDS_API_KEY", dedicatedKey);
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response("[]", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { TheOddsApiSportsProvider } = await import("@/providers/the-odds-api");
    const health = await new TheOddsApiSportsProvider().health();
    return { health, fetchMock };
  }

  it("does not use FiveDollar's legacy URL for Odds requests", async () => {
    const { health, fetchMock } = await healthUrl("5dollarfootballapi");
    expect(health.reachable).toBe(true);
    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(url.origin).toBe("https://api.the-odds-api.com");
    expect(url.searchParams.get("apiKey")).toBe("test-odds-key");
  });

  it("preserves the legacy URL and key for the Odds provider", async () => {
    const { fetchMock } = await healthUrl("the_odds_api", "", "");
    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(url.origin).toBe("https://legacy.example.test");
    expect(url.searchParams.get("apiKey")).toBe("test-legacy-key");
  });

  it("prioritizes the dedicated Odds URL and key", async () => {
    const { fetchMock } = await healthUrl("5dollarfootballapi", "https://odds.example.test");
    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(url.origin).toBe("https://odds.example.test");
    expect(url.searchParams.get("apiKey")).toBe("test-odds-key");
  });

  it("does not use FiveDollar's key when the Odds key is missing", async () => {
    const { health, fetchMock } = await healthUrl("5dollarfootballapi", "", "");
    expect(health.configured).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
