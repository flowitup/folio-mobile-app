import type { CompanyPersonEntry } from "@/features/companies/company-members-api";
import type { Worker } from "@/features/labor/labor-types";

/** Sentinel option: the person is not in the company directory, type their details instead. */
export const NEW_PERSON = "__new__";

/**
 * The editable defaults a company profile carries into a new project Worker. Identity
 * (name, phone) is deliberately absent: it stays on the Person and is displayed from the
 * picked entry, never copied into form state the caller could edit and then not send.
 */
export interface DirectoryPrefill {
  /** Empty when the company profile carries no default rate — the form then asks for one. */
  rate: string;
  roleId: string | null;
  userId: string | null;
}

/**
 * Company people who can still be added to this project.
 *
 * Excluded:
 * - deactivated company profiles (`is_active` false) — they left the company;
 * - anyone who already has a Worker row here. A second row would split their
 *   attendance across two workers, and the backend rejects it outright when the
 *   person has a linked account (unique project_id + user_id).
 *
 * `assigned_project_ids` is deliberately NOT used for that second check: it
 * reports project ACCESS for linked accounts, not labor assignment, so a worker
 * with no app account never appears in it.
 */
export function directoryCandidates(
  entries: CompanyPersonEntry[] | undefined,
  workers: Worker[] | undefined,
): CompanyPersonEntry[] {
  const taken = new Set(
    (workers ?? [])
      .map((worker) => worker.person_id)
      .filter((id): id is string => Boolean(id)),
  );
  return (entries ?? [])
    .filter((entry) => entry.is_active && !taken.has(entry.person_id))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Starting values for the form when a directory person is picked. Every field is
 * a default the caller may override before saving; only `person_id` is binding.
 */
export function prefillFromDirectory(
  entry: CompanyPersonEntry,
): DirectoryPrefill {
  return {
    rate:
      entry.default_daily_rate !== null &&
      entry.default_daily_rate !== undefined
        ? String(entry.default_daily_rate)
        : "",
    roleId: entry.labor_role_id ?? null,
    userId: entry.linked_user_id ?? null,
  };
}
