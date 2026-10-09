/**
 * Attached-user label helpers: the API may omit `email`/`display_name`/`phone` on older
 * companies (see `AttachedUser`), so every caller needs the same fallback chain instead of
 * ever rendering a raw UUID. A phone sign-up's synthetic `phone-…@no-email…` address is
 * never shown: its phone number is (same rule as the project members list).
 */

import { accountContact } from "@/lib/auth/user-display-name";

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

/** Primary label: display name, else real email, else phone, else a short id — never the raw UUID. */
export function memberDisplayName(member: MemberIdentity): string {
  return (
    member.display_name ??
    accountContact(member.email, member.phone) ??
    shortUserId(member.user_id)
  );
}

/** Secondary identifier shown next to the primary label (e.g. email/phone under a display name). */
export function memberSecondaryLabel(member: MemberIdentity): string {
  return (
    accountContact(member.email, member.phone) ?? shortUserId(member.user_id)
  );
}
