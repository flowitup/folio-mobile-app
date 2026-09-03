import { clearStoredTokens, getStoredTokens } from "@/auth/token-storage";
import { API_BASE_URL } from "@/config/env";

import { notifySessionExpired, refreshAccessToken } from "./client";

function isApiOrigin(url: string): boolean {
  try {
    return new URL(url).origin === new URL(API_BASE_URL).origin;
  } catch {
    return false;
  }
}

/**
 * `fetch` for raw uploads/downloads that openapi-fetch cannot express.
 * Attaches the Bearer token only to requests aimed at the Folio API origin
 * (never to presigned storage or third-party URLs) and retries once after a
 * token refresh on 401, mirroring the client middleware.
 */
export async function authedFetch(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  if (!isApiOrigin(url)) return fetch(url, init);

  const send = async (token: string | null) => {
    const headers = new Headers(init.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(url, { ...init, headers });
  };

  const { accessToken } = await getStoredTokens();
  const first = await send(accessToken);
  if (first.status !== 401) return first;

  const refreshed = await refreshAccessToken();
  if (!refreshed) {
    await clearStoredTokens();
    notifySessionExpired();
    return first;
  }
  return send(refreshed);
}
