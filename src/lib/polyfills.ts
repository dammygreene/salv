// Defensive Buffer polyfill for the browser. Modern @solana/web3.js
// imports `buffer` explicitly rather than relying on a bundler-provided
// global, but some transitive wallet-adapter dependencies still expect
// `window.Buffer` to exist. Safe no-op on the server and in any
// environment that already has it.
import { Buffer } from "buffer";

if (typeof window !== "undefined" && !window.Buffer) {
  window.Buffer = Buffer;
}
