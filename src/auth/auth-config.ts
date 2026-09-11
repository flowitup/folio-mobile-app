import { useQuery } from "@tanstack/react-query";

import { api } from "@/api/client";
import { unwrapAs } from "@/lib/query/api-error";

import type { components } from "@/api/generated/schema";

export type AuthConfig = components["schemas"]["AuthConfigResponse"];

/**
 * Public sign-in options of the backend (REFRESH_TOKEN_POLICY), read on the login screen so it
 * knows whether "create account" should show. Phone + SMS code is the only sign-in the app
 * offers; there is no per-deployment mode to switch on anymore.
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
