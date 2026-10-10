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

/**
 * Sections the caller's company (the primary one, as the rest of the Menu) hides. Everything is
 * visible while the companies load or when the API predates the setting.
 */
export function useHiddenSections(): ReadonlySet<string> {
  const companies = useMyCompanies();
  const hidden = companies.data?.[0]?.hidden_sections;
  return useMemo(() => new Set(hidden ?? []), [hidden]);
}

/** Only a company admin (or platform ops) may change what the company hides. */
export function useCanManageHiddenSections(): boolean {
  const { user } = useAuth();
  const companies = useMyCompanies();
  return (
    isPlatformOps(user) || (companies.data?.[0]?.role ?? "member") === "admin"
  );
}
