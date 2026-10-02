import { describe, expect, it } from "vitest";
import { generateWalletPopulation, runEmissionReport } from "./economicSimulation";

describe("generateWalletPopulation", () => {
  it("is deterministic for a given scenario/size/seed", () => {
    const a = generateWalletPopulation("NORMAL_PARTICIPATION", 500);
    const b = generateWalletPopulation("NORMAL_PARTICIPATION", 500);
    expect(a).toEqual(b);
  });

  it("produces exactly the requested population size for plain participation scenarios", () => {
    const wallets = generateWalletPopulation("HIGH_PARTICIPATION", 1234);
    expect(wallets).toHaveLength(1234);
  });

  it("ONE_HEAVY_FARMER scenario produces a single, clearly dominant wallet", () => {
    const wallets = generateWalletPopulation("ONE_HEAVY_FARMER", 1000);
    const farmer = wallets.find((w) => w.tag === "farmer")!;
    const everyoneElse = wallets.filter((w) => w.tag !== "farmer").reduce((sum, w) => sum + w.points, 0);
    expect(farmer.points).toBeGreaterThan(everyoneElse);
  });

  it("MANY_SYBIL_WALLETS scenario tags a real cluster of sybil wallets separate from legit ones", () => {
    const wallets = generateWalletPopulation("MANY_SYBIL_WALLETS", 1000);
    const sybils = wallets.filter((w) => w.tag === "sybil");
    expect(sybils.length).toBeGreaterThan(0);
    expect(sybils.every((w) => w.points > 0)).toBe(true);
  });
});

describe("runEmissionReport", () => {
  it("total emissions never exceed the reward pool, across every scenario and a range of population sizes", () => {
    const scenarios = ["LOW_PARTICIPATION", "NORMAL_PARTICIPATION", "HIGH_PARTICIPATION", "ONE_HEAVY_FARMER", "MANY_SYBIL_WALLETS", "MIXED_LEGIT_AND_FARMING"] as const;
    for (const scenario of scenarios) {
      for (const size of [100, 1_000]) {
        const report = runEmissionReport(scenario, size, 1_000_000);
        expect(report.totalEmissions).toBeLessThanOrEqual(1_000_000 + 1e-6);
      }
    }
  });

  it("ONE_HEAVY_FARMER concentrates most of the pool in the top wallet", () => {
    const report = runEmissionReport("ONE_HEAVY_FARMER", 1000, 1_000_000);
    expect(report.topWalletShare).toBeGreaterThan(0.8);
  });

  it("LOW_PARTICIPATION has a much lower active share than HIGH_PARTICIPATION at the same size", () => {
    const low = runEmissionReport("LOW_PARTICIPATION", 2000, 1_000_000);
    const high = runEmissionReport("HIGH_PARTICIPATION", 2000, 1_000_000);
    expect(low.activeShare).toBeLessThan(high.activeShare);
  });

  it("is deterministic end to end", () => {
    const r1 = runEmissionReport("MIXED_LEGIT_AND_FARMING", 5000, 1_000_000);
    const r2 = runEmissionReport("MIXED_LEGIT_AND_FARMING", 5000, 1_000_000);
    expect(r1).toEqual(r2);
  });

  it("scales to a large (100,000-wallet) population without numeric blowup or exceeding the pool", () => {
    const report = runEmissionReport("MIXED_LEGIT_AND_FARMING", 100_000, 1_000_000);
    expect(report.populationSize).toBe(100_000);
    expect(report.totalEmissions).toBeLessThanOrEqual(1_000_000 + 1e-6);
    expect(report.sybilShare).toBeGreaterThan(0);
  }, 10_000);
});
