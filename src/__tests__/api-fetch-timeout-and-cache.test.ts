/**
 * A request on a dead connection used to hang forever (a save that never finished, a screen
 * whose refetch joined a request that never answered), and a GET could be answered from the
 * HTTP cache. Reads now revalidate, and every request gives up after a deadline.
 */

import { apiFetch, READ_TIMEOUT_MS, WRITE_TIMEOUT_MS } from "../api/api-fetch";

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

function hangingFetch() {
  const seen: { signal?: AbortSignal | null; cache: string | null }[] = [];
  const impl = jest.fn(
    (input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        seen.push({
          signal: init?.signal,
          cache: (input as Request).headers.get("Cache-Control"),
        });
        init?.signal?.addEventListener("abort", () =>
          reject(new Error("aborted")),
        );
      }),
  );
  return { impl: impl as unknown as typeof fetch, seen };
}

it("asks the server to revalidate every read", async () => {
  const ok = jest.fn(async () => new Response("{}"));
  await apiFetch(
    new Request("https://api.test/api/v1/projects"),
    ok as unknown as typeof fetch,
  );
  const sent = (ok.mock.calls[0] as unknown as [Request])[0];
  expect(sent.headers.get("Cache-Control")).toBe("no-cache");
});

it("leaves writes without a cache header", async () => {
  const ok = jest.fn(async () => new Response("{}"));
  await apiFetch(
    new Request("https://api.test/api/v1/projects", { method: "POST" }),
    ok as unknown as typeof fetch,
  );
  const sent = (ok.mock.calls[0] as unknown as [Request])[0];
  expect(sent.headers.get("Cache-Control")).toBeNull();
});

it("gives up on a read that never answers", async () => {
  const { impl } = hangingFetch();
  const pending = apiFetch(new Request("https://api.test/x"), impl);
  const assertion = expect(pending).rejects.toThrow("aborted");
  jest.advanceTimersByTime(READ_TIMEOUT_MS);
  await assertion;
});

it("gives a write longer than a read", async () => {
  const { impl, seen } = hangingFetch();
  const pending = apiFetch(
    new Request("https://api.test/x", { method: "PUT" }),
    impl,
  );
  const assertion = expect(pending).rejects.toThrow("aborted");
  jest.advanceTimersByTime(READ_TIMEOUT_MS);
  expect(seen[0].signal?.aborted).toBe(false);
  jest.advanceTimersByTime(WRITE_TIMEOUT_MS - READ_TIMEOUT_MS);
  await assertion;
  expect(seen[0].signal?.aborted).toBe(true);
});
