export function shortenAddress(address: string, lead = 5, tail = 4): string {
  if (address.length <= lead + tail + 3) return address;
  return `${address.slice(0, lead)}...${address.slice(-tail)}`;
}

export function lamportsToSol(lamports: number): number {
  return lamports / 1_000_000_000;
}

/** Converts a unix seconds timestamp into the short relative-age labels
 * used across the UI ("2y 4m", "11m", "6d", ...). */
export function formatRecency(blockTimeSeconds: number | null): string {
  if (blockTimeSeconds === null) return "\u2014";
  const diffSeconds = Date.now() / 1000 - blockTimeSeconds;
  if (diffSeconds < 0) return "\u2014";

  const days = diffSeconds / 86400;
  if (days < 1) return "Today";
  if (days < 30) return `${Math.max(1, Math.floor(days))}d`;

  const months = days / 30.44;
  if (months < 12) return `${Math.max(1, Math.floor(months))}m`;

  const years = Math.floor(months / 12);
  const remainingMonths = Math.floor(months % 12);
  return remainingMonths > 0 ? `${years}y ${remainingMonths}m` : `${years}y`;
}

/** Runs `fn` over `items` with at most `limit` in flight at once. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await fn(items[index], index);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}
