import i18n from "../i18n";
import type { Invoice } from "../features/invoices/invoice-types";
import { buildInvoicePrintHtml } from "../lib/invoices/invoice-print-html";
import { invoiceTotals, lineTotalTtc } from "../lib/invoices/invoice-totals";

const items = [
  {
    description: "Carrelage",
    quantity: 10,
    unit_price: 20,
    vat_rate: 20,
    total: 240,
  },
  { description: "Pose", quantity: 1, unit_price: 100, total: 100 },
];

describe("invoice totals", () => {
  it("computes TTC per line and HT / TVA / TTC overall (legacy rows = 0 % VAT)", () => {
    expect(lineTotalTtc(items[0])).toBeCloseTo(240);
    expect(lineTotalTtc(items[1])).toBeCloseTo(100);
    const totals = invoiceTotals(items);
    expect(totals.ht).toBeCloseTo(300);
    expect(totals.tva).toBeCloseTo(40);
    expect(totals.ttc).toBeCloseTo(340);
  });

  it("rounds each line to the cent and sums the rounded lines, like the API's total", () => {
    const paint = { description: "Paint", quantity: 2.5, unit_price: 19.99 };
    expect(lineTotalTtc(paint)).toBe(49.98);
    expect(invoiceTotals([paint, paint])).toEqual({ ht: 99.96, tva: 0, ttc: 99.96 });

    const nail = { description: "Nail", quantity: 1, unit_price: 0.125 };
    expect(invoiceTotals([nail, nail])).toEqual({ ht: 0.26, tva: 0, ttc: 0.26 });

    // 1 × 5 × 1.055 is 5.2749999… in floats; the API stores 5.28.
    const plaster = { description: "Plaster", quantity: 1, unit_price: 5, vat_rate: 5.5 };
    expect(lineTotalTtc(plaster)).toBe(5.28);
    expect(invoiceTotals([plaster])).toEqual({ ht: 5, tva: 0.28, ttc: 5.28 });

    const credit = { description: "Credit", quantity: 1, unit_price: -0.125 };
    expect(invoiceTotals([credit, credit]).ttc).toBe(-0.26);
  });
});

describe("buildInvoicePrintHtml", () => {
  it("renders every item row, escapes HTML and includes the grand total", () => {
    const invoice = {
      invoice_number: "INV-7",
      issue_date: "2026-09-03",
      recipient_name: "Leroy <Merlin>",
      recipient_address: null,
      notes: "a & b",
      items,
    } as unknown as Invoice;
    const html = buildInvoicePrintHtml(invoice, "Arcueil", {
      title: "Invoice",
      issueDate: "Date",
      recipient: "To",
      description: "Desc",
      quantity: "Qty",
      unitPrice: "Unit",
      vatRate: "VAT",
      total: "Total",
      totalHt: "HT",
      totalTva: "TVA",
      totalTtc: "TTC",
      notes: "Notes",
    });
    expect(html).toContain("INV-7");
    expect(html).toContain("Leroy &lt;Merlin&gt;");
    expect(html).toContain("a &amp; b");
    expect((html.match(/<tr>/g) ?? []).length).toBe(3);
    expect(html).toContain("340");
  });
});

describe("buildInvoicePrintHtml · locale", () => {
  afterEach(async () => {
    await i18n.changeLanguage("vi");
  });

  it("prints quantities and VAT rates with a decimal comma in French", async () => {
    await i18n.changeLanguage("fr");
    const invoice = {
      invoice_number: "INV-8",
      issue_date: "2026-09-03",
      recipient_name: "Client",
      recipient_address: null,
      notes: null,
      items: [
        {
          description: "Enduit",
          quantity: 1.5,
          unit_price: 45.5,
          vat_rate: 5.5,
          total: 72.0,
        },
      ],
    } as unknown as Invoice;
    const html = buildInvoicePrintHtml(invoice, "Arcueil", {
      title: "Facture",
      issueDate: "Date",
      recipient: "À",
      description: "Désignation",
      quantity: "Qté",
      unitPrice: "PU",
      vatRate: "TVA",
      total: "Total",
      totalHt: "HT",
      totalTva: "TVA",
      totalTtc: "TTC",
      notes: "Notes",
    });
    expect(html).toContain('<td class="num">1,5</td>');
    expect(html).toContain('<td class="num">5,5 %</td>');
    expect(html).not.toContain(">1.5<");
  });
});
