import type { TFunction } from "i18next";

import {
  hasItemErrors,
  itemsToPayload,
  validateItems,
} from "@/features/billing/billing-items-editor";
import type { ItemDraft } from "@/features/billing/billing-items-editor";

/** The messages are i18n keys here, which is all these assertions need to tell them apart. */
const t = ((key: string) => key) as unknown as TFunction;

const line = (overrides: Partial<ItemDraft> = {}): ItemDraft => ({
  description: "Carrelage",
  quantity: "2",
  unit_price: "10",
  vat_rate: "20",
  category: "",
  ...overrides,
});

describe("validateItems", () => {
  it("passes a well-formed line", () => {
    expect(hasItemErrors(validateItems(t, [line()]))).toBe(false);
  });

  it("reports each broken field under the field that owns it", () => {
    // All four at once: the form marks every offending input rather than making the user
    // submit again to discover the next complaint.
    const errors = validateItems(t, [
      line({
        description: "  ",
        quantity: "0",
        unit_price: "-1",
        vat_rate: "120",
      }),
    ]);

    expect(errors[0]).toEqual({
      description: "billing.form.errors.itemDescriptionRequired",
      quantity: "billing.form.errors.itemQuantityPositive",
      unit_price: "billing.form.errors.itemUnitPricePositive",
      vat_rate: "billing.form.errors.itemVatRatePositive",
    });
  });

  it("complains about the quantity alone when only the quantity is wrong", () => {
    const errors = validateItems(t, [line({ quantity: "deux" })]);
    expect(errors[0]).toEqual({
      quantity: "billing.form.errors.itemQuantityPositive",
    });
  });

  it("accepts an amount typed the French way", () => {
    // "1 234,50" used to fail both the check and the payload: only the first comma was
    // swapped for a dot and the thousands space stayed, leaving an unparsable string.
    const errors = validateItems(t, [line({ unit_price: "1 234,50" })]);
    expect(errors[0]).toBeUndefined();
    expect(itemsToPayload([line({ unit_price: "1 234,50" })])[0]).toMatchObject(
      { unit_price: "1234.5" },
    );
  });

  it("treats an empty unit price as zero and an empty quantity as missing", () => {
    const errors = validateItems(t, [line({ unit_price: "", quantity: "" })]);
    expect(errors[0]).toEqual({
      quantity: "billing.form.errors.itemQuantityPositive",
    });
  });

  it("keys the errors by line index", () => {
    const errors = validateItems(t, [line(), line({ quantity: "0" })]);
    expect(errors[0]).toBeUndefined();
    expect(errors[1]?.quantity).toBe(
      "billing.form.errors.itemQuantityPositive",
    );
  });
});
