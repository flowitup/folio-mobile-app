import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import { authedFetch } from "@/api/authed-fetch";
import { API_BASE_URL } from "@/config/env";
import { ApiError } from "@/lib/query/api-error";

/** Keeps only a safe basename so a server-supplied name cannot escape the cache directory. */
export function safeFilename(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .replace(/^\.+/, "")
    .replace(/[^\w.\-()À-ɏ ]+/g, "_")
    .trim();
  return cleaned || "download";
}

/** Reads an authenticated API resource; a non-2xx answer raises instead of returning its body. */
async function fetchAuthedBytes(path: string): Promise<Uint8Array> {
  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
  const response = await authedFetch(url);
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // non-JSON error body
    }
    throw new ApiError(response.status, "DownloadFailed", message);
  }
  return new Uint8Array(await response.arrayBuffer());
}

/**
 * Downloads an authenticated API resource (xlsx export, pdf, attachment) into the cache
 * directory and opens the OS share sheet on it. Returns the local file URI.
 */
export async function downloadAndShare(
  path: string,
  filename: string,
): Promise<string> {
  const bytes = await fetchAuthedBytes(path);
  const target = new File(
    Paths.cache,
    `${Date.now()}-${safeFilename(filename)}`,
  );
  target.write(bytes);

  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(target.uri);
  return target.uri;
}

/**
 * Copy of an authenticated API resource in the cache, under a caller-chosen stable name.
 * Media players need a local file: they cannot carry the Bearer token, and a token that
 * expires mid-playback would cut the stream.
 *
 * A cached copy is reused only when it is whole: pass `expectedBytes` and a copy left
 * truncated by an interrupted write is fetched again instead of being served forever.
 */
export async function cacheAuthedFile(
  path: string,
  filename: string,
  expectedBytes?: number,
): Promise<string> {
  const target = new File(Paths.cache, safeFilename(filename));
  const cached =
    target.exists &&
    (expectedBytes === undefined || target.size === expectedBytes);
  if (cached) return target.uri;
  const bytes = await fetchAuthedBytes(path);
  target.write(bytes);
  return target.uri;
}
