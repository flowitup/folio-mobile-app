import type { HelpCatalogue } from "./types";

/**
 * What the sheet knows about the reader. The fields are exactly what the tab bar and the Menu
 * sheet read to decide what to draw, so the guide and the navigation cannot disagree.
 */
export type HelpViewer = {
  /** The restricted worker shell: four own-data tabs and no Menu at all. */
  workerMode: boolean;
  canUpdateProject: boolean;
  billingAllowed: boolean;
  companyAdmin: boolean;
};

/**
 * Everything a worker cannot reach. Worker mode drops the Menu item entirely
 * (`floating-tab-bar.tsx`), so every Menu-reached section goes with it, and the four tabs show
 * their own-data variants instead of the manager screens.
 */
const MANAGER_ONLY = new Set([
  "overview",
  "attendance",
  "attendance-validation",
  "workers",
  "labor-payments",
  "salaries",
  "expenses",
  "expense-create",
  "expense-detail",
  "billing",
  "company-members",
  "project-members",
  "library",
  "chiffrage",
  "documents",
  "photos",
  "notes",
  "analyses",
]);

/**
 * A topic is listed only when its area is reachable for this reader — the guide shows what the
 * navigation shows, so nobody is walked through a screen they cannot open. An id in neither set
 * below, and carrying no `workerMode` flag, is reachable by everyone who can sign in.
 *
 * The extra gates repeat the Menu sheet's own: documents needs `project:update`, billing needs
 * billing access, and the company directory needs company administration.
 */
const EXTRA_GATES: Record<string, (viewer: HelpViewer) => boolean> = {
  documents: (viewer) => viewer.canUpdateProject,
  billing: (viewer) => viewer.billingAllowed,
  "company-members": (viewer) => viewer.companyAdmin,
};

/** The catalogue narrowed to the areas this reader can actually reach. */
export function visibleHelpTopics(
  topics: HelpCatalogue,
  viewer: HelpViewer,
): HelpCatalogue {
  return topics.filter((topic) => {
    // The three worker screens exist only in the worker shell.
    if (topic.workerMode) return viewer.workerMode;
    if (viewer.workerMode && MANAGER_ONLY.has(topic.id)) return false;
    return EXTRA_GATES[topic.id]?.(viewer) ?? true;
  });
}

/** Exported so a test can assert these stay in step with the catalogue's ids. */
export const MANAGER_ONLY_TOPIC_IDS = [...MANAGER_ONLY];
export const EXTRA_GATED_TOPIC_IDS = Object.keys(EXTRA_GATES);
