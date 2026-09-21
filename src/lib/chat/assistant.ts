/**
 * Pure helpers for the assistant conversation: channel ordering, the three rich content
 * payload shapes (`card` / `choice` / `job_status`), and their badge/status → i18n mappings.
 * Kept dependency-free (no React, no API client) so they are trivial to unit test.
 */

/** Pins the `assistant` channel first without otherwise reordering the API's own list. */
export function orderChannels<T extends { kind: string }>(channels: T[]): T[] {
  const assistant = channels.filter((channel) => channel.kind === "assistant");
  const rest = channels.filter((channel) => channel.kind !== "assistant");
  return [...assistant, ...rest];
}

export type AssistantCardBadge = "confirmed" | "to_confirm" | "needs_review";

export interface AssistantCardPayload {
  type: "invoice" | "material";
  id: string;
  projectId: string | null;
  title: string;
  subtitle: string | null;
  badge: AssistantCardBadge | null;
  thumbnailUrl: string | null;
}

export interface AssistantChoiceOption {
  label: string;
  action: string;
  payload: Record<string, unknown>;
}

export interface AssistantChoicePayload {
  prompt: string;
  options: AssistantChoiceOption[];
  answered: string | null;
  /** The option payload the server recorded with the answer (absent on older servers). */
  answeredPayload: Record<string, unknown> | null;
}

/** Stable comparison of two option payloads (key order does not matter). */
function samePayload(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): boolean {
  const normalise = (value: unknown): string =>
    JSON.stringify(value, (_key, inner) =>
      isRecord(inner) && !Array.isArray(inner)
        ? Object.fromEntries(
            Object.keys(inner)
              .sort()
              .map((k) => [k, inner[k]]),
          )
        : inner,
    );
  return normalise(a) === normalise(b);
}

/**
 * Whether `option` is the one that answered the choice. Several options can share an
 * action (two "set_project" buttons differ only by payload), so the action alone is not
 * enough; the recorded payload decides when the server (or the local tap) provides it.
 */
export function isChosenOption(
  option: AssistantChoiceOption,
  answered: string | null,
  answeredPayload: Record<string, unknown> | null,
): boolean {
  if (answered === null || answered !== option.action) return false;
  if (answeredPayload === null) return true;
  return samePayload(option.payload, answeredPayload);
}

export type AssistantJobState =
  | "queued"
  | "running"
  | "not_ready"
  | "blocked"
  | "done"
  | "failed"
  | "not_found";

export interface AssistantJobStatusPayload {
  jobId: string;
  state: AssistantJobState;
  text: string;
  progress: number | null;
}

/** The shape `MessageResponse.payload` carries: an untyped JSON object, or `null`. */
export type RawPayload = Record<string, unknown> | null | undefined;

const BADGES: readonly AssistantCardBadge[] = [
  "confirmed",
  "to_confirm",
  "needs_review",
];
const JOB_STATES: readonly AssistantJobState[] = [
  "queued",
  "running",
  "not_ready",
  "blocked",
  "done",
  "failed",
  "not_found",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Parses a `content_type: "card"` payload; `null` on anything malformed (renders as text instead). */
export function parseCardPayload(raw: RawPayload): AssistantCardPayload | null {
  if (!isRecord(raw) || !isRecord(raw.card)) return null;
  const card = raw.card;
  if (
    (card.type !== "invoice" && card.type !== "material") ||
    typeof card.id !== "string" ||
    typeof card.title !== "string"
  )
    return null;
  return {
    type: card.type,
    id: card.id,
    projectId: typeof card.project_id === "string" ? card.project_id : null,
    title: card.title,
    subtitle: typeof card.subtitle === "string" ? card.subtitle : null,
    badge: BADGES.includes(card.badge as AssistantCardBadge)
      ? (card.badge as AssistantCardBadge)
      : null,
    thumbnailUrl:
      typeof card.thumbnail_url === "string" ? card.thumbnail_url : null,
  };
}

/** Parses a `content_type: "choice"` payload; `null` on anything malformed. */
export function parseChoicePayload(
  raw: RawPayload,
): AssistantChoicePayload | null {
  if (
    !isRecord(raw) ||
    typeof raw.prompt !== "string" ||
    !Array.isArray(raw.options)
  )
    return null;
  const options: AssistantChoiceOption[] = [];
  for (const entry of raw.options) {
    if (
      !isRecord(entry) ||
      typeof entry.label !== "string" ||
      typeof entry.action !== "string"
    )
      return null;
    options.push({
      label: entry.label,
      action: entry.action,
      payload: isRecord(entry.payload) ? entry.payload : {},
    });
  }
  return {
    prompt: raw.prompt,
    options,
    answered: typeof raw.answered === "string" ? raw.answered : null,
    answeredPayload: isRecord(raw.answered_payload)
      ? raw.answered_payload
      : null,
  };
}

/** Parses a `content_type: "job_status"` payload; `null` on anything malformed. */
export function parseJobStatusPayload(
  raw: RawPayload,
): AssistantJobStatusPayload | null {
  if (
    !isRecord(raw) ||
    typeof raw.job_id !== "string" ||
    typeof raw.text !== "string" ||
    !JOB_STATES.includes(raw.state as AssistantJobState)
  )
    return null;
  return {
    jobId: raw.job_id,
    state: raw.state as AssistantJobState,
    text: raw.text,
    progress: typeof raw.progress === "number" ? raw.progress : null,
  };
}

/** i18n key for a card's badge label. */
export const ASSISTANT_BADGE_I18N_KEY: Record<AssistantCardBadge, string> = {
  confirmed: "assistant.badgeConfirmed",
  to_confirm: "assistant.badgeToConfirm",
  needs_review: "assistant.badgeNeedsReview",
};

/** `Badge` component tone for a card's badge. */
export const ASSISTANT_BADGE_TONE: Record<
  AssistantCardBadge,
  "success" | "warning" | "danger"
> = {
  confirmed: "success",
  to_confirm: "warning",
  needs_review: "danger",
};

/** i18n key for a job's state label. `not_found` has no key in the phase spec's list; the
 * app still needs a label for it (an unknown job id is a real, if rare, server answer), so it
 * reuses the same `assistant.status*` naming the spec set for the other six states. */
export const ASSISTANT_JOB_STATUS_I18N_KEY: Record<AssistantJobState, string> =
  {
    queued: "assistant.statusQueued",
    running: "assistant.statusRunning",
    not_ready: "assistant.statusNotReady",
    blocked: "assistant.statusBlocked",
    done: "assistant.statusDone",
    failed: "assistant.statusFailed",
    not_found: "assistant.statusNotFound",
  };
