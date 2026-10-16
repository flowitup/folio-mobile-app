import type { ShellSheet } from "@/components/shell/shell-context";
import { projectKeys } from "@/features/projects/projects-api";

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
  /** Attendance kinds: the day (YYYY-MM-DD) the entry is about. */
  date?: string;
  worker_id?: string;
  /** billing_status: `devis` (quote) or `facture` (invoice). */
  document_kind?: string;
};

export type NotificationRoute = {
  /** Project to select in the shell before showing the screen. */
  projectId: string | null;
  /** Sheet to open once the shell is up (managers land on the bell). */
  sheet: ShellSheet | null;
  /** Screen to land on; `null` keeps the default tab. Project sections need a project;
   * global screens (chat, my companies, billing) stand on their own. */
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

/** Company team changes an admin hears about: the company members screen lists them. */
const COMPANY_MEMBER_KINDS = new Set([
  "member_added",
  "member_role_changed",
  "member_removed",
  "member_left",
]);

/** A day was entered, changed, removed or decided: the labor calendar opens on that day. */
const ATTENDANCE_DAY_KINDS = new Set([
  "logged",
  "attendance_edited",
  "attendance_deleted",
  "validated",
  "rejected",
  "change_applied",
  "change_refused",
]);

/** An expense (invoice) was recorded, edited or removed by another admin. */
const EXPENSE_KINDS = new Set([
  "invoice_created",
  "invoice_updated",
  "invoice_deleted",
]);

/** Kinds that open a specific project section, mapped to the section route segment. A Map
 * (not an object) so an inherited key like `constructor` cannot resolve to a bogus section. */
const SECTION_KINDS = new Map<string, string>([
  ["note_due", "notes"],
  ["invitation_accepted", "members"],
]);

/** Being added to a project, or a new project: select it and open its overview. */
const PROJECT_HOME_KINDS = new Set(["project_member_added", "project_created"]);

/** The recipient's own company role or grants changed: My companies shows their role in each
 * company. Not the members screen, which is admin-only — a member only got "you don't have
 * authorization" there. */
const OWN_COMPANY_ACCESS_KINDS = new Set([
  "company_member_role_changed",
  "company_member_grants_changed",
  "company_member_added",
]);

/** Access was taken away, or the project is gone: selecting it would fail, so just open the app. */
const REMOVED_KINDS = new Set([
  "project_member_removed",
  "company_member_removed",
  "project_deleted",
]);

/** Query string from the defined values only, so a missing id never lands as "undefined". */
function withQuery(path: string, query: Record<string, string | null>): string {
  const pairs = Object.entries(query).filter(
    (entry): entry is [string, string] => Boolean(entry[1]),
  );
  return pairs.length === 0
    ? path
    : `${path}?${pairs.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")}`;
}

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
 * Where a tapped push or bell entry lands — the same table as the web bell
 * (`activity-event-row.tsx`): a manager's "to validate" push opens the bell on the project;
 * a day entered, changed or decided opens the labor calendar on that day; a worker change the
 * workers list; a reminder or an accepted invitation the project section that shows it; a
 * chat push that channel; a task push the planning tab with that task open; a refund or an
 * expense the expense itself; a billing push the document; a company team change the company
 * members; being added to a project its overview. Access removed, a deleted project or an
 * unknown payload open nothing (`path` and `projectId` null).
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
  if (kind && OWN_COMPANY_ACCESS_KINDS.has(kind)) {
    return { projectId: null, sheet: null, path: "/settings/companies" };
  }
  if (kind === "chat_report") {
    // A chat message was reported to the company admins: the company's settings screen.
    const companyId = asId(data?.company_id);
    return {
      projectId: null,
      sheet: null,
      path: companyId
        ? `/settings/companies/${companyId}`
        : "/settings/companies",
    };
  }
  if (kind && COMPANY_MEMBER_KINDS.has(kind)) {
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
  if (kind && EXPENSE_KINDS.has(kind)) {
    const invoiceId = asId(data?.invoice_id);
    // A deleted expense has no page of its own any more: open the list.
    return {
      projectId,
      sheet,
      path: !projectId
        ? null
        : invoiceId && kind !== "invoice_deleted"
          ? `/projects/${projectId}/invoices/${invoiceId}`
          : "/(app)/(tabs)/expenses",
    };
  }
  if (!projectId) {
    // Every remaining route is inside a project.
    return { projectId: null, sheet, path: null };
  }
  if (kind === "task_assigned" || kind === "task_moved") {
    return {
      projectId,
      sheet,
      // `project` lets the board wait until the shell has switched to the task's project.
      path: withQuery("/(app)/(tabs)/planning", {
        task: asId(data?.task_id),
        project: asId(data?.task_id) ? projectId : null,
      }),
    };
  }
  if (kind === "worker_added" || kind === "worker_removed") {
    return {
      projectId,
      sheet,
      path: withQuery("/(app)/(tabs)/labor", { segment: "workers" }),
    };
  }
  if (kind && ATTENDANCE_DAY_KINDS.has(kind)) {
    return {
      projectId,
      sheet,
      path: withQuery("/(app)/(tabs)/labor", {
        segment: "calendar",
        day: asId(data?.date),
      }),
    };
  }
  if (kind && PROJECT_HOME_KINDS.has(kind)) {
    return { projectId, sheet, path: "/(app)/(tabs)" };
  }
  const section = kind ? SECTION_KINDS.get(kind) : undefined;
  return {
    projectId,
    sheet,
    path: section ? `/projects/${projectId}/${section}` : null,
  };
}

const NOTIFICATIONS_KEY = ["notifications"] as const;

/** `chatKeys` prefix, spelled out for the same reason as `COMPANIES_KEY`. */
const CHAT_KEY = ["chat"] as const;

/** Pushes that change which projects the user sees: the switcher list must be refetched. */
const MEMBERSHIP_KINDS = new Set([
  "project_member_added",
  "project_member_removed",
  "project_created",
  "project_deleted",
]);

/** `companyKeys.all`, spelled out: importing companies-api would pull the auth context in here. */
const COMPANIES_KEY = ["companies"] as const;

/** Whether the push says the recipient's own company access changed (role, grants, removal). */
export function pushChangesOwnAccess(
  data: PushData | null | undefined,
): boolean {
  const kind = data?.kind;
  return Boolean(
    kind &&
    (OWN_COMPANY_ACCESS_KINDS.has(kind) || kind === "company_member_removed"),
  );
}

/** Query keys a push makes stale: always the bell, plus the chat channels and threads for a chat
 * message (so a thread opened afterwards never shows the cache from before it), the project
 * list on a membership change and the company list when the user's own company access changed. */
export function staleKeysForPush(
  data: PushData | null | undefined,
): (readonly string[])[] {
  const keys: (readonly string[])[] = [NOTIFICATIONS_KEY];
  if (data?.kind === "chat_message") keys.push(CHAT_KEY);
  if (data?.kind && MEMBERSHIP_KINDS.has(data.kind)) keys.push(projectKeys.all);
  if (pushChangesOwnAccess(data)) keys.push(COMPANIES_KEY);
  return keys;
}
