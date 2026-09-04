import { useQuery } from "@tanstack/react-query";

import { api } from "@/api/client";
import { unwrapAs } from "@/lib/query/api-error";

import type { components } from "@/api/generated/schema";

export type AuthConfig = components["schemas"]["AuthConfigResponse"];
export type LoginMode = "email" | "phone" | "both";

/**
 * Public sign-in options of the backend (LOGIN_MODE / REFRESH_TOKEN_POLICY), read on the login
 * screen so it shows only the sign-in the deployment offers. Unavailable → phone only.
 */
export function useAuthConfig() {
  return useQuery({
    queryKey: ["auth", "config"],
    staleTime: 5 * 60_000,
    retry: 1,
    queryFn: async () =>
      unwrapAs<AuthConfig>(await api.GET("/api/v1/auth/config")),
  });
}

/**
 * Sign-in methods to offer. Email + password stays hidden on the app unless the backend
 * activates it (`email` or `both`); phone is the default, also while the config is loading.
 */
export function loginModesFor(mode: string | undefined): ("phone" | "email")[] {
  if (mode === "email") return ["email"];
  if (mode === "both") return ["phone", "email"];
  return ["phone"];
}
