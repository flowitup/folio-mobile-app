/**
 * Shape of the in-app workflow guide. The prose lives in one module per locale rather than in
 * `src/i18n/locales/*.json`, which is sized for UI labels; a parity test keeps the three locales
 * from drifting apart.
 */
export type HelpTopic = {
  /** Stable id, matching the tab or sheet it documents. */
  id: string;
  title: string;
  /** One or two sentences: what this area is for, in the user's language. */
  purpose: string;
  /** The concrete actions, in order. */
  steps: string[];
  /** The role or permission the workflow needs, phrased for a reader. */
  whoCanDoIt: string;
  /** Where the phone stops and the web app takes over, when that is the case. */
  webOnlyNote?: string;
  /** Things a first-time user gets wrong. */
  gotchas?: string[];
  /** Only reachable in the worker shell (Attendance / Salary / Profile / Planning). */
  workerMode?: boolean;
};

export type HelpCatalogue = HelpTopic[];
