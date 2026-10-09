import { accountContact } from "@/lib/auth/user-display-name";

type MemberLike = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  phone?: string | null;
};

/**
 * The worker form's "App account" option for a project member: name and contact, never
 * the synthetic `phone-…@no-email…` address a phone sign-up gets (its phone stands in).
 */
export function accountOptionLabel(member: MemberLike): string {
  return (
    [member.display_name?.trim(), accountContact(member.email, member.phone)]
      .filter(Boolean)
      .join(" · ") || member.user_id
  );
}
