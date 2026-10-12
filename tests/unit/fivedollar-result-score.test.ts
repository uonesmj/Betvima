import { describe, expect, it } from "vitest";
import { score } from "@/providers/5dollar-football-api";

describe("5Dollar result score safety", () => {
  it("does not interpret missing or empty scores as a finished 0-0 result", () => {
    expect(score({}, "home")).toBeNull();
    expect(score({ goals: null }, "home")).toBeNull();
    expect(score({ goals: { home: null, away: undefined } }, "home")).toBeNull();
    expect(score({ goals: { home: "", away: "  " } }, "home")).toBeNull();
    expect(score({ goals: { home: "", away: "  " } }, "away")).toBeNull();
    expect(score({ goals: { home: "NaN" } }, "home")).toBeNull();
    expect(score({ goals: { home: -1 } }, "home")).toBeNull();
    expect(score({ goals: { home: 1.5 } }, "home")).toBeNull();
    expect(score({ goals: { home: true } }, "home")).toBeNull();
  });

  it("accepts explicit non-negative whole-number provider scores, including 0-0", () => {
    expect(score({ goals: { home: 0, away: "0" } }, "home")).toBe(0);
    expect(score({ goals: { home: 0, away: "0" } }, "away")).toBe(0);
    expect(score({ goals: { home: 2, away: "3" } }, "away")).toBe(3);
  });
});
