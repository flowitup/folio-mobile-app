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

/**
 * Downloads an authenticated API resource (xlsx export, pdf, attachment) into the cache
 * directory and opens the OS share sheet on it. Non-2xx responses raise ApiError instead of
 * sharing the error body as a file. Returns the local file URI.
 */
export async function downloadAndShare(
  path: string,
  filename: string,
): Promise<string> {
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

  const bytes = new Uint8Array(await response.arrayBuffer());
  const target = new File(
    Paths.cache,
    `${Date.now()}-${safeFilename(filename)}`,
  );
  target.write(bytes);

  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(target.uri);
  return target.uri;
}
