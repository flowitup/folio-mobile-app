import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { api } from "@/api/client";
import { unwrapAs, unwrapVoid } from "@/lib/query/api-error";
import { useApiMutation } from "@/lib/query/use-api-mutation";

import { companyKeys } from "./companies-api";

// D8 per-member custom scope: grant or deny one whitelisted permission, company-wide or scoped
// to a single project. See `companies-api.ts` and `company-members-api.ts` for the rest of the
// companies domain.

export type GrantEffect = "grant" | "deny";

export interface MemberGrantRow {
  permission: string;
  effect: GrantEffect;
  /** `null` = company-wide; otherwise scoped to this project. */
  project_id: string | null;
  granted_at: string;
}

export interface MemberGrantsList {
  grants: MemberGrantRow[];
  /** The whitelist this specific target can be customised on (`CUSTOMISABLE_PERMISSIONS`). */
  customisable: string[];
}

export const memberGrantKeys = {
  list: (companyId: string, userId: string) =>
    ["companies", companyId, "members", userId, "grants"] as const,
};

/** A manager's or member's D8 grant/deny rows, plus the whitelist they can be customised on. */
export function useMemberGrants(
  companyId: string | undefined,
  userId: string | undefined,
) {
  return useQuery({
    queryKey: memberGrantKeys.list(companyId ?? "", userId ?? ""),
    enabled: Boolean(companyId && userId),
    queryFn: async () =>
      unwrapAs<MemberGrantsList>(
        await api.GET(
          "/api/v1/companies/{company_id}/members/{user_id}/grants",
          { params: { path: { company_id: companyId!, user_id: userId! } } },
        ),
      ),
  });
}

/** Upsert one grant/deny row (idempotent: setting a new effect on the same key replaces it). */
export function useSetMemberGrant() {
  const { t } = useTranslation();
  return useApiMutation<
    {
      companyId: string;
      userId: string;
      permission: string;
      effect: GrantEffect;
      project_id?: string | null;
    },
    MemberGrantRow
  >({
    mutationFn: async ({ companyId, userId, ...body }) =>
      unwrapAs<MemberGrantRow>(
        await api.PUT(
          "/api/v1/companies/{company_id}/members/{user_id}/grants",
          {
            params: { path: { company_id: companyId, user_id: userId } },
            body: body as never,
          },
        ),
      ),
    invalidates: [companyKeys.all],
    successMessage: t("common.saved"),
  });
}

/** Delete a grant/deny row. */
export function useRemoveMemberGrant() {
  const { t } = useTranslation();
  return useApiMutation<{
    companyId: string;
    userId: string;
    permission: string;
    project_id?: string | null;
  }>({
    mutationFn: async ({ companyId, userId, ...body }) =>
      unwrapVoid(
        await api.DELETE(
          "/api/v1/companies/{company_id}/members/{user_id}/grants",
          {
            params: { path: { company_id: companyId, user_id: userId } },
            body: body as never,
          },
        ),
      ),
    invalidates: [companyKeys.all],
    successMessage: t("companies.members.grants.removedToast"),
  });
}
