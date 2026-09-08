import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { api } from "@/api/client";
import { unwrapAs } from "@/lib/query/api-error";
import { useApiMutation } from "@/lib/query/use-api-mutation";

import { companyKeys } from "./companies-api";
import type { CompanyRole } from "./companies-api";

// Attached-user directory, the D1 person directory (linked or pending), add-by-phone and
// import-from-another-company. See `companies-api.ts` for companies/join code/access and
// `member-grants-api.ts` for D8 per-member grant/deny.

// ---- attached users -----------------------------------------------------------------------------

/** `email` / `display_name` / `phone` are absent on older API versions: fall back to the user id. */
export interface AttachedUser {
  user_id: string;
  email?: string | null;
  display_name?: string | null;
  phone?: string | null;
  is_primary: boolean;
  attached_at: string;
  role: CompanyRole;
}

export const attachedUserKeys = {
  list: (companyId: string) =>
    ["companies", companyId, "attached-users"] as const,
};

export function useAttachedUsers(companyId: string | undefined) {
  return useQuery({
    queryKey: attachedUserKeys.list(companyId ?? ""),
    enabled: Boolean(companyId),
    queryFn: async () =>
      unwrapAs<{ items?: AttachedUser[] }>(
        await api.GET("/api/v1/companies/{company_id}/attached-users", {
          params: { path: { company_id: companyId! } },
        }),
      ).items ?? [],
  });
}

// ---- member directory + onboarding (D1/Phase 2) ------------------------------------------------

/** One row of a company's member directory: linked account, or a pending profile awaiting sign-up. */
export interface CompanyPersonEntry {
  person_id: string;
  name: string;
  phone: string | null;
  linked_user_id: string | null;
  assigned_project_ids: string[];
  is_active: boolean;
  pending: boolean;
  labor_role_id: string | null;
  default_daily_rate: number | null;
}

export const companyPersonKeys = {
  directory: (companyId: string) =>
    ["companies", companyId, "persons"] as const,
};

/** Company-scoped person directory (admin or manager); `assigned_project_ids` is company-scoped too. */
export function useCompanyPersons(companyId: string | undefined) {
  return useQuery({
    queryKey: companyPersonKeys.directory(companyId ?? ""),
    enabled: Boolean(companyId),
    queryFn: async () =>
      unwrapAs<{ items?: CompanyPersonEntry[] }>(
        await api.GET("/api/v1/companies/{company_id}/persons", {
          params: { path: { company_id: companyId! } },
        }),
      ).items ?? [],
  });
}

export type AddMemberRole = "member" | "manager";

export interface AddMemberByPhonePayload {
  companyId: string;
  phone: string;
  name?: string;
  role?: AddMemberRole;
  /** Resend after a 409 (`AddMemberConflictError`), picking one of its `candidates`. */
  person_id?: string;
}

export interface AddMemberByPhoneResult {
  person_id: string;
  name: string;
  phone: string;
}

export interface AddMemberCandidate {
  person_id: string;
  name: string;
}

/** Several un-linked profiles match this phone across the companies the caller admins. */
export class AddMemberConflictError extends Error {
  readonly candidates: AddMemberCandidate[];
  constructor(message: string, candidates: AddMemberCandidate[]) {
    super(message);
    this.name = "AddMemberConflictError";
    this.candidates = candidates;
  }
}

/**
 * Add a company member by phone (admin only). Match order on the backend: existing account →
 * un-linked profile in another company the caller admins → several candidates (409, caller
 * resends with `person_id`) → brand new pending profile.
 */
export function useAddMemberByPhone() {
  const { t } = useTranslation();
  return useApiMutation<AddMemberByPhonePayload, AddMemberByPhoneResult>({
    mutationFn: async ({ companyId, ...body }) => {
      // The endpoint's 200/409 bodies are both untyped in the spec — cast to a shape this
      // function fully controls instead of fighting openapi-fetch's inferred (and here
      // uninformative) success/error union.
      const result = (await api.POST("/api/v1/companies/{company_id}/members", {
        params: { path: { company_id: companyId } },
        body: body as never,
      })) as {
        data?: AddMemberByPhoneResult;
        error?: unknown;
        response: { status: number; statusText: string };
      };
      if (result.error !== undefined) {
        const envelope = result.error as {
          message?: string;
          candidates?: AddMemberCandidate[];
        };
        if (Array.isArray(envelope.candidates)) {
          throw new AddMemberConflictError(
            envelope.message ?? t("companies.members.addByPhone.conflict"),
            envelope.candidates,
          );
        }
        return unwrapAs<AddMemberByPhoneResult>(result);
      }
      return result.data as AddMemberByPhoneResult;
    },
    invalidates: [companyKeys.all],
    // The candidate-picker case is rendered inline by the sheet, not toasted.
    onError: (error) => error instanceof AddMemberConflictError,
    successMessage: t("companies.members.addByPhone.successToast"),
  });
}

export interface ImportMembersResultItem {
  person_id: string;
  name: string;
  phone: string | null;
  linked_user_id: string | null;
}

export interface ImportMembersResult {
  items: ImportMembersResultItem[];
  skipped_person_ids: string[];
}

/** Copy member profiles from another company the caller also admins (no pay data). */
export function useImportMembers() {
  const { t } = useTranslation();
  return useApiMutation<
    { companyId: string; from_company_id: string; person_ids: string[] },
    ImportMembersResult
  >({
    mutationFn: async ({ companyId, ...body }) =>
      unwrapAs<ImportMembersResult>(
        await api.POST("/api/v1/companies/{company_id}/members/import", {
          params: { path: { company_id: companyId } },
          body: body as never,
        }),
      ),
    invalidates: [companyKeys.all],
    successMessage: t("companies.members.import.successToast"),
  });
}
