/**
 * Only a refused refresh token ends the session. A 429 or a 5xx from /auth/refresh (a deploy,
 * a proxy, many users behind one office NAT) or no network at all used to read the same as
 * "rejected": the client wiped the never-expiring refresh token and sent the user back to SMS
 * sign-in, although the session was still good.
 */

import * as SecureStore from "expo-secure-store";

import type * as ClientModule from "../api/client";
import type * as AuthedFetchModule from "../api/authed-fetch";
import { API_BASE_URL } from "../config/env";

jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(
      async (key: string, value: string) => void store.set(key, value),
    ),
    deleteItemAsync: jest.fn(async (key: string) => void store.delete(key)),
  };
});

type Refresh = number | "offline";
let refresh: Refresh = 200;
const fetched: { url: string; auth: string | null }[] = [];

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// openapi-fetch captures `globalThis.fetch` when the client is created: install the fake first.
globalThis.fetch = jest.fn(
  async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : null;
    const url = request ? request.url : String(input);
    const auth = (request?.headers ?? new Headers(init?.headers)).get(
      "Authorization",
    );
    fetched.push({ url, auth });
    if (url.endsWith("/api/v1/auth/refresh")) {
      if (refresh === "offline") throw new TypeError("Network request failed");
      return refresh === 200
        ? json(200, { access_token: "access-2" })
        : json(refresh, { error: "Refused" });
    }
    return auth === "Bearer access-2"
      ? json(200, { ok: true })
      : json(401, { error: "TokenExpired" });
  },
) as unknown as typeof fetch;

/* eslint-disable @typescript-eslint/no-require-imports */
const { api, setSessionExpiredHandler } =
  require("../api/client") as typeof ClientModule;
const { authedFetch } =
  require("../api/authed-fetch") as typeof AuthedFetchModule;
/* eslint-enable @typescript-eslint/no-require-imports */

const onExpired = jest.fn();

beforeEach(async () => {
  fetched.length = 0;
  onExpired.mockClear();
  setSessionExpiredHandler(onExpired);
  await SecureStore.setItemAsync("folio.access_token", "access-1");
  await SecureStore.setItemAsync("folio.refresh_token", "refresh-1");
});

const refreshToken = () => SecureStore.getItemAsync("folio.refresh_token");
const PHOTOS_URL = `${API_BASE_URL}/api/v1/projects/p1/photos`;

describe("API client: refresh failures", () => {
  // 403/404: a proxy or WAF answering during a deploy, not the API judging the token.
  it.each<Refresh>([403, 404, 429, 502, 503, "offline"])(
    "keeps the session when /auth/refresh answers %s",
    async (outcome) => {
      refresh = outcome;
      const { response } = await api.GET("/api/v1/projects");

      expect(fetched.some((c) => c.url.endsWith("/auth/refresh"))).toBe(true);
      expect(response.status).toBe(401);
      expect(await refreshToken()).toBe("refresh-1");
      expect(onExpired).not.toHaveBeenCalled();
    },
  );

  it.each<Refresh>([401, 422])(
    "signs out when /auth/refresh refuses the token (%s)",
    async (outcome) => {
      refresh = outcome;
      await api.GET("/api/v1/projects");

      expect(await refreshToken()).toBeNull();
      expect(onExpired).toHaveBeenCalledTimes(1);
    },
  );

  it("retries with the fresh token when the refresh works", async () => {
    refresh = 200;
    const { data } = await api.GET("/api/v1/projects");

    expect(data).toEqual({ ok: true });
    expect(onExpired).not.toHaveBeenCalled();
  });
});

describe("authedFetch: refresh failures", () => {
  it.each<Refresh>([429, 503, "offline"])(
    "keeps the session when /auth/refresh answers %s",
    async (outcome) => {
      refresh = outcome;
      const response = await authedFetch(PHOTOS_URL);

      expect(response.status).toBe(401);
      expect(await refreshToken()).toBe("refresh-1");
      expect(onExpired).not.toHaveBeenCalled();
    },
  );

  it("signs out when /auth/refresh refuses the token", async () => {
    refresh = 401;
    await authedFetch(PHOTOS_URL);

    expect(await refreshToken()).toBeNull();
    expect(onExpired).toHaveBeenCalledTimes(1);
  });
});
