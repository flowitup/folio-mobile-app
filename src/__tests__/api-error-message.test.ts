import i18n from "@/i18n";
import { ApiError } from "@/lib/query/api-error";
import {
  apiErrorMessage,
  isInvalidLaborRoleError,
} from "@/lib/query/api-error-message";

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

  it("says a worker is already logged elsewhere on a cross-site 409, in every language", () => {
    const conflict = new ApiError(
      409,
      "Conflict",
      "Cross-project conflicts exist; resend with acknowledge_conflicts=true to override.",
      "cross_project_conflict",
    );
    expect(apiErrorMessage(conflict, tEn, "en")).toBe(
      tEn("labor.log.conflictGeneric"),
    );
    expect(apiErrorMessage(conflict, t, "fr")).toBe(
      t("labor.log.conflictGeneric"),
    );
    expect(apiErrorMessage(conflict, t, "fr")).not.toMatch(/acknowledge/);
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

  it("tells the last admin to promote someone instead of 'refresh and try again'", () => {
    // Leave / demote / remove the company's only admin: a 409 that a refresh never fixes.
    const lastAdmin = new ApiError(
      409,
      "Conflict",
      "Company must keep at least one admin",
      "last_admin",
    );
    const tVi = i18n.getFixedT("vi");
    expect(apiErrorMessage(lastAdmin, tVi, "vi")).toBe(
      "Công ty phải có ít nhất một quản trị viên. Hãy chỉ định một thành viên khác làm quản trị viên trước.",
    );
    expect(apiErrorMessage(lastAdmin, t, "fr")).toBe(
      t("companies.errors.lastAdmin"),
    );
    expect(apiErrorMessage(lastAdmin, t, "fr")).not.toBe(
      t("common.errors.conflict"),
    );
    expect(apiErrorMessage(lastAdmin, tEn, "en")).toBe(
      tEn("companies.errors.lastAdmin"),
    );
  });

  it("falls back to a generic message for an unmapped status", () => {
    const odd = new ApiError(418, "Teapot", "I'm a teapot");
    expect(apiErrorMessage(odd, t, "vi")).toBe(t("common.requestFailed"));
  });
});

describe("apiErrorMessage — worker phone", () => {
  it("names the phone field when the API refuses a worker's phone", () => {
    const invalidPhone = new ApiError(
      400,
      "InvalidPhone",
      "Invalid phone number",
    );
    expect(apiErrorMessage(invalidPhone, t, "fr")).toBe(
      "Saisissez un numéro de téléphone valide, par ex. 06 12 34 56 78 ou +84 912 345 678.",
    );
    expect(apiErrorMessage(invalidPhone, tEn, "en")).toBe(
      tEn("common.errors.invalidPhone"),
    );
  });
});

describe("apiErrorMessage — person already on the project", () => {
  it("says the person is already a worker instead of 'refresh and try again'", () => {
    const twice = new ApiError(
      409,
      "WorkerAlreadyOnProject",
      "This person is already a worker on this project",
    );
    expect(apiErrorMessage(twice, t, "fr")).toBe(
      "Cette personne est déjà ouvrier sur ce chantier. Si elle a été désactivée, ouvrez sa fiche dans Ouvriers et touchez Réactiver.",
    );
    expect(apiErrorMessage(twice, t, "fr")).not.toBe(
      t("common.errors.conflict"),
    );
    const tVi = i18n.getFixedT("vi");
    expect(apiErrorMessage(twice, tVi, "vi")).toBe(
      tVi("labor.workers.alreadyOnProjectReactivate"),
    );
  });

  it("says how long to wait on a 429, in every language, never the limiter's text", () => {
    const limited = new ApiError(
      429,
      "TooManyRequests",
      "5 per 1 minute",
      undefined,
      40,
    );
    expect(apiErrorMessage(limited, tEn, "en")).toBe(
      tEn("common.errors.tooManyRequestsSeconds", { count: 40 }),
    );
    expect(apiErrorMessage(limited, tEn, "en")).not.toMatch(/per 1 minute/);
    const hour = new ApiError(429, "TooManyRequests", "x", undefined, 1800);
    expect(apiErrorMessage(hour, t, "fr")).toBe(
      t("common.errors.tooManyRequestsMinutes", { count: 30 }),
    );
    const unknown = new ApiError(429, "TooManyRequests", "5 per 1 minute");
    expect(apiErrorMessage(unknown, tEn, "en")).toBe(
      tEn("common.errors.tooManyRequests"),
    );
  });
});

describe("apiErrorMessage — labor role refused", () => {
  it("says the role is no longer available, with the new code or an older API's message", () => {
    const coded = new ApiError(400, "InvalidLaborRole", "Labor role not found");
    const legacy = new ApiError(400, "ValidationError", "Labor role not found");
    expect(apiErrorMessage(coded, t, "fr")).toBe(
      t("labor.errors.roleUnavailable"),
    );
    expect(apiErrorMessage(legacy, tEn, "en")).toBe(
      tEn("labor.errors.roleUnavailable"),
    );
    expect(isInvalidLaborRoleError(coded)).toBe(true);
    expect(
      isInvalidLaborRoleError(
        new ApiError(400, "ValidationError", "Invalid input"),
      ),
    ).toBe(false);
  });
});
