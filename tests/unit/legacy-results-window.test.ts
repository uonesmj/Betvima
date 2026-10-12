import { describe, expect, it } from "vitest";
import { selectLegacyResultWindow } from "@/workers/legacy-results-window";

const candidates = [
  { provider_id: "old-1", scheduled_at: "2026-10-09T12:00:00Z" },
  { provider_id: "new-1", scheduled_at: "2026-10-12T23:59:59Z" },
  { provider_id: "new-2", scheduled_at: "2026-10-12T00:01:00Z" },
  { provider_id: "old-2", scheduled_at: "2026-10-09T21:30:00Z" },
];

describe("legacy FiveDollar result lookups", () => {
  it("queries one UTC day at a time and rotates through unsettled match days", () => {
    const newest = selectLegacyResultWindow(candidates, 0);
    expect(newest).toMatchObject({
      day: "2026-10-12",
      from: "2026-10-12T00:00:00.000Z",
      to: "2026-10-13T00:00:00.000Z",
      daysInBacklog: 2,
    });
    expect(newest?.matches.map((x) => x.provider_id)).toEqual(["new-1", "new-2"]);

    const oldest = selectLegacyResultWindow(candidates, 1);
    expect(oldest?.day).toBe("2026-10-09");
    expect(oldest?.matches.map((x) => x.provider_id)).toEqual(["old-1", "old-2"]);
    expect(selectLegacyResultWindow(candidates, 2)?.day).toBe("2026-10-12");
  });

  it("excludes invalid rows and keeps the provider-request batch bounded", () => {
    const many = Array.from({ length: 100 }, (_, i) => ({
      provider_id: `existing-${i}`,
      scheduled_at: "2026-10-01T10:00:00Z",
    }));
    const result = selectLegacyResultWindow([
      { provider_id: null, scheduled_at: "2026-10-02T01:00:00Z" },
      { provider_id: "bad", scheduled_at: "not-a-date" },
      ...many,
    ], 0);
    expect(result?.matches).toHaveLength(50);
    expect(result?.daysInBacklog).toBe(1);
    expect(result?.matches.every((x) => x.provider_id?.startsWith("existing-"))).toBe(true);
    expect(selectLegacyResultWindow([], 0)).toBeNull();
  });

  it("does not include another day's fixtures even when the days are adjacent", () => {
    const result = selectLegacyResultWindow(candidates, 0);
    expect(result?.matches.some((x) => x.provider_id === "old-1")).toBe(false);
    expect(result?.to).toBe("2026-10-13T00:00:00.000Z");
  });
});
