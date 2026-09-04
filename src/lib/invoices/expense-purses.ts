/**
 * Company / personal purse breakdown for the expenses page, copied from the web
 * `expense-purses-summary.tsx` loop: spend per purse and per type, returns netted into the
 * refunded invoice's type (materials_services when unlinked), pending refunds on each channel,
 * and avoirs not yet applied to an invoice.
 */
import type { Invoice } from "@/features/invoices/invoice-types";
import {
  EXPENSE_TYPES,
  isPersonalExpense,
} from "@/lib/dashboard/overview-metrics";
import type { ExpenseType } from "@/lib/dashboard/overview-metrics";

export interface PurseBreakdown {
  count: number;
  spent: number;
  types: Record<ExpenseType, { total: number; count: number }>;
  returnsCount: number;
  returnsTotal: number;
}

export interface PursesSummary {
  company: PurseBreakdown;
  personal: PurseBreakdown;
  refundable: { count: number; total: number };
  bankOutstanding: { count: number; total: number };
  outstandingAvoirs: { count: number; total: number };
  returnsTotal: number;
  expenseCount: number;
}

export function emptyBreakdown(): PurseBreakdown {
  return {
    count: 0,
    spent: 0,
    types: {
      labor: { total: 0, count: 0 },
      materials_services: { total: 0, count: 0 },
      others: { total: 0, count: 0 },
    },
    returnsCount: 0,
    returnsTotal: 0,
  };
}

export function buildPursesSummary(invoices: Invoice[]): PursesSummary {
  const company = emptyBreakdown();
  const personal = emptyBreakdown();
  const refundable = { count: 0, total: 0 };
  const bankOutstanding = { count: 0, total: 0 };
  const outstandingAvoirs = { count: 0, total: 0 };

  for (const inv of invoices) {
    if (inv.type === "released_funds" || inv.type === "return") continue;
    const purse = isPersonalExpense(inv) ? personal : company;
    purse.count += 1;
    const bucket = purse.types[inv.type as ExpenseType];
    if (bucket) {
      bucket.total += inv.total_amount;
      purse.spent += inv.total_amount;
      bucket.count += 1;
    }
    if (
      purse === personal &&
      (inv.refundable_status === "refundable" ||
        inv.refundable_status === "refund_pending")
    ) {
      refundable.count += 1;
      refundable.total += inv.total_amount;
    }
    if (
      inv.refundable_status &&
      inv.refunded_by !== "bank" &&
      inv.refunded_by !== "both"
    ) {
      bankOutstanding.count += 1;
      bankOutstanding.total += inv.total_amount;
    }
  }

  const byId = new Map(invoices.map((i) => [i.id, i]));
  let returnsTotal = 0;
  for (const ref of invoices) {
    if (ref.type !== "return") continue;
    const purse = isPersonalExpense(ref) ? personal : company;
    const sourceType = ref.refunds_invoice_id
      ? byId.get(ref.refunds_invoice_id)?.type
      : undefined;
    const type: ExpenseType = (EXPENSE_TYPES as readonly string[]).includes(
      sourceType ?? "",
    )
      ? (sourceType as ExpenseType)
      : "materials_services";
    purse.types[type].total += ref.total_amount;
    purse.spent += ref.total_amount;
    purse.returnsCount += 1;
    purse.returnsTotal += ref.total_amount;
    returnsTotal += ref.total_amount;
    if (ref.settled_via === "avoir" && !ref.applied_to_invoice_id) {
      outstandingAvoirs.count += 1;
      outstandingAvoirs.total += ref.total_amount;
    }
  }

  return {
    company,
    personal,
    refundable,
    bankOutstanding,
    outstandingAvoirs,
    returnsTotal,
    expenseCount: company.count + personal.count,
  };
}
