import type { TFunction } from "i18next";

import { formatJoinCode } from "@/lib/companies/join-code";

/** Where a new worker gets the app (store or download page); deployment setting, may be unset. */
export const APP_INSTALL_URL: string | null =
  process.env.EXPO_PUBLIC_APP_INSTALL_URL?.trim() || null;

/** The text a company admin shares with a new worker: the code, and where to get the app. */
export function joinCodeShareMessage(
  t: TFunction,
  company: string,
  code: string,
  installUrl: string | null = APP_INSTALL_URL,
): string {
  const values = { company, code: formatJoinCode(code) };
  return installUrl
    ? t("companies.admin.manage.joinCode.shareMessageWithLink", {
        ...values,
        url: installUrl,
      })
    : t("companies.admin.manage.joinCode.shareMessage", values);
}
