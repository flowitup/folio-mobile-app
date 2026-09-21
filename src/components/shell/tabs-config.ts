/**
 * Navigator-level facts of the project-first tab shell, kept apart from the layout so the
 * navigation QA test can build the same router without mounting the shell.
 */

/** Routes reached through the Menu / Account sheets; they keep the tab bar but are not tab items. */
export const HIDDEN_ROUTES = [
  "billing",
  "library",
  "inventory",
  "settings",
  "company",
  "projects/[id]",
] as const;

/**
 * Back from a Menu or Account destination (settings, billing, a project section…) returns to
 * the tab the user left, not to the first tab: the navigator keeps the visit history. The
 * default `firstRoute` sent every Back to whichever tab happened to be first, which read as
 * "Settings dropped me on Lương".
 */
export const TABS_BACK_BEHAVIOR = "history" as const;

/**
 * The tab a `projects/[id]/<section>` screen belongs to, so the bar keeps that tab lit
 * (an invoice pushed from Chi phí is still the expenses flow); `null` for Menu sections.
 */
export function sectionTabOf(
  sectionRoute: string | undefined,
): "expenses" | "labor" | "planning" | null {
  if (!sectionRoute) return null;
  const head = sectionRoute.split("/")[0];
  if (head === "invoices") return "expenses";
  if (head === "labor" || head === "salaries") return "labor";
  if (head === "planning") return "planning";
  return null;
}
