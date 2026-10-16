import { useMemo } from "react";

import { useAuth } from "@/auth/auth-context";
import { isPlatformOps } from "@/auth/permissions";
import { useMyCompanies } from "@/features/companies/companies-api";

/**
 * Navigation areas a company may hide from its members (Settings → Hidden sections). Keys match
 * the back end's `companies.hidden_sections`; the first three are Menu areas, the rest project
 * sections reached from the Menu.
 */
export const HIDEABLE_SECTIONS = [
  "billing",
  "library",
  "inventory",
  "documents",
  "photos",
  "notes",
  "salaries",
  "chiffrage",
  "analyses",
] as const;

export type HideableSection = (typeof HIDEABLE_SECTIONS)[number];

/** i18n key of a section's display name. */
export function hideableSectionLabelKey(section: HideableSection): string {
  switch (section) {
    case "billing":
      return "shell.billingTitle";
    case "library":
      return "library.title";
    case "inventory":
      return "inventory.title";
    default:
      return `project.sections.${section}`;
  }
}

/** Company-wide Menu areas; the other sections belong to a project. */
export const COMPANY_AREAS: readonly HideableSection[] = [
  "billing",
  "library",
  "inventory",
];

type CompanySections = { id: string; hidden_sections?: string[] | null };

/**
 * What the Menu hides (the web applies the same rule):
 * - a project section when the selected project's company hides it (with no project known, the
 *   single company of a one-company user);
 * - a company-wide area only when every company of the user hides it, so a user in two
 *   companies still reaches the library of the one that uses it.
 */
export function hiddenSectionsFor(
  companies: readonly CompanySections[] | undefined,
  projectCompanyId: string | null | undefined,
): ReadonlySet<string> {
  const list = companies ?? [];
  const projectCompany = projectCompanyId
    ? list.find((c) => c.id === projectCompanyId)
    : list.length === 1
      ? list[0]
      : undefined;
  const hidden = new Set(
    (projectCompany?.hidden_sections ?? []).filter(
      (key) => !COMPANY_AREAS.includes(key as HideableSection),
    ),
  );
  if (list.length > 0)
    for (const area of COMPANY_AREAS)
      if (list.every((c) => (c.hidden_sections ?? []).includes(area)))
        hidden.add(area);
  return hidden;
}

/** Sections hidden in the Menu for the project of `projectCompanyId` (see `hiddenSectionsFor`). */
export function useHiddenSections(
  projectCompanyId: string | null | undefined,
): ReadonlySet<string> {
  const companies = useMyCompanies();
  return useMemo(
    () => hiddenSectionsFor(companies.data, projectCompanyId),
    [companies.data, projectCompanyId],
  );
}

/**
 * Only a company admin (or platform ops) may change what a company hides: of `companyId`, or of
 * any company when none is given (whether to offer the screen at all).
 */
export function useCanManageHiddenSections(companyId?: string | null): boolean {
  const { user } = useAuth();
  const companies = useMyCompanies();
  if (isPlatformOps(user)) return true;
  return (companies.data ?? []).some(
    (c) => c.role === "admin" && (companyId == null || c.id === companyId),
  );
}
