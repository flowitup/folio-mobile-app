import type { TFunction } from "i18next";

import {
  draftFromSeed,
  validateDraft,
} from "@/features/billing/billing-document-form";
import { missingIssuerFields } from "@/features/billing/issuer-profile-warning";
import {
  nextRefundableOffset,
  type RefundableListResponse,
} from "@/features/billing/refundable-api";
import { displayedSupplierReference } from "@/features/library/library-helpers";
import {
  isQuantityTooLarge,
  MAX_INVENTORY_QUANTITY,
  parseQuantity,
} from "@/lib/inventory/inventory-helpers";

jest.mock("@/api/client", () => ({ api: {} }));

/** The messages are i18n keys here, which is all these assertions need to tell them apart. */
const t = ((key: string) => key) as unknown as TFunction;

describe("billing draft dates", () => {
  it("refuses a facture due before its issue date, on the due-date field", () => {
    const draft = {
      ...draftFromSeed("facture", null),
      company_id: "c1",
      recipient_name: "Client",
      issue_date: "2026-11-15",
      payment_due_date: "2026-10-31",
    };
    expect(validateDraft(t, draft, "create", "facture").errors).toEqual({
      payment_due_date: "billing.form.errors.dueBeforeIssue",
    });
  });

  it("refuses a devis valid until before its issue date", () => {
    const draft = {
      ...draftFromSeed("devis", null),
      company_id: "c1",
      recipient_name: "Client",
      issue_date: "2026-11-15",
      validity_until: "2026-11-14",
    };
    expect(validateDraft(t, draft, "create", "devis").errors).toEqual({
      validity_until: "billing.form.errors.validityBeforeIssue",
    });
  });

  it("accepts the same day and no date at all", () => {
    const draft = {
      ...draftFromSeed("facture", null),
      company_id: "c1",
      recipient_name: "Client",
      issue_date: "2026-11-15",
    };
    expect(
      validateDraft(t, { ...draft, payment_due_date: "2026-11-15" }, "create", "facture")
        .errors,
    ).toEqual({});
    expect(
      validateDraft(t, { ...draft, payment_due_date: null }, "create", "facture")
        .errors,
    ).toEqual({});
  });
});

describe("missingIssuerFields", () => {
  it("lists the blank legal mentions of the issuing company", () => {
    expect(
      missingIssuerFields({ siret: "", tva_number: null, iban: " " }),
    ).toEqual(["siret", "tva_number", "iban"]);
    expect(
      missingIssuerFields({
        siret: "12345678901234",
        tva_number: "FR12345678901",
        iban: null,
      }),
    ).toEqual(["iban"]);
    expect(missingIssuerFields(null)).toEqual([]);
  });
});

describe("inventory quantity", () => {
  it("stops at the API maximum and says so", () => {
    expect(parseQuantity(String(MAX_INVENTORY_QUANTITY))).toBe(
      MAX_INVENTORY_QUANTITY,
    );
    expect(parseQuantity("99999999999")).toBeNull();
    expect(isQuantityTooLarge("99999999999")).toBe(true);
    expect(isQuantityTooLarge("12")).toBe(false);
    expect(isQuantityTooLarge("-1")).toBe(false);
  });
});

describe("displayedSupplierReference", () => {
  it("hides the generated manual- placeholder", () => {
    expect(displayedSupplierReference("manual-5e7ea6ca3685")).toBeNull();
    expect(displayedSupplierReference("  ")).toBeNull();
    expect(displayedSupplierReference(null)).toBeNull();
    expect(displayedSupplierReference("70188561")).toBe("70188561");
    expect(displayedSupplierReference("manual-ref Bosch")).toBe(
      "manual-ref Bosch",
    );
  });
});

describe("nextRefundableOffset", () => {
  const page = (n: number, total: number): RefundableListResponse => ({
    items: Array.from({ length: n }, () => ({}) as never),
    total,
    summary: null,
  });

  it("asks for the next page until every row is loaded", () => {
    const first = page(50, 212);
    expect(nextRefundableOffset(first, [first])).toBe(50);
    const last = page(12, 212);
    const pages = [page(50, 212), page(50, 212), page(50, 212), page(50, 212), last];
    expect(nextRefundableOffset(last, pages)).toBeUndefined();
  });

  it("stops on an empty page even if the total says more", () => {
    const empty = page(0, 300);
    expect(nextRefundableOffset(empty, [page(50, 300), empty])).toBeUndefined();
  });
});
