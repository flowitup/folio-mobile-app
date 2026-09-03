import { useQuery } from "@tanstack/react-query";

import { api } from "@/api/client";
import { useAuth } from "@/auth/auth-context";
import { unwrapAs } from "@/lib/query/api-error";

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
