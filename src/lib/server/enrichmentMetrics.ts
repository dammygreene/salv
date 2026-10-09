import "server-only";

export type EnrichmentProvider = "QUICKNODE" | "JUPITER" | "OPENSEA" | "MAGIC_EDEN";

export type EnrichmentMetrics = {
  QUICKNODE: number;
  JUPITER: number;
  OPENSEA: number;
  MAGIC_EDEN: number;
  knowledge_hits: number;
  knowledge_misses: number;
  fresh_hits: number;
  stale_records: number;
  deferred_hits: number;
  unsupported_hits: number;
  provider_unavailable_hits: number;
  records_created: number;
  records_updated: number;
  provider_requests_avoided: number;
  database_operations: number;
  phase_timings_ms: Record<string, number>;
};
type KnowledgeMetric = "knowledge_hits" | "knowledge_misses" | "fresh_hits" | "stale_records" |
  "deferred_hits" | "unsupported_hits" | "provider_unavailable_hits" | "records_created" | "records_updated";

let metrics: EnrichmentMetrics = emptyMetrics();

function emptyMetrics(): EnrichmentMetrics {
  return {
    QUICKNODE: 0, JUPITER: 0, OPENSEA: 0, MAGIC_EDEN: 0,
    knowledge_hits: 0, knowledge_misses: 0, fresh_hits: 0, stale_records: 0,
    deferred_hits: 0, unsupported_hits: 0, provider_unavailable_hits: 0,
    records_created: 0, records_updated: 0, provider_requests_avoided: 0,
    database_operations: 0, phase_timings_ms: {},
  };
}

export function resetEnrichmentMetrics(): void {
  metrics = emptyMetrics();
}

export function countEnrichmentRequest(provider: EnrichmentProvider): void {
  metrics[provider] += 1;
}

export function getEnrichmentMetrics(): EnrichmentMetrics {
  return { ...metrics };
}

export function recordKnowledgeMetric(metric: KnowledgeMetric): void {
  metrics[metric] += 1;
}

export function recordProviderRequestsAvoided(count: number): void {
  metrics.provider_requests_avoided += count;
}

export function recordDatabaseOperation(): void {
  metrics.database_operations += 1;
}

export function recordPhaseTiming(name: string, durationMs: number): void {
  metrics.phase_timings_ms[name] = Math.round(durationMs);
}
