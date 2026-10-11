import { compareVersions, isBelowMinimum } from "@/lib/app-update/version";

describe("compareVersions", () => {
  it("orders numerically, not as text", () => {
    expect(compareVersions("0.5.9", "0.5.20")).toBeLessThan(0);
    expect(compareVersions("0.10.0", "0.9.9")).toBeGreaterThan(0);
    expect(compareVersions("1.0", "1.0.0")).toBe(0);
  });
});

describe("isBelowMinimum", () => {
  it("blocks only a build strictly below the minimum", () => {
    expect(isBelowMinimum("0.5.19", "0.5.20")).toBe(true);
    expect(isBelowMinimum("0.5.20", "0.5.20")).toBe(false);
    expect(isBelowMinimum("0.6.0", "0.5.20")).toBe(false);
  });
  it("never blocks without a minimum or without a known own version", () => {
    expect(isBelowMinimum("0.1.0", "")).toBe(false);
    expect(isBelowMinimum(undefined, "0.5.20")).toBe(false);
  });
});
