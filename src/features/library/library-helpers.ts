import type { TFunction } from "i18next";

import { parseIsoDate } from "@/lib/format/date";

import { isLibraryCategorySlug } from "./library-types";
import type {
  ImportPayload,
  ImportRecord,
  LibraryPurchase,
} from "./library-types";

export const PAGE_SIZE = 20;
export const MAX_COMPARE = 4;

/** Only web links may be shown and opened from a product: `tel:`, `sms:` and app schemes launch other handlers. */
export function isHttpUrl(url: string | null | undefined): url is string {
  return !!url && /^https?:\/\//i.test(url.trim());
}

/** Known slug → i18n label; null → "uncategorised"; unknown legacy value → raw. */
export function localizeCategory(
  t: TFunction,
  value: string | null | undefined,
): string {
  if (!value) return t("library.uncategorized");
  if (isLibraryCategorySlug(value)) return t(`library.categories.${value}`);
  return value;
}

/**
 * Purchase history, newest first. `purchased_at` is RFC-1123 text (`Sun, 06 Sep 2026 00:00:00 GMT`),
 * so compare days, not strings (those sort by weekday). Same-day purchases keep the API order.
 */
export function sortPurchasesNewestFirst(
  purchases: readonly LibraryPurchase[],
): LibraryPurchase[] {
  const day = (purchase: LibraryPurchase) =>
    parseIsoDate(purchase.purchased_at)?.getTime() ?? 0;
  return [...purchases].sort((a, b) => day(b) - day(a));
}

const RECORD_KEYS: (keyof ImportRecord)[] = [
  "supplier_reference",
  "product_name",
  "quantity",
  "unit_price",
  "purchased_at",
  "source_document_ref",
  "source_document_type",
  "line_index",
];

/**
 * Straightens the curly quotes and non-breaking spaces iOS and desktop mail clients
 * substitute while the export is copied around: they are invisible to the person pasting
 * and make `JSON.parse` reject an otherwise valid export.
 */
function normalizeJsonPunctuation(text: string): string {
  return text
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u00A0\u2007\u202F]/g, " ");
}

/**
 * Parses pasted / picked JSON into an import payload. Accepts the backend body shape
 * (`supplier_name`, `supplier_slug`, `records[]`); `company_id` is injected by the caller.
 * Returns null when the text is not JSON or the required keys are missing.
 */
export function parseImportPayload(
  text: string,
  companyId: string,
): ImportPayload | null {
  let raw: unknown;
  try {
    raw = JSON.parse(normalizeJsonPunctuation(text));
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  const body = raw as Record<string, unknown>;
  const records = body.records;
  if (
    typeof body.supplier_name !== "string" ||
    typeof body.supplier_slug !== "string" ||
    !Array.isArray(records) ||
    records.length === 0
  )
    return null;
  const valid = records.every(
    (record) =>
      record &&
      typeof record === "object" &&
      RECORD_KEYS.every((key) => key in (record as Record<string, unknown>)),
  );
  if (!valid) return null;
  return {
    company_id: companyId,
    supplier_name: body.supplier_name,
    supplier_slug: body.supplier_slug,
    supplier_website_url:
      typeof body.supplier_website_url === "string"
        ? body.supplier_website_url
        : null,
    supplier_product_url_template:
      typeof body.supplier_product_url_template === "string"
        ? body.supplier_product_url_template
        : null,
    records: records as ImportRecord[],
  };
}

/**
 * The supplier reference to show, or null. A product saved without one gets a generated
 * `manual-<hex>` placeholder server side, which means nothing to the user.
 */
export function displayedSupplierReference(
  reference: string | null | undefined,
): string | null {
  const value = (reference ?? "").trim();
  if (!value || /^manual-[0-9a-f]+$/i.test(value)) return null;
  return value;
}

/** A one-line example of the import JSON, to show the expected shape before a real export. */
export const IMPORT_SAMPLE = JSON.stringify(
  {
    supplier_name: "Leroy Merlin",
    supplier_slug: "leroy-merlin",
    records: [
      {
        supplier_reference: "70188561",
        product_name: "Sac de ciment 35 kg",
        quantity: "2",
        unit_price: "9.90",
        purchased_at: "2026-09-01",
        source_document_ref: "TICKET-0001",
        source_document_type: "ticket",
        line_index: 0,
      },
    ],
  },
  null,
  2,
);
