/**
 * Names of chat people as the app shows them. The server sends a placeholder name for an erased
 * account ("Deleted account") or a phone sign-up without a name ("Unnamed member") together with
 * a `state`, so the reader's own language is used instead of the English placeholder.
 */
import type { TFunction } from "i18next";

export type ChatAccountState = "deleted" | "unnamed";

export function chatPersonName(
  name: string,
  state: ChatAccountState | null | undefined,
  t: TFunction,
): string {
  if (state === "deleted") return t("chat.deletedAccount");
  if (state === "unnamed") return t("chat.unnamedMember");
  return name;
}
