import createClient, { type Middleware } from "openapi-fetch";

import { API_BASE_URL } from "@/config/env";
import {
  clearStoredTokens,
  getStoredTokens,
  setAccessToken,
} from "@/auth/token-storage";

import type { paths } from "./generated/schema";

// Endpoints that carry their own credentials — an SMS code, a refresh token or
// an invitation token. Never attach a Bearer token to them, and never treat
// their 401 as an expired session: a wrong SMS code answers 401, and running
// that through the refresh-or-sign-out path would clear a perfectly good
// session because someone mistyped a digit.
const AUTH_PATHS = [
  "/api/v1/auth/otp/request",
  "/api/v1/auth/otp/verify",
  "/api/v1/auth/signup/request",
  "/api/v1/auth/signup/verify",
  "/api/v1/auth/refresh",
  "/api/v1/invitations/accept",
];

/**
 * Whether `url` is one of those endpoints. Exported for the test that pins the
 * list: getting it wrong is silent — sign-in keeps working, and the damage
 * only shows when someone mistypes a code while holding a valid session.
 */
export function isAuthPath(url: string): boolean {
  return AUTH_PATHS.some((path) => url.includes(path));
}

/** Called when the refresh token is rejected; the auth provider signs the user out. */
let onSessionExpired: (() => void) | null = null;
/** Invoked by raw-fetch helpers when a refresh fails. */
export function notifySessionExpired(): void {
  onSessionExpired?.();
}
export function setSessionExpiredHandler(handler: (() => void) | null): void {
  onSessionExpired = handler;
}

/**
 * What a refresh attempt established. `"rejected"`: the refresh token is gone or the server
 * refused it, so the session is over. `"unavailable"`: nothing was decided about the token —
 * offline, a rate limit, a 5xx (a deploy, a proxy) — and the stored session must survive for
 * the next attempt instead of sending the user back to SMS sign-in.
 */
export type RefreshOutcome =
  { accessToken: string } | "rejected" | "unavailable";

/**
 * The only answers /auth/refresh gives about the token itself (flask-jwt-extended: revoked,
 * expired, invalid or malformed). Anything else — a 429, a 5xx, a proxy's or WAF's 403/404
 * during a deploy — says nothing about it.
 */
function isRefusedStatus(status: number): boolean {
  return status === 401 || status === 422;
}

// Single-flight refresh: concurrent 401s share one refresh request.
let refreshInFlight: Promise<RefreshOutcome> | null = null;

export async function refreshAccessToken(): Promise<RefreshOutcome> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async (): Promise<RefreshOutcome> => {
    const { refreshToken } = await getStoredTokens();
    if (!refreshToken) return "rejected";
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { Authorization: `Bearer ${refreshToken}` },
    });
    if (!response.ok)
      return isRefusedStatus(response.status) ? "rejected" : "unavailable";
    const body = (await response.json()) as { access_token?: string };
    if (!body.access_token) return "unavailable";
    await setAccessToken(body.access_token);
    return { accessToken: body.access_token };
  })()
    // A network error, or a body that is not the API's (a captive portal page).
    .catch((): RefreshOutcome => "unavailable")
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

// Request clones captured before sending so a 401 can be retried with a fresh token.
const retryableRequests = new Map<string, Request>();

const authMiddleware: Middleware = {
  async onRequest({ request, id }) {
    if (isAuthPath(request.url)) return request;
    const { accessToken } = await getStoredTokens();
    if (accessToken)
      request.headers.set("Authorization", `Bearer ${accessToken}`);
    retryableRequests.set(id, request.clone());
    return request;
  },
  async onResponse({ response, request, id }) {
    const retry = retryableRequests.get(id);
    retryableRequests.delete(id);
    // Returning undefined leaves the response untouched (RN's fetch Response may not be the global class).
    if (response.status !== 401 || isAuthPath(request.url) || !retry)
      return undefined;

    const refreshed = await refreshAccessToken();
    // Server unreachable: keep the session and hand back the 401, which the caller can retry.
    if (refreshed === "unavailable") return undefined;
    if (refreshed === "rejected") {
      await clearStoredTokens();
      onSessionExpired?.();
      return undefined;
    }
    retry.headers.set("Authorization", `Bearer ${refreshed.accessToken}`);
    const retried = await fetch(retry);
    // openapi-fetch requires a global Response instance when the response is replaced.
    return new Response(await retried.arrayBuffer(), {
      status: retried.status,
      statusText: retried.statusText,
      headers: retried.headers,
    });
  },
  onError({ id }) {
    retryableRequests.delete(id);
  },
};

/** Typed Folio API client. Paths and schemas come from the generated OpenAPI types. */
export const api = createClient<paths>({ baseUrl: API_BASE_URL });
api.use(authMiddleware);
