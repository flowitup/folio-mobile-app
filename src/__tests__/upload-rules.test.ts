import i18n from "@/i18n";
import { ApiError } from "@/lib/query/api-error";
import {
  ANALYSIS_EXTENSIONS,
  DOCUMENT_EXTENSIONS,
  uploadEach,
  uploadErrorMessage,
  uploadProblem,
} from "@/lib/files/upload-rules";

/**
 * A refused upload said "Check the form and try again" (400) or "Try again" (415), with no form
 * and no file named. Each refusal now names the file and the reason, in the UI language.
 */
const t = (key: string, options?: Record<string, unknown>) =>
  i18n.t(key, options);

beforeAll(async () => {
  await i18n.changeLanguage("fr");
});

describe("upload rules", () => {
  it("refuses a type the API does not take and an empty file before sending", () => {
    expect(
      uploadProblem({ name: "métré.csv", size: 10 }, DOCUMENT_EXTENSIONS),
    ).toEqual({ kind: "unsupported", ext: ".csv" });
    expect(
      uploadProblem({ name: "vide.pdf", size: 0 }, DOCUMENT_EXTENSIONS),
    ).toEqual({ kind: "empty" });
    expect(
      uploadProblem({ name: "Plan.PDF", size: undefined }, DOCUMENT_EXTENSIONS),
    ).toBeNull();
    expect(
      uploadProblem({ name: "rapport.pdf", size: 10 }, ANALYSIS_EXTENSIONS),
    ).toEqual({ kind: "unsupported", ext: ".pdf" });
  });

  it("names the file in the server's refusals", () => {
    const file = { name: "photo.heic" };
    expect(
      uploadErrorMessage(
        new ApiError(
          415,
          "UNSUPPORTED_TYPE",
          "Extension '.heic' is not allowed",
        ),
        file,
        [".jpg"],
        t,
        "fr",
      ),
    ).toBe("photo.heic : format .heic non accepté (formats acceptés : .jpg).");
    expect(
      uploadErrorMessage(
        new ApiError(400, "EMPTY_FILE", "File is empty"),
        { name: "vide.pdf" },
        DOCUMENT_EXTENSIONS,
        t,
        "fr",
      ),
    ).toBe("vide.pdf : le fichier est vide.");
    expect(
      uploadErrorMessage(
        new ApiError(400, "InvalidEncoding", "not utf-8"),
        { name: "r.html" },
        ANALYSIS_EXTENSIONS,
        t,
        "fr",
      ),
    ).toContain("r.html : le fichier n'est pas un texte UTF-8");
  });

  it("uploads the good files and reports each refused one", async () => {
    const send = jest
      .fn()
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new ApiError(413, "FILE_TOO_LARGE", "too big"));
    const problems = await uploadEach(
      [
        { uri: "a", name: "a.pdf", mimeType: "application/pdf", size: 1 },
        { uri: "b", name: "b.zip", mimeType: "application/zip", size: 1 },
        { uri: "c", name: "c.pdf", mimeType: "application/pdf", size: 1 },
      ],
      DOCUMENT_EXTENSIONS,
      send,
      t,
      "fr",
    );
    expect(send).toHaveBeenCalledTimes(2);
    expect(problems).toEqual([
      expect.stringContaining("b.zip : format .zip non accepté"),
      "c.pdf : le fichier est trop volumineux.",
    ]);
  });
});
