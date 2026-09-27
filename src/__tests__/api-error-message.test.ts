import i18n from "@/i18n";
import { ApiError } from "@/lib/query/api-error";
import { apiErrorMessage } from "@/lib/query/api-error-message";

const t = i18n.getFixedT("fr");
const tEn = i18n.getFixedT("en");

describe("apiErrorMessage", () => {
  it("never shows the backend's English text in a French UI", () => {
    const invalid = new ApiError(
      400,
      "ValidationError",
      "Invalid input: budget",
    );
    expect(apiErrorMessage(invalid, t, "fr")).toBe(
      t("common.errors.invalidInput"),
    );
    const forbidden = new ApiError(
      403,
      "DownloadFailed",
      "Only project managers may view this",
    );
    expect(apiErrorMessage(forbidden, t, "fr")).toBe(
      t("common.errors.forbidden"),
    );
    expect(apiErrorMessage(forbidden, t, "fr")).not.toMatch(/project managers/);
  });

  it("keeps the backend's message when the UI is in English", () => {
    const conflict = new ApiError(409, "Conflict", "Number already in use");
    expect(apiErrorMessage(conflict, tEn, "en")).toBe("Number already in use");
  });

  it("translates the keep-the-extension rename error with its extension", () => {
    const rename = new ApiError(
      400,
      "INVALID_FILENAME",
      "File extension must remain .pdf",
    );
    expect(apiErrorMessage(rename, t, "fr")).toBe(
      "Le nom du fichier doit conserver l'extension .pdf.",
    );
    expect(apiErrorMessage(rename, tEn, "en")).toContain(".pdf");
  });

  it("hides framework dumps and non-API failures in every language", () => {
    const crash = new ApiError(500, "HttpError", "Traceback …");
    expect(apiErrorMessage(crash, tEn, "en")).toBe(tEn("common.requestFailed"));
    expect(apiErrorMessage(new TypeError("fetch failed"), t, "fr")).toBe(
      t("common.networkError"),
    );
  });

  it("falls back to a generic message for an unmapped status", () => {
    const odd = new ApiError(418, "Teapot", "I'm a teapot");
    expect(apiErrorMessage(odd, t, "vi")).toBe(t("common.requestFailed"));
  });
});
