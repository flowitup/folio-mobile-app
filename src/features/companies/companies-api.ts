import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { api } from "@/api/client";
import { useAuth } from "@/auth/auth-context";
import { can, isPlatformOps } from "@/auth/permissions";
import { projectKeys } from "@/features/projects/projects-api";
import { unwrapAs, unwrapVoid } from "@/lib/query/api-error";
import { useApiMutation } from "@/lib/query/use-api-mutation";

// Companies, the caller's attachment to them, join code and access management. See
// `company-members-api.ts` (directory, add-by-phone, import, attached users) and
// `member-grants-api.ts` (D8 per-member grant/deny) for the rest of this domain.

export interface Company {
  id: string;
  legal_name: string;
  address: string;
  siret: string | null;
  tva_number: string | null;
  iban: string | null;
  bic: string | null;
  logo_url: string | null;
  default_payment_terms: string | null;
  prefix_override: string | null;
  /** Shared join code, exposed to the company's admins (D1); null when none is active. */
  join_code?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type CompanyRole = "admin" | "manager" | "member";

/** A company as seen through the caller's attachment row. */
export interface MyCompany extends Company {
  is_primary: boolean;
  attached_at: string;
  role: CompanyRole;
  /**
   * What the caller can do in this company (role + D8 grants). Absent from an older API,
   * in which case the token-wide `user.permissions` is the only answer.
   */
  permissions?: string[];
}

type MyCompaniesResponse = {
  items: {
    company: Company;
    access: { is_primary: boolean; attached_at: string; role: CompanyRole };
    permissions?: string[];
  }[];
};

export const companyKeys = {
  all: ["companies"] as const,
  mine: ["companies", "mine"] as const,
};

/**
 * Primary first, then most recently attached. `attached_at` is RFC-1123 text
 * (`Fri, 09 Oct 2026 18:00:33 GMT`), so compare instants, not strings (those sort by weekday).
 */
export function byPrimaryThenRecent(
  a: Pick<MyCompany, "is_primary" | "attached_at">,
  b: Pick<MyCompany, "is_primary" | "attached_at">,
): number {
  return (
    Number(b.is_primary) - Number(a.is_primary) ||
    (Date.parse(b.attached_at) || 0) - (Date.parse(a.attached_at) || 0)
  );
}

/** Companies the caller is attached to, primary first then most recently attached. */
export function useMyCompanies() {
  return useQuery({
    queryKey: companyKeys.mine,
    queryFn: async () => {
      const data = unwrapAs<MyCompaniesResponse>(
        await api.GET("/api/v1/companies"),
      );
      return data.items
        .map<MyCompany>(({ company, access, permissions }) => ({
          ...company,
          ...access,
          permissions,
        }))
        .sort(byPrimaryThenRecent);
    },
  });
}

/**
 * True when the caller holds `permission` in `companyId`. Library and inventory writes are
 * checked against the company they target, while `user.permissions` is resolved from the
 * primary company only: an admin of the primary company may be a plain member of the
 * company picked on screen, and the reverse.
 */
export function useCompanyCan(
  permission: string,
  companyId: string | null | undefined,
): boolean {
  const { user } = useAuth();
  const companies = useMyCompanies();
  const company = companies.data?.find((entry) => entry.id === companyId);
  return can(user, permission, company?.permissions);
}

/**
 * Billing is company-admin gated: superadmin (`*:*`) or the `admin` role in at least one
 * attached company. Mirrors the web `hasBillingAccess`.
 */
export function useBillingAccess() {
  const { user } = useAuth();
  const companies = useMyCompanies();
  const superadmin = isPlatformOps(user);
  const adminSomewhere = (companies.data ?? []).some((c) => c.role === "admin");
  return {
    allowed: superadmin || adminSomewhere,
    loading: !superadmin && companies.isPending,
    companies: companies.data ?? [],
  };
}

// ---- company management (settings) ------------------------------------------------------------

export interface CreateCompanyPayload {
  legal_name: string;
  address: string;
  siret?: string | null;
  tva_number?: string | null;
  iban?: string | null;
  bic?: string | null;
  logo_url?: string | null;
  default_payment_terms?: string | null;
  prefix_override?: string | null;
}
export type UpdateCompanyPayload = Partial<CreateCompanyPayload>;

export const companyAdminKeys = {
  allCompanies: ["companies", "all"] as const,
};

/** Superadmin view of every company (`?scope=all`). */
export function useAllCompanies(enabled: boolean) {
  return useQuery({
    queryKey: companyAdminKeys.allCompanies,
    enabled,
    queryFn: async () =>
      unwrapAs<{ items: Company[]; total: number }>(
        await api.GET("/api/v1/companies", {
          params: { query: { scope: "all", limit: 200 } } as never,
        }),
      ).items,
  });
}

export function useCompany(companyId: string | undefined) {
  return useQuery({
    queryKey: ["companies", companyId ?? "", "detail"],
    enabled: Boolean(companyId),
    queryFn: async () =>
      unwrapAs<Company>(
        await api.GET("/api/v1/companies/{company_id}", {
          params: { path: { company_id: companyId! } },
        }),
      ),
  });
}

export function useCreateCompany() {
  const { t } = useTranslation();
  const { refreshUser } = useAuth();
  return useApiMutation<CreateCompanyPayload, Company>({
    mutationFn: async (body) =>
      unwrapAs<Company>(
        await api.POST("/api/v1/companies", { body: body as never }),
      ),
    invalidates: [companyKeys.all],
    successMessage: t("companies.toast.created"),
    // The creator becomes the company's admin: the account sheet and the permission
    // claim read `/auth/me`, which is held in the auth context, not the query cache.
    onSuccess: () => void refreshUser(),
  });
}

export function useUpdateCompany() {
  const { t } = useTranslation();
  return useApiMutation<{ id: string } & UpdateCompanyPayload, Company>({
    mutationFn: async ({ id, ...body }) =>
      unwrapAs<Company>(
        await api.PUT("/api/v1/companies/{company_id}", {
          params: { path: { company_id: id } },
          body: body as never,
        }),
      ),
    invalidates: [companyKeys.all],
    successMessage: t("common.saved"),
  });
}

export function useDeleteCompany() {
  const { t } = useTranslation();
  return useApiMutation<{ id: string }>({
    mutationFn: async ({ id }) =>
      unwrapVoid(
        await api.DELETE("/api/v1/companies/{company_id}", {
          params: { path: { company_id: id } },
        }),
      ),
    invalidates: [companyKeys.all],
    successMessage: t("companies.toast.deleted"),
  });
}

/** Detach the caller from a company (member leaves). */
export function useDetachCompany() {
  const { t } = useTranslation();
  const { refreshUser } = useAuth();
  return useApiMutation<{ id: string }>({
    mutationFn: async ({ id }) =>
      unwrapVoid(
        await api.DELETE("/api/v1/companies/{company_id}/access", {
          params: { path: { company_id: id } },
        }),
      ),
    invalidates: [companyKeys.all, projectKeys.all],
    successMessage: t("companies.toast.detached"),
    // `user.companies` (account sheet, admin gates) lives in the auth context, not the cache.
    onSuccess: () => void refreshUser(),
  });
}

export function useSetPrimaryCompany() {
  const { t } = useTranslation();
  const { refreshUser } = useAuth();
  return useApiMutation<{ id: string }>({
    mutationFn: async ({ id }) =>
      unwrapVoid(
        await api.PUT("/api/v1/users/me/primary-company", {
          body: { company_id: id } as never,
        }),
      ),
    invalidates: [companyKeys.all, projectKeys.all],
    successMessage: t("companies.toast.primarySet"),
    // `/auth/me` permissions are scoped to the primary company, so they change with it.
    onSuccess: () => void refreshUser(),
  });
}

export function useSetMemberRole() {
  const { t } = useTranslation();
  return useApiMutation<{
    companyId: string;
    userId: string;
    role: CompanyRole;
  }>({
    mutationFn: async ({ companyId, userId, role }) =>
      unwrapVoid(
        await api.PATCH(
          "/api/v1/companies/{company_id}/access/{target_user_id}/role",
          {
            params: { path: { company_id: companyId, target_user_id: userId } },
            body: { role } as never,
          },
        ),
      ),
    invalidates: [companyKeys.all],
    successMessage: t("common.saved"),
  });
}

export function useBootAttachedUser() {
  const { t } = useTranslation();
  return useApiMutation<{ companyId: string; userId: string }>({
    mutationFn: async ({ companyId, userId }) =>
      unwrapVoid(
        await api.DELETE(
          "/api/v1/companies/{company_id}/access/{target_user_id}",
          {
            params: { path: { company_id: companyId, target_user_id: userId } },
          },
        ),
      ),
    invalidates: [companyKeys.all],
    successMessage: t("companies.toast.removed"),
  });
}

/** Company admin (D1): issue (or renew) the shared join code. */
export function useSetJoinCode() {
  const { t } = useTranslation();
  return useApiMutation<{ companyId: string }, { join_code: string }>({
    mutationFn: async ({ companyId }) =>
      unwrapAs<{ join_code: string }>(
        await api.POST("/api/v1/companies/{company_id}/join-code", {
          params: { path: { company_id: companyId } },
        }),
      ),
    invalidates: [companyKeys.all],
    successMessage: t("companies.admin.manage.joinCode.createdToast"),
  });
}

/** Company admin (D1): revoke the shared join code. */
export function useRevokeJoinCode() {
  const { t } = useTranslation();
  return useApiMutation<{ companyId: string }>({
    mutationFn: async ({ companyId }) =>
      unwrapVoid(
        await api.DELETE("/api/v1/companies/{company_id}/join-code", {
          params: { path: { company_id: companyId } },
        }),
      ),
    invalidates: [companyKeys.all],
    successMessage: t("companies.admin.manage.joinCode.revokedToast"),
  });
}

/** Join a company as member with its shared code (onboarding + "join another company"). */
export function useJoinCompanyByCode() {
  const { t } = useTranslation();
  const { refreshUser } = useAuth();
  return useApiMutation<{ code: string }, Company>({
    mutationFn: async ({ code }) =>
      unwrapAs<Company>(
        await api.POST("/api/v1/companies/join", { body: { code } }),
      ),
    invalidates: [companyKeys.all, projectKeys.all],
    successMessage: t("companies.join.successToast"),
    // The new company joins `user.companies` (and may become primary): held in the auth context.
    onSuccess: () => void refreshUser(),
    // The join screen renders a translated inline error for every failure; the default
    // toast would only add the server's English sentence on top of it.
    onError: () => true,
  });
}
