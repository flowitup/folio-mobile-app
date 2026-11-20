import type { InvoiceType } from "./invoice-types";

/** Types whose counterparty is the shop or subcontractor the money went to. */
const SUPPLIER_TYPES = new Set<InvoiceType>([
  "materials_services",
  "others",
  "return",
]);

/**
 * Translation keys naming an expense's counterparty and its date. A purchase is paid to a
 * supplier ("Nhà cung cấp") on the day it was spent ("Ngày chi"); a labor payment keeps its
 * recipient (the worker) and a release its own date. Same field (`recipient_name`) underneath.
 */
export function partyLabelKeys(type: InvoiceType) {
  const supplier = SUPPLIER_TYPES.has(type);
  return {
    date:
      type === "released_funds"
        ? "invoices.form.releaseDate"
        : "invoices.form.issueDate",
    name: supplier ? "invoices.form.supplier" : "invoices.form.recipient",
    required: supplier
      ? "invoices.form.supplierRequired"
      : "invoices.form.recipientRequired",
    address: supplier
      ? "invoices.form.supplierAddress"
      : "invoices.form.recipientAddress",
  } as const;
}
