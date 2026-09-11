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

// Single-flight refresh: concurrent 401s share one refresh request.
let refreshInFlight: Promise<string | null> | null = null;

export async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const { refreshToken } = await getStoredTokens();
    if (!refreshToken) return null;
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { Authorization: `Bearer ${refreshToken}` },
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { access_token?: string };
    if (!body.access_token) return null;
    await setAccessToken(body.access_token);
    return body.access_token;
  })()
    .catch(() => null)
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

    const newToken = await refreshAccessToken();
    if (!newToken) {
      await clearStoredTokens();
      onSessionExpired?.();
      return undefined;
    }
    retry.headers.set("Authorization", `Bearer ${newToken}`);
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
