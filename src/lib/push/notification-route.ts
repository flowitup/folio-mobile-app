import type { ShellSheet } from "@/components/shell/shell-context";

/** `data` payload the backend attaches to pushes (see AttendancePushNotifier). */
export type PushData = {
  kind?: string;
  project_id?: string;
  entry_id?: string;
};

export type NotificationRoute = {
  /** Project to select in the shell before showing the screen. */
  projectId: string | null;
  /** Sheet to open once the shell is up (managers land on the bell). */
  sheet: ShellSheet | null;
  /** Screen to land on; `null` keeps the default tab. Never set without a project. */
  path: string | null;
};

/** Attendance pushes a validator receives: the bell is where the action lives. */
const BELL_KINDS = new Set([
  "submitted",
  "change_requested",
  // A member joined the company but has no project yet. The bell is the landing, not
  // /company/members: its "New members" section names who joined and links on from there.
  "member_joined",
]);

/** Kinds that open a specific project section, mapped to the section route segment. A Map
 * (not an object) so an inherited key like `constructor` cannot resolve to a bogus section. */
const SECTION_KINDS = new Map<string, string>([
  ["note_due", "notes"],
  ["invitation_accepted", "members"],
]);

/**
 * Where a tapped push lands: a manager's "to validate" push opens the bell on the project;
 * a worker's decision push just opens the project (their attendance tab is the home tab);
 * a reminder or an accepted invitation opens the project section that shows it.
 * Unknown payloads open the app without navigating.
 */
export function routeForNotification(
  data: PushData | null | undefined,
): NotificationRoute {
  const projectId =
    typeof data?.project_id === "string" && data.project_id.length > 0
      ? data.project_id
      : null;
  const kind = data?.kind;
  const sheet = kind && BELL_KINDS.has(kind) ? "notifications" : null;
  const section = kind ? SECTION_KINDS.get(kind) : undefined;
  const path =
    section && projectId ? `/projects/${projectId}/${section}` : null;
  return { projectId, sheet, path };
}
