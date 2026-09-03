import { useEffect, useState } from "react";
import { Image } from "react-native";
import type { ImageProps } from "react-native";

import { getStoredTokens } from "@/auth/token-storage";
import { API_BASE_URL } from "@/config/env";

type Props = Omit<ImageProps, "source"> & {
  /** API path (`/api/v1/...`) or absolute URL. */
  path: string;
};

/** `Image` for API-served media that requires the Bearer token (thumbnails, product images). */
export function AuthedImage({ path, ...rest }: Props) {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getStoredTokens().then(({ accessToken }) => {
      if (active) setToken(accessToken);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!token) return null;
  const uri = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
  return (
    <Image
      source={{ uri, headers: { Authorization: `Bearer ${token}` } }}
      {...rest}
    />
  );
}
