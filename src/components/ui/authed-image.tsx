import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Image, Pressable } from "react-native";
import type { ImageErrorEvent, ImageProps } from "react-native";

import { authedFetch } from "@/api/authed-fetch";
import { getStoredTokens } from "@/auth/token-storage";
import { API_BASE_URL } from "@/config/env";
import { Icon } from "@/components/ui/icon";
import { bytesToBase64 } from "@/lib/files/base64";
import { retryAfterSeconds } from "@/lib/query/api-error";
import { useTokens } from "@/theme/tokens";

/** Automatic retries after a rate limit, before waiting for a tap. */
const MAX_AUTO_RETRIES = 3;

type Props = Omit<ImageProps, "source"> & {
  /** API path (`/api/v1/...`) or absolute URL. */
  path: string;
};

/**
 * Downloads the image through the token-refreshing fetch and returns it as a data URI.
 * Reads the bytes with `arrayBuffer()` rather than `blob()`: Expo's fetch warns (LogBox) on
 * every `Response.blob()` call unless the native `expo-blob` module is installed.
 */
async function fetchAsDataUri(
  uri: string,
): Promise<string | { retryAfter: number } | null> {
  const response = await authedFetch(uri);
  // Rate limited (a long gallery scrolled fast): say how long until it can be asked again.
  if (response.status === 429)
    return {
      retryAfter: retryAfterSeconds(response.headers.get("Retry-After")) ?? 5,
    };
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
  const { t } = useTranslation();
  const tokens = useTokens();
  const [token, setToken] = useState<string | null>(null);
  const [fallback, setFallback] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  // Remounts the native image after a retry.
  const [attempt, setAttempt] = useState(0);
  const retries = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uri = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  useEffect(() => {
    let active = true;
    void getStoredTokens().then(({ accessToken }) => {
      if (active) setToken(accessToken);
    });
    return () => {
      active = false;
    };
  }, []);

  function retry() {
    setFailed(false);
    setAttempt((n) => n + 1);
  }

  function handleError(event: ImageErrorEvent) {
    onError?.(event);
    if (fallback || failed) return;
    void fetchAsDataUri(uri)
      .catch(() => null)
      .then((result) => {
        if (typeof result === "string") return setFallback(result);
        setFailed(true);
        // A 429 clears by itself: try again once the wait is over (a few times at most).
        if (result && retries.current < MAX_AUTO_RETRIES) {
          retries.current += 1;
          timer.current = setTimeout(
            retry,
            Math.min(result.retryAfter, 60) * 1000,
          );
        }
      });
  }

  if (fallback) return <Image source={{ uri: fallback }} {...rest} />;
  if (!token) return null;
  if (failed)
    // Not an empty tile for good: a tap tries again (anything under it stays visible).
    return (
      <Pressable
        testID="authed-image-retry"
        accessibilityRole="button"
        accessibilityLabel={t("common.retry")}
        onPress={() => {
          retries.current = 0;
          retry();
        }}
        style={[rest.style, { alignItems: "center", justifyContent: "center" }]}
      >
        <Icon name="refresh-cw" size={16} color={tokens.muted} />
      </Pressable>
    );
  return (
    <Image
      key={attempt}
      source={{ uri, headers: { Authorization: `Bearer ${token}` } }}
      onError={handleError}
      {...rest}
    />
  );
}
