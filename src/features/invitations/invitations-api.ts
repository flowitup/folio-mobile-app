import { API_BASE_URL } from "@/config/env";

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
 * Creates the account + membership. The API answers with cookies only, so the caller signs in
 * with the invited email and the chosen password afterwards to obtain Bearer tokens.
 */
export async function acceptInvite(payload: {
  token: string;
  name: string;
  password: string;
}): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/invitations/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as {
        message?: string;
        error?: string;
      };
      message = body.message ?? body.error ?? message;
    } catch {
      // non-JSON
    }
    throw new Error(message);
  }
}
