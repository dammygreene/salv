import { describe, expect, it } from "vitest";
import { buildIdempotencyKey } from "./idempotency";

describe("buildIdempotencyKey", () => {
  it("is identical for the same signature, action type, and account", () => {
    const a = buildIdempotencyKey("sig123", "CLOSE_EMPTY_TOKEN_ACCOUNT", "acct1");
    const b = buildIdempotencyKey("sig123", "CLOSE_EMPTY_TOKEN_ACCOUNT", "acct1");
    expect(a).toBe(b);
  });

  it("differs when the signature differs (two separate real transactions)", () => {
    const a = buildIdempotencyKey("sigA", "CLOSE_EMPTY_TOKEN_ACCOUNT", "acct1");
    const b = buildIdempotencyKey("sigB", "CLOSE_EMPTY_TOKEN_ACCOUNT", "acct1");
    expect(a).not.toBe(b);
  });

  it("differs when the target account differs within the same transaction", () => {
    const a = buildIdempotencyKey("sig123", "CLOSE_EMPTY_TOKEN_ACCOUNT", "acct1");
    const b = buildIdempotencyKey("sig123", "CLOSE_EMPTY_TOKEN_ACCOUNT", "acct2");
    expect(a).not.toBe(b);
  });

  it("differs when the action type differs for the same signature and account", () => {
    const a = buildIdempotencyKey("sig123", "CLOSE_EMPTY_TOKEN_ACCOUNT", "acct1");
    const b = buildIdempotencyKey("sig123", "SOME_OTHER_ACTION", "acct1");
    expect(a).not.toBe(b);
  });
});
