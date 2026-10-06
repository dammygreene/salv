// Test-only stand-in for the "server-only" marker package. That package
// unconditionally throws unless resolved under webpack's "react-server"
// export condition, which plain Node/vitest doesn't provide. This stub
// lets server modules that import "server-only" (a real guard against
// accidental client bundling) still be unit tested directly in Node.
export {};
