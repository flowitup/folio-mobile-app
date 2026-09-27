import { Directory, File, Paths } from "expo-file-system";
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

/** Folders `downloadToCache` creates; `share-` is the name older builds used. */
const DOWNLOAD_FOLDER = /^(download|share)-(\d+)$/;
/** Long enough for any app a file was shared to (Drive upload, mail draft) to have read it. */
const DOWNLOAD_TTL_MS = 60 * 60 * 1000;

/**
 * Removes download folders older than the TTL. A download is never deleted when its screen
 * closes: on Android the share sheet resolves before the receiving app has read the file.
 * Best effort: the cache is the OS's to purge anyway.
 */
export function sweepStaleDownloads(now = Date.now()): void {
  try {
    for (const entry of new Directory(Paths.cache).list()) {
      const match = DOWNLOAD_FOLDER.exec(entry.name);
      if (
        match &&
        entry instanceof Directory &&
        now - Number(match[2]) > DOWNLOAD_TTL_MS
      )
        entry.delete();
    }
  } catch {
    // cache unreadable: nothing to sweep
  }
}

/**
 * Downloads an authenticated API resource (xlsx export, pdf, attachment) into its own cache
 * folder and returns the local file URI. The file keeps its real name, because a share
 * recipient sees it, so uniqueness lives in the folder, not in the name.
 */
export async function downloadToCache(
  path: string,
  filename: string,
): Promise<string> {
  const bytes = await fetchAuthedBytes(path);
  sweepStaleDownloads();
  const folder = new Directory(Paths.cache, `download-${Date.now()}`);
  folder.create();
  const target = new File(folder, safeFilename(filename));
  target.write(bytes);
  return target.uri;
}

/** Opens the OS share sheet on a local file (no-op where sharing is unavailable). */
export async function shareLocalFile(
  uri: string,
  mimeType?: string,
): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) return;
  await Sharing.shareAsync(
    uri,
    mimeType === "application/pdf"
      ? { mimeType, UTI: "com.adobe.pdf" }
      : mimeType
        ? { mimeType }
        : undefined,
  );
}

/**
 * Downloads an authenticated API resource into the cache and opens the OS share sheet on it.
 * Returns the local file URI.
 */
export async function downloadAndShare(
  path: string,
  filename: string,
): Promise<string> {
  const uri = await downloadToCache(path, filename);
  await shareLocalFile(uri);
  return uri;
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
