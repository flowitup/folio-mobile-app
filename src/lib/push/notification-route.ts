import type { ShellSheet } from "@/components/shell/shell-context";

/** `data` payload the backend attaches to attendance pushes (see AttendancePushNotifier). */
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
};

const MANAGER_KINDS = new Set(["submitted", "change_requested"]);

/**
 * Where a tapped push lands: a manager's "to validate" push opens the bell on the project;
 * a worker's decision push just opens the project (their attendance tab is the home tab).
 * Unknown payloads open the app without navigating.
 */
export function routeForNotification(
  data: PushData | null | undefined,
): NotificationRoute {
  const projectId =
    typeof data?.project_id === "string" && data.project_id.length > 0
      ? data.project_id
      : null;
  const sheet =
    data?.kind && MANAGER_KINDS.has(data.kind) ? "notifications" : null;
  return { projectId, sheet };
}
