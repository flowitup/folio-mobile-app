import type { TFunction } from "i18next";

import { isLibraryCategorySlug } from "./library-types";
import type { ImportPayload, ImportRecord } from "./library-types";

export const PAGE_SIZE = 20;
export const MAX_COMPARE = 4;

/** Known slug → i18n label; null → "uncategorised"; unknown legacy value → raw. */
export function localizeCategory(
  t: TFunction,
  value: string | null | undefined,
): string {
  if (!value) return t("library.uncategorized");
  if (isLibraryCategorySlug(value)) return t(`library.categories.${value}`);
  return value;
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
    raw = JSON.parse(text);
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
