import type { ShellSheet } from "@/components/shell/shell-context";

/** `data` payload the backend attaches to pushes: a flat string map, `kind` drives routing
 * (see `app/application/push/*_notifier.py`). */
export type PushData = {
  kind?: string;
  project_id?: string;
  entry_id?: string;
  /** chat_message: `company:<uuid>` / `project:<uuid>` */
  channel_key?: string;
  task_id?: string;
  invoice_id?: string;
  document_id?: string;
  company_id?: string;
  status?: string;
};

export type NotificationRoute = {
  /** Project to select in the shell before showing the screen. */
  projectId: string | null;
  /** Sheet to open once the shell is up (managers land on the bell). */
  sheet: ShellSheet | null;
  /** Screen to land on; `null` keeps the default tab. Project sections need a project;
   * global screens (chat, company members, billing) stand on their own. */
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

/** Project-scoped tabs a push can land on; selecting the project comes first. */
const PROJECT_TAB_KINDS = new Map<string, string>([
  ["task_assigned", "/(app)/(tabs)/planning"],
  ["task_moved", "/(app)/(tabs)/planning"],
]);

/** Kinds about somebody's company access: the members screen shows the new state. */
const COMPANY_MEMBERS_KINDS = new Set([
  "company_member_role_changed",
  "company_member_grants_changed",
]);

/** Access was taken away: selecting the project/company would fail, so just open the app. */
const REMOVED_KINDS = new Set([
  "project_member_removed",
  "company_member_removed",
]);

function asId(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** `project:<uuid>` chat keys name the project the shell should select. */
function projectFromChannelKey(key: string | null): string | null {
  return key && key.startsWith("project:")
    ? asId(key.slice("project:".length))
    : null;
}

/**
 * Where a tapped push lands: a manager's "to validate" push opens the bell on the project;
 * a worker's decision push just opens the project (their attendance tab is the home tab);
 * a reminder or an accepted invitation opens the project section that shows it; a chat
 * push opens that channel; a task push the planning tab; a refund the expense itself; a
 * billing push the document. Unknown payloads open the app without navigating.
 */
export function routeForNotification(
  data: PushData | null | undefined,
): NotificationRoute {
  const kind = data?.kind;
  if (kind && REMOVED_KINDS.has(kind)) {
    return { projectId: null, sheet: null, path: null };
  }
  if (kind === "chat_message") {
    const channelKey = asId(data?.channel_key);
    return {
      projectId: projectFromChannelKey(channelKey),
      sheet: null,
      path: channelKey
        ? `/chat?channel=${encodeURIComponent(channelKey)}`
        : "/chat",
    };
  }
  if (kind && COMPANY_MEMBERS_KINDS.has(kind)) {
    return { projectId: null, sheet: null, path: "/company/members" };
  }
  if (kind === "billing_status") {
    const documentId = asId(data?.document_id);
    return {
      projectId: null,
      sheet: null,
      path: documentId
        ? `/billing/documents/${documentId}`
        : "/(app)/(tabs)/billing",
    };
  }

  const projectId = asId(data?.project_id);
  const sheet = kind && BELL_KINDS.has(kind) ? "notifications" : null;
  if (kind === "refund_requested" || kind === "refund_completed") {
    const invoiceId = asId(data?.invoice_id);
    return {
      projectId,
      sheet,
      path:
        projectId && invoiceId
          ? `/projects/${projectId}/invoices/${invoiceId}`
          : projectId
            ? "/(app)/(tabs)/expenses"
            : null,
    };
  }
  const tab = kind ? PROJECT_TAB_KINDS.get(kind) : undefined;
  const section = kind ? SECTION_KINDS.get(kind) : undefined;
  const path =
    tab && projectId
      ? tab
      : section && projectId
        ? `/projects/${projectId}/${section}`
        : null;
  return { projectId, sheet, path };
}
