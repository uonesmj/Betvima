import { describe, expect, it } from "vitest";
import { extendedRefreshBudget, PREMATCH_REFRESH_LIMITS } from "@/workers/odds-refresh-budget";

describe("bounded odds refresh", () => {
  it("keeps the awaited bulk tick within a small fixed selection budget", () => {
    const b = PREMATCH_REFRESH_LIMITS;
    expect(b.near + b.mid + b.far).toBe(b.maxPerCoreTick);
    expect(b.near).toBeGreaterThan(b.mid);
    expect(b.mid).toBeGreaterThan(b.far);
    expect(b.maxPerCoreTick).toBeLessThanOrEqual(50);
  });

  it("caps concurrently detached extended fixture batches", () => {
    expect(extendedRefreshBudget(undefined)).toBe(40);
    expect(extendedRefreshBudget("500")).toBe(80);
    expect(extendedRefreshBudget("-5")).toBe(1);
    expect(extendedRefreshBudget("invalid")).toBe(40);
    expect(extendedRefreshBudget("12")).toBe(12);
  });
});
