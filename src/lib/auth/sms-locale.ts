import i18n from "@/i18n";

/** The language an SMS code is written in: the app's (fr, en or vi), else null for the backend's default. */
export function smsLocale(): string | null {
  const language = (i18n.language ?? "").slice(0, 2).toLowerCase();
  return ["fr", "en", "vi"].includes(language) ? language : null;
}
