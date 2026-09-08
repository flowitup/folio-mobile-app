/**
 * Attached-user label helpers: the API may omit `email`/`display_name`/`phone` on older
 * companies (see `AttachedUser`), so every caller needs the same fallback chain instead of
 * ever rendering a raw UUID.
 */

type MemberIdentity = {
  display_name?: string | null;
  email?: string | null;
  phone?: string | null;
  user_id: string;
};

/** Short, readable stand-in for a user id when no other identity field is available. */
export function shortUserId(userId: string): string {
  return `#${userId.slice(0, 8)}`;
}

/** Primary label: display name, else email, else phone, else a short id — never the raw UUID. */
export function memberDisplayName(member: MemberIdentity): string {
  return (
    member.display_name ??
    member.email ??
    member.phone ??
    shortUserId(member.user_id)
  );
}

/** Secondary identifier shown next to the primary label (e.g. email/phone under a display name). */
export function memberSecondaryLabel(member: MemberIdentity): string {
  return member.email ?? member.phone ?? shortUserId(member.user_id);
}
