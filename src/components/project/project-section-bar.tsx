// Project section keys, in the order the web sidebar lists them. The 2a shell shows
// overview / invoices / labor / planning as tabs and the rest through the Menu sheet.
export const PROJECT_SECTIONS = [
  "overview",
  "invoices",
  "labor",
  "salaries",
  "documents",
  "photos",
  "notes",
  "planning",
  "chiffrage",
  "analyses",
  "members",
  "tags",
  "settings",
] as const;

export type ProjectSection = (typeof PROJECT_SECTIONS)[number];
