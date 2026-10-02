/**
 * Deterministic economic stress-testing for the points/reward-pool
 * system. Pure functions only — no network, no wall clock, no
 * unseeded randomness — so the same (scenario, populationSize, seed)
 * always produces byte-identical output. This exists purely to
 * *understand* emission behavior (how concentrated does a reward pool
 * get under different participation/farming patterns?) — nothing here
 * tunes the system toward a desired price or outcome.
 *
 * Points are modeled the same way the real pipeline produces them: a
 * wallet's points = (number of real CLOSE_EMPTY_TOKEN_ACCOUNT actions it
 * got verified this epoch) * the registry's base points per action. Bonus
 * tiers are deliberately left out of this model — they're a small,
 * capped addition on top of the base, and including them would add noise
 * without changing the concentration story these scenarios exist to
 * surface.
 */
import { SALVAGE_REGISTRY } from "./registry";
import { simulateEpochRewards } from "./rewardSimulator";

const BASE_POINTS_PER_ACTION = SALVAGE_REGISTRY.EMPTY_TOKEN_ACCOUNT.basePoints ?? 100;

/** Mulberry32 — a small, fast, seedable PRNG. Not cryptographic; good
 * enough (and exactly reproducible) for generating synthetic test
 * populations. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

export type WalletTag = "legit" | "farmer" | "sybil";

export interface SimulatedWallet {
  wallet: string;
  points: number;
  tag: WalletTag;
}

export type ParticipationScenario =
  | "LOW_PARTICIPATION"
  | "NORMAL_PARTICIPATION"
  | "HIGH_PARTICIPATION"
  | "ONE_HEAVY_FARMER"
  | "MANY_SYBIL_WALLETS"
  | "MIXED_LEGIT_AND_FARMING";

export const ALL_SCENARIOS: ParticipationScenario[] = [
  "LOW_PARTICIPATION",
  "NORMAL_PARTICIPATION",
  "HIGH_PARTICIPATION",
  "ONE_HEAVY_FARMER",
  "MANY_SYBIL_WALLETS",
  "MIXED_LEGIT_AND_FARMING",
];

function baseParticipation(rng: () => number, size: number, activeShare: number, minActions: number, maxActions: number): SimulatedWallet[] {
  const wallets: SimulatedWallet[] = [];
  for (let i = 0; i < size; i++) {
    const active = rng() < activeShare;
    const actions = active ? randomInt(rng, minActions, maxActions) : 0;
    wallets.push({ wallet: `w${i}`, points: actions * BASE_POINTS_PER_ACTION, tag: "legit" });
  }
  return wallets;
}

/**
 * Generates one deterministic synthetic wallet population for a given
 * scenario and size. `seed` defaults to a fixed constant so repeated
 * calls with the same (scenario, size) are identical; pass a different
 * seed only to explore variance across multiple independent draws of the
 * same scenario.
 */
export function generateWalletPopulation(scenario: ParticipationScenario, size: number, seed = 1): SimulatedWallet[] {
  const rng = mulberry32(seed + size);

  switch (scenario) {
    case "LOW_PARTICIPATION":
      // Most of the population never actually salvages anything this epoch.
      return baseParticipation(rng, size, 0.05, 1, 1);

    case "NORMAL_PARTICIPATION":
      // A healthy minority participates, doing a handful of real closes.
      return baseParticipation(rng, size, 0.4, 1, 3);

    case "HIGH_PARTICIPATION":
      // Most of the population is actively cleaning up their wallet.
      return baseParticipation(rng, size, 0.85, 1, 8);

    case "ONE_HEAVY_FARMER": {
      const wallets = baseParticipation(rng, size, 0.4, 1, 3);
      // A single wallet (its own, real, distinct token accounts — not
      // necessarily sybil) racks up a disproportionate number of closes.
      wallets[0] = { wallet: wallets[0].wallet, points: 5000 * BASE_POINTS_PER_ACTION, tag: "farmer" };
      return wallets;
    }

    case "MANY_SYBIL_WALLETS": {
      const legitCount = Math.round(size * 0.8);
      const sybilCount = size - legitCount;
      const legit = baseParticipation(rng, legitCount, 0.4, 1, 3);
      const sybil: SimulatedWallet[] = Array.from({ length: sybilCount }, (_, i) => ({
        // Each sybil wallet looks exactly like one ordinary light user
        // (one close each) — only visible as a problem in aggregate.
        wallet: `sybil${i}`,
        points: 1 * BASE_POINTS_PER_ACTION,
        tag: "sybil" as const,
      }));
      return [...legit, ...sybil];
    }

    case "MIXED_LEGIT_AND_FARMING": {
      const farmerCount = Math.max(1, Math.round(size * 0.01));
      const sybilCount = Math.max(1, Math.round(size * 0.1));
      const legitCount = Math.max(0, size - farmerCount - sybilCount);
      const legit = baseParticipation(rng, legitCount, 0.4, 1, 3);
      const farmers: SimulatedWallet[] = Array.from({ length: farmerCount }, (_, i) => ({
        wallet: `farmer${i}`,
        points: randomInt(rng, 200, 600) * BASE_POINTS_PER_ACTION,
        tag: "farmer" as const,
      }));
      const sybils: SimulatedWallet[] = Array.from({ length: sybilCount }, (_, i) => ({
        wallet: `sybil${i}`,
        points: 1 * BASE_POINTS_PER_ACTION,
        tag: "sybil" as const,
      }));
      return [...legit, ...farmers, ...sybils];
    }

    default: {
      const exhaustive: never = scenario;
      throw new Error(`Unknown scenario: ${exhaustive}`);
    }
  }
}

export interface EmissionReport {
  scenario: ParticipationScenario;
  populationSize: number;
  rewardPool: number;
  totalValidPoints: number;
  averagePoints: number;
  medianPoints: number;
  activeWallets: number;
  activeShare: number;
  totalEmissions: number;
  /** Share of rewardPool held by the single largest wallet. */
  topWalletShare: number;
  /** Share of rewardPool held by the 10 largest wallets combined. */
  top10Share: number;
  /** Share of rewardPool held by the top 1% of wallets by points. */
  top1PercentShare: number;
  /** Share of rewardPool collectively held by wallets tagged "sybil". */
  sybilShare: number;
  /** Share of rewardPool collectively held by wallets tagged "farmer". */
  farmerShare: number;
}

/**
 * Runs the real reward-split formula (simulateEpochRewards) against a
 * generated population and reduces the result to the handful of summary
 * statistics useful for understanding emission behavior: how
 * concentrated did the payout get, and in whose hands.
 */
export function runEmissionReport(scenario: ParticipationScenario, populationSize: number, rewardPool: number, seed = 1): EmissionReport {
  const population = generateWalletPopulation(scenario, populationSize, seed);
  const result = simulateEpochRewards(
    rewardPool,
    population.map((w) => ({ wallet: w.wallet, points: w.points }))
  );

  const tagByWallet = new Map(population.map((w) => [w.wallet, w.tag]));
  const pointsSorted = [...population.map((w) => w.points)].sort((a, b) => a - b);
  const mid = Math.floor(pointsSorted.length / 2);
  const medianPoints = pointsSorted.length === 0 ? 0 : pointsSorted.length % 2 === 0 ? (pointsSorted[mid - 1] + pointsSorted[mid]) / 2 : pointsSorted[mid];

  const rewardsSorted = [...result.allocations].sort((a, b) => b.estimatedReward - a.estimatedReward);
  const totalEmissions = result.allocations.reduce((sum, a) => sum + a.estimatedReward, 0);
  const top1PercentCount = Math.max(1, Math.ceil(rewardsSorted.length * 0.01));

  const sumShareFor = (tag: WalletTag) =>
    result.allocations.filter((a) => tagByWallet.get(a.wallet) === tag).reduce((sum, a) => sum + a.estimatedReward, 0);

  return {
    scenario,
    populationSize,
    rewardPool,
    totalValidPoints: result.totalValidPoints,
    averagePoints: population.length === 0 ? 0 : population.reduce((sum, w) => sum + w.points, 0) / population.length,
    medianPoints,
    activeWallets: population.filter((w) => w.points > 0).length,
    activeShare: population.length === 0 ? 0 : population.filter((w) => w.points > 0).length / population.length,
    totalEmissions,
    topWalletShare: totalEmissions > 0 ? (rewardsSorted[0]?.estimatedReward ?? 0) / totalEmissions : 0,
    top10Share: totalEmissions > 0 ? rewardsSorted.slice(0, 10).reduce((sum, a) => sum + a.estimatedReward, 0) / totalEmissions : 0,
    top1PercentShare: totalEmissions > 0 ? rewardsSorted.slice(0, top1PercentCount).reduce((sum, a) => sum + a.estimatedReward, 0) / totalEmissions : 0,
    sybilShare: totalEmissions > 0 ? sumShareFor("sybil") / totalEmissions : 0,
    farmerShare: totalEmissions > 0 ? sumShareFor("farmer") / totalEmissions : 0,
  };
}
