/**
 * The idempotency key that identifies a single cull action. Must be
 * built from facts that can never change for a given real transaction:
 * the signature (immutable once confirmed) plus the action type and the
 * specific account it targeted. Same signature + same account + same
 * action type => same key => the backend will only ever record it once,
 * no matter how many times verification is requested (including across
 * page refreshes).
 */
export function buildIdempotencyKey(signature: string, actionType: string, tokenAccount: string): string {
  return `${signature}:${actionType}:${tokenAccount}`;
}
