import { API_BASE_URL } from "@/config/env";

import type { components } from "@/api/generated/schema";

export interface VerifyInviteResponse {
  email: string;
  expires_at: string;
  inviter_name: string;
  project_name: string;
  role_name: string;
}

export type InviteErrorReason =
  "expired" | "revoked" | "accepted" | "not_found";

/** Unauthenticated: 200 → details, 404 → not_found, 410 → reason from the body (default expired). */
export async function verifyInvite(
  token: string,
): Promise<VerifyInviteResponse | { error: InviteErrorReason }> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/invitations/verify/${encodeURIComponent(token)}`,
  );
  if (response.status === 404) return { error: "not_found" };
  if (response.status === 410) {
    try {
      const body = (await response.json()) as { reason?: InviteErrorReason };
      if (
        body.reason === "expired" ||
        body.reason === "revoked" ||
        body.reason === "accepted"
      )
        return { error: body.reason };
    } catch {
      // unreadable body
    }
    return { error: "expired" };
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as VerifyInviteResponse;
}

/**
 * Reasons `requestInviteCode`/`acceptInvite` can fail with, beyond the token-level
 * `InviteErrorReason` (expired/revoked/accepted/not_found) both endpoints can also raise.
 */
export type InviteActionErrorReason =
  | InviteErrorReason
  | "invalid_phone"
  | "phone_registered"
  | "invalid_code"
  | "throttled"
  | "sms_failed"
  | "generic";

/** Session an accepted invitation hands back — the invitee is signed in from this point. */
export type AcceptedSession = components["schemas"]["AcceptInviteResponse"];

/** Thrown by `requestInviteCode` and `acceptInvite`; `reason` drives which message the screen shows. */
export class InviteActionError extends Error {
  reason: InviteActionErrorReason;

  constructor(reason: InviteActionErrorReason, message?: string) {
    super(message ?? reason);
    this.name = "InviteActionError";
    this.reason = reason;
  }
}

/** Reads the error body both invite-acceptance endpoints share and classifies it by status. */
async function inviteActionError(
  response: Response,
): Promise<InviteActionError> {
  let body: { reason?: string; message?: string } = {};
  try {
    body = (await response.json()) as typeof body;
  } catch {
    // Non-JSON body — e.g. the rate limiter's own 429 page rather than our ErrorResponse shape.
  }
  switch (response.status) {
    case 400:
      return new InviteActionError("invalid_phone", body.message);
    case 401:
      return new InviteActionError("invalid_code", body.message);
    case 404:
      return new InviteActionError("not_found", body.message);
    case 409:
      return new InviteActionError(
        body.reason === "phone_registered" ? "phone_registered" : "generic",
        body.message,
      );
    case 410:
      if (
        body.reason === "expired" ||
        body.reason === "revoked" ||
        body.reason === "accepted"
      )
        return new InviteActionError(body.reason, body.message);
      return new InviteActionError("expired", body.message);
    case 429:
      return new InviteActionError("throttled", body.message);
    case 503:
      return new InviteActionError("sms_failed", body.message);
    default:
      return new InviteActionError(
        "generic",
        body.message ?? `HTTP ${response.status}`,
      );
  }
}

/**
 * Texts a 6-digit code to the phone number an invitee is claiming. Public: the invitation
 * token (not a session) is the authorisation, same shape as phone sign-up's request step.
 */
export async function requestInviteCode(payload: {
  token: string;
  phone: string;
}): Promise<{ expiresIn: number }> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/invitations/accept/request-code`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  if (!response.ok) throw await inviteActionError(response);
  const body = (await response.json()) as { expires_in: number };
  return { expiresIn: body.expires_in };
}

/**
 * Creates the account + project membership from a name, a phone proven by the SMS code, and
 * the invitation token. Acceptance signs the invitee in: the backend returns the session tokens
 * in the body (as well as setting cookies for browser clients), so the caller can hand them
 * straight to the auth context instead of sending the invitee through sign-in for a second code.
 */
export async function acceptInvite(payload: {
  token: string;
  name: string;
  phone: string;
  code: string;
}): Promise<AcceptedSession> {
  const response = await fetch(`${API_BASE_URL}/api/v1/invitations/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw await inviteActionError(response);
  return (await response.json()) as AcceptedSession;
}
