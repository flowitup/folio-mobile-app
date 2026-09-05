import { useEffect, useState } from "react";
import { Image } from "react-native";
import type { ImageErrorEvent, ImageProps } from "react-native";

import { authedFetch } from "@/api/authed-fetch";
import { getStoredTokens } from "@/auth/token-storage";
import { API_BASE_URL } from "@/config/env";
import { bytesToBase64 } from "@/lib/files/base64";

type Props = Omit<ImageProps, "source"> & {
  /** API path (`/api/v1/...`) or absolute URL. */
  path: string;
};

/**
 * Downloads the image through the token-refreshing fetch and returns it as a data URI.
 * Reads the bytes with `arrayBuffer()` rather than `blob()`: Expo's fetch warns (LogBox) on
 * every `Response.blob()` call unless the native `expo-blob` module is installed.
 */
async function fetchAsDataUri(uri: string): Promise<string | null> {
  const response = await authedFetch(uri);
  if (!response.ok) return null;
  const type =
    response.headers.get("content-type") ?? "application/octet-stream";
  const bytes = new Uint8Array(await response.arrayBuffer());
  return `data:${type};base64,${bytesToBase64(bytes)}`;
}

/**
 * `Image` for API-served media that requires the Bearer token (thumbnails, product images,
 * chat attachments). First try: the native image loader with the stored token as a header.
 * If that fails (expired token, or a platform image pipeline that mishandles the header),
 * fall back to `authedFetch` — same refresh logic as the API client — and render the bytes.
 */
export function AuthedImage({ path, onError, ...rest }: Props) {
  const [token, setToken] = useState<string | null>(null);
  const [fallback, setFallback] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const uri = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;

  useEffect(() => {
    let active = true;
    void getStoredTokens().then(({ accessToken }) => {
      if (active) setToken(accessToken);
    });
    return () => {
      active = false;
    };
  }, []);

  function handleError(event: ImageErrorEvent) {
    onError?.(event);
    if (fallback || failed) return;
    void fetchAsDataUri(uri).then((dataUri) => {
      if (dataUri) setFallback(dataUri);
      else setFailed(true);
    });
  }

  if (fallback) return <Image source={{ uri: fallback }} {...rest} />;
  if (!token || failed) return null;
  return (
    <Image
      source={{ uri, headers: { Authorization: `Bearer ${token}` } }}
      onError={handleError}
      {...rest}
    />
  );
}
