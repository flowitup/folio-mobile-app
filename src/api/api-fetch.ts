/** A read that has not answered after this long is a dead connection, not a slow server. */
export const READ_TIMEOUT_MS = 30_000;
/** Writes get longer: a photo or a PDF goes through them over a mobile connection. */
export const WRITE_TIMEOUT_MS = 120_000;

/**
 * `fetch` for the typed API client. Two things the platform does not do for us:
 *
 * - It never gives up. A request on a connection that died (a phone changing network, a
 *   suspended socket) hangs forever: a hung save never reaches its `onSuccess`, and a hung
 *   read keeps the old data on screen while every later refetch joins it. A timeout turns
 *   that into an error the user can retry.
 * - It may answer a read from the HTTP cache. `no-cache` makes every GET revalidate with the
 *   server, so a screen never shows a response that predates a write.
 */
export function apiFetch(
  request: Request,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  const isRead = request.method === "GET" || request.method === "HEAD";
  if (isRead) request.headers.set("Cache-Control", "no-cache");

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    isRead ? READ_TIMEOUT_MS : WRITE_TIMEOUT_MS,
  );
  const upstream = request.signal;
  if (upstream) {
    if (upstream.aborted) controller.abort();
    else
      upstream.addEventListener("abort", () => controller.abort(), {
        once: true,
      });
  }
  return fetchImpl(request, { signal: controller.signal }).finally(() =>
    clearTimeout(timer),
  );
}
