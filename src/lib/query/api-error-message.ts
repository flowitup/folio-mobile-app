import { ApiError } from "@/lib/query/api-error";

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** A framework dump (5xx, or a Pydantic "N validation errors for …" report) is not user copy. */
function isUnreadable(error: ApiError): boolean {
  return (
    error.status >= 500 ||
    /validation errors? for |pydantic\.dev/i.test(error.message)
  );
}

// The backend writes its messages in English only, so outside English a status says more
// than the text does.
const STATUS_KEYS: Record<number, string> = {
  400: "common.errors.invalidInput",
  401: "common.errors.unauthorized",
  403: "common.errors.forbidden",
  404: "common.errors.notFound",
  409: "common.errors.conflict",
  410: "common.errors.gone",
  413: "common.errors.tooLarge",
  422: "common.errors.invalidInput",
  429: "common.errors.tooManyRequests",
};

/**
 * User-facing text for a failed request, in the UI language. The backend's own message is
 * shown only when the UI is in English, the language it is written in; other languages get
 * a translated message chosen from the error code or the HTTP status.
 */
export function apiErrorMessage(
  error: unknown,
  t: Translate,
  language: string,
): string {
  if (!(error instanceof ApiError)) return t("common.networkError");
  if (isUnreadable(error)) return t("common.requestFailed");
  const extension = /extension must remain (\.\w+)/i.exec(error.message);
  if (error.code === "INVALID_FILENAME" && extension)
    return t("common.errors.keepExtension", { ext: extension[1] });
  if (language === "en") return error.message;
  const key = STATUS_KEYS[error.status];
  return key ? t(key) : t("common.requestFailed");
}
