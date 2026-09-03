import * as SecureStore from "expo-secure-store";

import { authedFetch } from "../api/authed-fetch";
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

type Call = { url: string; auth: string | null };

function mockFetch(responder: (call: Call, index: number) => Response) {
  const calls: Call[] = [];
  globalThis.fetch = jest.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const auth = new Headers(init?.headers).get("Authorization");
      const call = { url, auth };
      calls.push(call);
      return responder(call, calls.length - 1);
    },
  ) as unknown as typeof fetch;
  return calls;
}

describe("authedFetch", () => {
  beforeEach(async () => {
    await SecureStore.setItemAsync("folio.access_token", "access-1");
    await SecureStore.setItemAsync("folio.refresh_token", "refresh-1");
  });

  it("sends the Bearer token to the API origin only", async () => {
    const calls = mockFetch(() => new Response("{}", { status: 200 }));
    await authedFetch(`${API_BASE_URL}/api/v1/projects`);
    await authedFetch("https://storage.example.net/bucket/key?sig=1");
    expect(calls[0].auth).toBe("Bearer access-1");
    expect(calls[1].auth).toBeNull();
  });

  it("refreshes once and retries on 401", async () => {
    const calls = mockFetch((call, index) => {
      if (call.url.endsWith("/auth/refresh"))
        return new Response(JSON.stringify({ access_token: "access-2" }), {
          status: 200,
        });
      return new Response("{}", { status: index === 0 ? 401 : 200 });
    });
    const response = await authedFetch(`${API_BASE_URL}/api/v1/projects`);
    expect(response.status).toBe(200);
    expect(calls.map((c) => c.auth)).toEqual([
      "Bearer access-1",
      "Bearer refresh-1",
      "Bearer access-2",
    ]);
    expect(await SecureStore.getItemAsync("folio.access_token")).toBe(
      "access-2",
    );
  });
});
