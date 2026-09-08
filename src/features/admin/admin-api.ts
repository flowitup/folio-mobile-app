import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { api } from "@/api/client";
import { unwrapAs } from "@/lib/query/api-error";
import { useApiMutation } from "@/lib/query/use-api-mutation";

export interface UserSearchItem {
  id: string;
  email: string;
  display_name: string | null;
  /** E.164 number used for SMS-code sign-in; null when not assigned. */
  phone?: string | null;
}

export const adminKeys = {
  users: (search: string) => ["admin", "users", search] as const,
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

export function useUpdateUser() {
  const { t } = useTranslation();
  return useApiMutation<
    {
      userId: string;
      email?: string;
      display_name?: string | null;
      phone?: string | null;
    },
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

// Bulk-adding a user to projects with a global role (`POST /admin/users/<id>/memberships`) was
// removed with this redesign: project membership is role-less (manager/member assignment, D1);
// use the company members screen + project assignment sheet instead.
