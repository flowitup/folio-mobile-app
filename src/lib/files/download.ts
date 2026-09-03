import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import { getStoredTokens } from "@/auth/token-storage";
import { API_BASE_URL } from "@/config/env";
import { ApiError } from "@/lib/query/api-error";

/**
 * Downloads an authenticated API resource (xlsx export, pdf, attachment) into the cache
 * directory and opens the OS share sheet on it. Returns the local file URI.
 */
export async function downloadAndShare(
  path: string,
  filename: string,
): Promise<string> {
  const { accessToken } = await getStoredTokens();
  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
  const target = new File(Paths.cache, filename);
  if (target.exists) target.delete();

  const output = await File.downloadFileAsync(url, target, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  if (!output.exists)
    throw new ApiError(0, "DownloadFailed", `Download failed: ${filename}`);

  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(output.uri);
  return output.uri;
}
