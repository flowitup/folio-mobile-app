import { parseImportPayload } from "@/features/library/library-helpers";

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
