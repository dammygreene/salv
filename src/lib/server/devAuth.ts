import "server-only";
import { NextRequest } from "next/server";

/**
 * Minimal shared-secret gate for the dev-only epoch admin endpoints.
 * DEV_ADMIN_SECRET must never be NEXT_PUBLIC_ (it's read here, inside a
 * `server-only` module, never shipped to the client). If it isn't
 * configured at all, every request is refused — there is no "open by
 * default" mode. This is intentionally simple: a real deployment should
 * replace it with proper authenticated admin tooling before public
 * launch; it exists only so epochs can be created/closed for testing
 * without exposing that to end users.
 */
export class DevAuthError extends Error {}

export function assertDevAuthorized(req: NextRequest): void {
  const secret = process.env.DEV_ADMIN_SECRET?.trim();
  if (!secret) {
    throw new DevAuthError("DEV_ADMIN_SECRET is not configured on the server; refusing all dev-admin requests.");
  }
  const provided = req.headers.get("x-dev-admin-secret");
  if (provided !== secret) {
    throw new DevAuthError("Invalid or missing x-dev-admin-secret header.");
  }
}
