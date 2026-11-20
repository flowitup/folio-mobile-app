import type { TFunction } from "i18next";

import { normalizePhone } from "@/lib/auth/phone-number";
import { APP_INSTALL_URL } from "@/lib/companies/join-code-share";

/** "06 12 34 56 78": a French number the way its owner writes it. Anything else is returned as given. */
export function nationalFrenchPhone(phone: string): string {
  const e164 = normalizePhone(phone);
  if (!e164) return phone;
  return `0${e164.slice(3)}`.replace(/(\d{2})(?=\d)/g, "$1 ");
}

/**
 * What an admin sends someone they just added by phone. Adding texts nobody, and the number has
 * no account until its owner creates one — signing in is refused until then — so the steps say
 * to pick "Create an account", not "Sign in". The install link is the deployment's
 * `EXPO_PUBLIC_APP_INSTALL_URL`; without it, step 1 names the app only.
 */
export function memberInviteMessage(
  t: TFunction,
  company: string,
  phone: string,
  installUrl: string | null = APP_INSTALL_URL,
): string {
  const values = { company, phone: nationalFrenchPhone(phone) };
  return installUrl
    ? t("companies.members.addByPhone.added.messageWithLink", {
        ...values,
        url: installUrl,
      })
    : t("companies.members.addByPhone.added.message", values);
}
