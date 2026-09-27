import type { TFunction } from "i18next";

import {
  draftFromSeed,
  validateDraft,
} from "@/features/billing/billing-document-form";
import { fileExtension, renameProblem } from "@/lib/files/rename-rules";
import { isHexColor } from "@/lib/labor/labor-role-label";

/** The messages are i18n keys here, which is all these assertions need to tell them apart. */
const t = ((key: string) => key) as unknown as TFunction;

describe("renameProblem", () => {
  it("reads extensions the way the backend does", () => {
    expect(fileExtension("Plan.PDF")).toBe(".pdf");
    expect(fileExtension(".env")).toBe("");
    expect(fileExtension("archive.tar.gz")).toBe(".gz");
  });

  it("refuses a blank name and a changed or dropped extension", () => {
    expect(renameProblem("plan.pdf", "   ")).toBe("empty");
    expect(renameProblem("plan.pdf", "QA-mobB renamed")).toBe("extension");
    expect(renameProblem("plan.pdf", "plan.docx")).toBe("extension");
  });

  it("accepts a new name that keeps the extension, in any case", () => {
    expect(renameProblem("plan.pdf", "Plan final.PDF")).toBeNull();
  });
});

describe("isHexColor", () => {
  it("accepts only # and six hexadecimal digits", () => {
    expect(isHexColor("#E11D48")).toBe(true);
    expect(isHexColor("#e11d48")).toBe(true);
    expect(isHexColor("#E11D48ZZ")).toBe(false);
    expect(isHexColor("E11D48")).toBe(false);
    expect(isHexColor("#FFF")).toBe(false);
  });
});

describe("validateDraft · recipient email", () => {
  const draft = (recipient_email: string) => ({
    ...draftFromSeed("devis", { recipient_name: "Client" }),
    recipient_email,
  });

  it("flags a malformed address before the request", () => {
    expect(validateDraft(t, draft("not-an-email"), "edit").errors).toEqual(
      expect.objectContaining({
        recipient_email: "billing.form.errors.emailInvalid",
      }),
    );
  });

  it("accepts a blank or well-formed address", () => {
    for (const email of ["", "  ", "name@example.com"])
      expect(
        validateDraft(t, draft(email), "edit").errors.recipient_email,
      ).toBeUndefined();
  });
});
