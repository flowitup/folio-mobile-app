import type { Invoice } from "@/features/invoices/invoice-types";
import { formatDate } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";

import { invoiceTotals, lineTotalTtc } from "./invoice-totals";

function escapeHtml(value: string | null | undefined): string {
  return (value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ] ?? char,
  );
}

type Labels = {
  title: string;
  issueDate: string;
  recipient: string;
  description: string;
  quantity: string;
  unitPrice: string;
  vatRate: string;
  total: string;
  totalHt: string;
  totalTva: string;
  totalTtc: string;
  notes: string;
};

/** Self-contained HTML for expo-print, mirroring the web print page (items table + HT/TVA/TTC). */
export function buildInvoicePrintHtml(
  invoice: Invoice,
  projectName: string,
  labels: Labels,
): string {
  const totals = invoiceTotals(invoice.items);
  const rows = invoice.items
    .map(
      (item) => `<tr>
        <td>${escapeHtml(item.description)}</td>
        <td class="num">${item.quantity}</td>
        <td class="num">${escapeHtml(formatMoney(item.unit_price))}</td>
        <td class="num">${item.vat_rate ?? 0} %</td>
        <td class="num">${escapeHtml(formatMoney(lineTotalTtc(item)))}</td>
      </tr>`,
    )
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:-apple-system,Helvetica,Arial,sans-serif;color:#171717;padding:32px;font-size:13px}
    h1{font-size:20px;margin:0 0 4px} .muted{color:#737373} table{width:100%;border-collapse:collapse;margin-top:24px}
    th,td{border-bottom:1px solid #e5e5e5;padding:8px 6px;text-align:left;vertical-align:top} th{font-size:11px;text-transform:uppercase;color:#737373}
    td.num,th.num{text-align:right;white-space:nowrap} .totals{margin-top:16px;margin-left:auto;width:260px}
    .totals div{display:flex;justify-content:space-between;padding:4px 0} .totals .grand{font-weight:700;border-top:1px solid #171717;margin-top:4px}
    .notes{margin-top:24px;white-space:pre-wrap}
  </style></head><body>
    <h1>${escapeHtml(labels.title)} ${escapeHtml(invoice.invoice_number)}</h1>
    <div class="muted">${escapeHtml(projectName)} · ${escapeHtml(labels.issueDate)}: ${escapeHtml(formatDate(invoice.issue_date))}</div>
    <p><strong>${escapeHtml(labels.recipient)}:</strong> ${escapeHtml(invoice.recipient_name)}${invoice.recipient_address ? `<br>${escapeHtml(invoice.recipient_address)}` : ""}</p>
    <table><thead><tr><th>${escapeHtml(labels.description)}</th><th class="num">${escapeHtml(labels.quantity)}</th><th class="num">${escapeHtml(labels.unitPrice)}</th><th class="num">${escapeHtml(labels.vatRate)}</th><th class="num">${escapeHtml(labels.total)}</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <div class="totals">
      <div><span>${escapeHtml(labels.totalHt)}</span><span>${escapeHtml(formatMoney(totals.ht))}</span></div>
      <div><span>${escapeHtml(labels.totalTva)}</span><span>${escapeHtml(formatMoney(totals.tva))}</span></div>
      <div class="grand"><span>${escapeHtml(labels.totalTtc)}</span><span>${escapeHtml(formatMoney(totals.ttc))}</span></div>
    </div>
    ${invoice.notes ? `<div class="notes"><strong>${escapeHtml(labels.notes)}</strong><br>${escapeHtml(invoice.notes)}</div>` : ""}
  </body></html>`;
}
