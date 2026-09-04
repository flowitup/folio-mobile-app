import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { api } from "@/api/client";
import { unwrapAs } from "@/lib/query/api-error";
import { useApiMutation } from "@/lib/query/use-api-mutation";

export interface UserSearchItem {
  id: string;
  email: string;
  display_name: string | null;
}

export type BulkAddStatus =
  | "added"
  | "already_member_same_role"
  | "already_member_different_role"
  | "project_not_found";

export interface BulkAddResultItem {
  project_id: string;
  project_name: string | null;
  status: BulkAddStatus;
}

export interface GlobalRole {
  id: string;
  name: string;
  description?: string | null;
}

export const adminKeys = {
  users: (search: string) => ["admin", "users", search] as const,
  roles: ["roles"] as const,
};

/** Superadmin user search by email / display name (`?search=`). */
export function useAdminUserSearch(search: string) {
  return useQuery({
    queryKey: adminKeys.users(search),
    enabled: search.trim().length > 0,
    queryFn: async () =>
      unwrapAs<{ items: UserSearchItem[]; count: number }>(
        await api.GET("/api/v1/admin/users", {
          params: { query: { search: search.trim(), limit: 20 } } as never,
        }),
      ).items,
  });
}

/** Global (project) roles minus superadmin, for the bulk-add role picker. */
export function useGlobalRoles(enabled = true) {
  return useQuery({
    queryKey: adminKeys.roles,
    enabled,
    queryFn: async () => {
      const data = unwrapAs<{ roles?: GlobalRole[] } | GlobalRole[]>(
        await api.GET("/api/v1/roles"),
      );
      return Array.isArray(data) ? data : (data.roles ?? []);
    },
  });
}

export function useUpdateUser() {
  const { t } = useTranslation();
  return useApiMutation<
    { userId: string; email?: string; display_name?: string | null },
    UserSearchItem
  >({
    mutationFn: async ({ userId, ...body }) =>
      unwrapAs<UserSearchItem>(
        await api.PATCH("/api/v1/admin/users/{user_id}", {
          params: { path: { user_id: userId } },
          body: body as never,
        }),
      ),
    invalidates: [["admin", "users"]],
    successMessage: t("common.saved"),
  });
}

export function useBulkAddMemberships() {
  return useApiMutation<
    { userId: string; project_ids: string[]; role_id: string },
    { results: BulkAddResultItem[] }
  >({
    mutationFn: async ({ userId, ...body }) =>
      unwrapAs<{ results: BulkAddResultItem[] }>(
        await api.POST("/api/v1/admin/users/{user_id}/memberships", {
          params: { path: { user_id: userId } },
          body: body as never,
        }),
      ),
    invalidates: [["projects"]],
  });
}
