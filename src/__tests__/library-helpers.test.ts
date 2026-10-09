import {
  parseImportPayload,
  sortPurchasesNewestFirst,
} from "@/features/library/library-helpers";
import type { LibraryPurchase } from "@/features/library/library-types";

const record = {
  supplier_reference: "REF1",
  product_name: "Vis",
  quantity: "2",
  unit_price: "1.5",
  purchased_at: "2026-01-01T00:00:00Z",
  source_document_ref: "T1",
  source_document_type: "ticket",
  line_index: 0,
};

describe("parseImportPayload", () => {
  it("injects the company and keeps optional supplier fields", () => {
    const payload = parseImportPayload(
      JSON.stringify({
        supplier_name: "Leroy Merlin",
        supplier_slug: "leroy-merlin",
        supplier_website_url: "https://lm.fr",
        records: [record],
      }),
      "c1",
    );
    expect(payload).toMatchObject({
      company_id: "c1",
      supplier_slug: "leroy-merlin",
      supplier_website_url: "https://lm.fr",
      supplier_product_url_template: null,
    });
    expect(payload?.records).toHaveLength(1);
  });

  it("rejects non-JSON, missing keys and incomplete records", () => {
    expect(parseImportPayload("nope", "c1")).toBeNull();
    expect(
      parseImportPayload(JSON.stringify({ records: [record] }), "c1"),
    ).toBeNull();
    expect(
      parseImportPayload(
        JSON.stringify({
          supplier_name: "x",
          supplier_slug: "x",
          records: [{ product_name: "a" }],
        }),
        "c1",
      ),
    ).toBeNull();
  });
});

describe("sortPurchasesNewestFirst", () => {
  const purchase = (purchased_at: string, ref: string): LibraryPurchase => ({
    product_id: "p1",
    source_document_ref: ref,
    source_document_type: "ticket",
    line_index: 0,
    purchased_at,
    quantity: "1",
    unit_price: "9.5",
  });

  it("orders the RFC-1123 days by date, not by weekday name", () => {
    const sorted = sortPurchasesNewestFirst([
      purchase("Tue, 01 Sep 2026 00:00:00 GMT", "T1"),
      purchase("Wed, 01 Jan 2025 00:00:00 GMT", "T0"),
      purchase("Mon, 12 Oct 2026 00:00:00 GMT", "T4"),
      purchase("Sun, 06 Sep 2026 00:00:00 GMT", "T3"),
      purchase("Thu, 03 Sep 2026 00:00:00 GMT", "T2"),
    ]);
    expect(sorted.map((p) => p.source_document_ref)).toEqual([
      "T4",
      "T3",
      "T2",
      "T1",
      "T0",
    ]);
  });

  it("keeps the API order for purchases of the same day", () => {
    const sorted = sortPurchasesNewestFirst([
      purchase("Thu, 03 Sep 2026 00:00:00 GMT", "A"),
      purchase("2026-09-03", "B"),
    ]);
    expect(sorted.map((p) => p.source_document_ref)).toEqual(["A", "B"]);
  });
});
