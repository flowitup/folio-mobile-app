import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { api } from "@/api/client";
import { useAuth } from "@/auth/auth-context";
import { unwrapAs, unwrapVoid } from "@/lib/query/api-error";
import { useApiMutation } from "@/lib/query/use-api-mutation";

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
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type CompanyRole = "admin" | "member";

/** A company as seen through the caller's attachment row. */
export interface MyCompany extends Company {
  is_primary: boolean;
  attached_at: string;
  role: CompanyRole;
}

type MyCompaniesResponse = {
  items: {
    company: Company;
    access: { is_primary: boolean; attached_at: string; role: CompanyRole };
  }[];
};

export const companyKeys = {
  all: ["companies"] as const,
  mine: ["companies", "mine"] as const,
};

/** Companies the caller is attached to, primary first then most recently attached. */
export function useMyCompanies() {
  return useQuery({
    queryKey: companyKeys.mine,
    queryFn: async () => {
      const data = unwrapAs<MyCompaniesResponse>(
        await api.GET("/api/v1/companies"),
      );
      return data.items
        .map<MyCompany>(({ company, access }) => ({ ...company, ...access }))
        .sort(
          (a, b) =>
            Number(b.is_primary) - Number(a.is_primary) ||
            b.attached_at.localeCompare(a.attached_at),
        );
    },
  });
}

/**
 * Billing is company-admin gated: superadmin (`*:*`) or the `admin` role in at least one
 * attached company. Mirrors the web `hasBillingAccess`.
 */
export function useBillingAccess() {
  const { user } = useAuth();
  const companies = useMyCompanies();
  const superadmin = user?.permissions.includes("*:*") ?? false;
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

/** `email` / `display_name` are absent on older API versions: fall back to the user id. */
export interface AttachedUser {
  user_id: string;
  email?: string | null;
  display_name?: string | null;
  is_primary: boolean;
  attached_at: string;
  role: CompanyRole;
}

/** Plaintext `token` is only exposed at generation time: show it once, never store it. */
export interface CompanyInviteTokenGenerated {
  token: string;
  token_id: string;
  expires_at: string;
}

export const companyAdminKeys = {
  allCompanies: ["companies", "all"] as const,
  attachedUsers: (companyId: string) =>
    ["companies", companyId, "attached-users"] as const,
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

export function useAttachedUsers(companyId: string | undefined) {
  return useQuery({
    queryKey: companyAdminKeys.attachedUsers(companyId ?? ""),
    enabled: Boolean(companyId),
    queryFn: async () =>
      unwrapAs<{ items?: AttachedUser[] }>(
        await api.GET("/api/v1/companies/{company_id}/attached-users", {
          params: { path: { company_id: companyId! } },
        }),
      ).items ?? [],
  });
}

export function useCreateCompany() {
  const { t } = useTranslation();
  return useApiMutation<CreateCompanyPayload, Company>({
    mutationFn: async (body) =>
      unwrapAs<Company>(
        await api.POST("/api/v1/companies", { body: body as never }),
      ),
    invalidates: [companyKeys.all],
    successMessage: t("companies.toast.created"),
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
  return useApiMutation<{ id: string }>({
    mutationFn: async ({ id }) =>
      unwrapVoid(
        await api.DELETE("/api/v1/companies/{company_id}/access", {
          params: { path: { company_id: id } },
        }),
      ),
    invalidates: [companyKeys.all],
    successMessage: t("companies.toast.detached"),
  });
}

export function useSetPrimaryCompany() {
  const { t } = useTranslation();
  return useApiMutation<{ id: string }>({
    mutationFn: async ({ id }) =>
      unwrapVoid(
        await api.PUT("/api/v1/users/me/primary-company", {
          body: { company_id: id } as never,
        }),
      ),
    invalidates: [companyKeys.all],
    successMessage: t("companies.toast.primarySet"),
  });
}

export function useRedeemInviteToken() {
  const { t } = useTranslation();
  return useApiMutation<{ token: string }, MyCompany>({
    mutationFn: async ({ token }) =>
      unwrapAs<MyCompany>(
        await api.POST("/api/v1/companies/attach-by-token", {
          body: { token } as never,
        }),
      ),
    invalidates: [companyKeys.all],
    successMessage: t("companies.toast.attached"),
  });
}

export function useGenerateInviteToken() {
  return useApiMutation<
    { companyId: string; role: CompanyRole; regenerate?: boolean },
    CompanyInviteTokenGenerated
  >({
    mutationFn: async ({ companyId, role, regenerate }) =>
      unwrapAs<CompanyInviteTokenGenerated>(
        await api.POST("/api/v1/companies/{company_id}/invite-tokens", {
          params: {
            path: { company_id: companyId },
            query: regenerate ? { regenerate: "true" } : {},
          } as never,
          body: { role } as never,
        }),
      ),
  });
}

export function useRevokeInviteToken() {
  const { t } = useTranslation();
  return useApiMutation<{ companyId: string }>({
    mutationFn: async ({ companyId }) =>
      unwrapVoid(
        await api.DELETE(
          "/api/v1/companies/{company_id}/invite-tokens/active",
          { params: { path: { company_id: companyId } } },
        ),
      ),
    successMessage: t("companies.toast.tokenRevoked"),
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
