import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { shortMonthLabel } from "@/components/ui/month-picker";
import { Card } from "@/components/ui/primitives";
import {
  expenseTypeColor,
  shortDayMonth,
} from "@/features/dashboard/overview-cards";
import type { Invoice, InvoiceType } from "@/features/invoices/invoice-types";
import { capitalizeFirst } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";
import { ledgerTypeOf } from "@/lib/invoices/group-invoices-by-month";
import { highlightRowTint, invoiceTotals } from "@/lib/invoices/invoice-totals";
import { INK_BLOCK, useTokens } from "@/theme/tokens";

/**
 * 1b purse card on the ink hero: outlined r14, muted label + "71 %", 16px mono remaining,
 * 5px bar (company on-ink, personal accent).
 */
export function PurseCard({
  label,
  released,
  spent,
  tone,
  testID,
  cashAdvanced = 0,
}: {
  label: string;
  released: number;
  spent: number;
  tone: "company" | "personal";
  testID: string;
  /** Part of `spent` that is cash handed to people (company purse only). */
  cashAdvanced?: number;
}) {
  const { t } = useTranslation();
  // The label keeps the real share (a purse can be spent 5× over); only the bar is clamped.
  const pct = released > 0 ? Math.round((spent / released) * 100) : 0;
  const barPct = Math.min(100, Math.max(0, pct));
  const left = Math.round((released - spent) * 100) / 100;
  // Spent with nothing released: say what was spent, not "−X left".
  const unfunded = released <= 0 && spent > 0;
  return (
    <View
      className="flex-1 rounded-[14px] border border-ink-block-line p-3"
      testID={testID}
    >
      <View className="flex-row justify-between gap-2">
        <Text
          className="min-w-0 flex-1 font-sans text-[11px] leading-[14px] text-ink-block-muted"
          numberOfLines={1}
        >
          {label}
        </Text>
        <Text
          className={`font-sans text-[11px] leading-[14px] ${pct > 100 || unfunded ? "text-negative" : "text-ink-block-muted"}`}
          testID={`${testID}-pct`}
        >
          {unfunded ? t("invoices.summary.unfunded") : `${pct} %`}
        </Text>
      </View>
      <Text
        className={`mt-1.5 font-mono text-base leading-5 ${!unfunded && left < 0 ? "text-negative" : "text-on-ink-block"}`}
        numberOfLines={1}
        adjustsFontSizeToFit
        testID={`${testID}-figure`}
      >
        {formatMoney(unfunded ? spent : Math.abs(left))}
        <Text className="font-sans text-[11px] text-ink-block-muted">
          {" "}
          {unfunded
            ? t("invoices.summary.spentLower")
            : left < 0
              ? t("invoices.summary.overLower")
              : t("invoices.summary.left")}
        </Text>
      </Text>
      <View className="mt-2 h-[5px] overflow-hidden rounded-[3px] bg-ink-block-tile">
        <View
          className={`h-[5px] rounded-[3px] ${tone === "company" ? "bg-on-ink-block" : "bg-ink-block-accent"}`}
          style={{ width: `${unfunded ? 100 : barPct}%` }}
        />
      </View>
      <Text
        testID={`${testID}-line`}
        className="mt-1.5 font-sans text-[10.5px] leading-[13px] text-ink-block-muted"
        numberOfLines={2}
      >
        {t("invoices.summary.purseLine", {
          released: formatMoney(released),
          spent: formatMoney(spent),
        })}
      </Text>
      {cashAdvanced > 0 ? (
        <Text
          testID={`${testID}-cash-advance`}
          className="mt-1.5 font-sans text-[10.5px] leading-[13px] text-ink-block-muted"
          numberOfLines={2}
        >
          {t("invoices.summary.cashAdvance", {
            amount: formatMoney(cashAdvanced),
          })}
        </Text>
      ) : null}
    </View>
  );
}

/** 1b accent-tint banner: "2 khoản chờ công ty hoàn · 4.850 €   Xem ›". */
export function PendingRefundBanner({
  count,
  total,
  onPress,
}: {
  count: number;
  total: number;
  onPress?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Pressable
      testID="expenses-pending-refunds"
      accessibilityRole={onPress ? "button" : undefined}
      onPress={onPress}
      disabled={!onPress}
      className="flex-row items-center gap-2.5 rounded-[14px] bg-accent-tint px-3.5 py-2.5 active:opacity-70"
    >
      <Text className="min-w-0 flex-1 font-sans-medium text-[13px] leading-[18px] text-ink">
        {t("expenses.pendingRefunds", { count })} ·{" "}
        <Text className="font-mono">{formatMoney(total)}</Text>
      </Text>
      {onPress ? (
        <Text className="font-sans-semibold text-xs text-accent-ink">
          {t("expenses.view")} ›
        </Text>
      ) : null}
    </Pressable>
  );
}

/** Tabs where the web ledger shows a VAT column. */
const TVA_TYPES = new Set<InvoiceType>([
  "released_funds",
  "materials_services",
  "others",
]);
/** The VAT as the detail card and print page split it: TTC − the lines' rounded HT. */
export function invoiceTva(items: Invoice["items"]): number {
  return invoiceTotals(items).tva;
}

/** Row badge: refund state (warning while pending), avoir settlement, or "auto". */
export function invoiceBadge(
  invoice: Invoice,
  t: (key: string) => string,
): { label: string; tone: "warning" | "muted" } | null {
  if (invoice.refundable_status)
    return {
      label: t(`invoices.refund.${invoice.refundable_status}`),
      tone: invoice.refundable_status === "refunded" ? "muted" : "warning",
    };
  if (invoice.settled_via === "avoir")
    return { label: t("invoices.form.settledViaAvoir"), tone: "muted" };
  if (invoice.is_auto_generated)
    return { label: t("invoices.auto"), tone: "muted" };
  if (invoice.type === "released_funds" && invoice.is_cash_advance)
    return { label: t("invoices.cashAdvance"), tone: "muted" };
  return null;
}

/**
 * 1b ledger row: 4×36 color bar of the type, recipient 15/500, meta "06/09 · HĐ-041 · VAT 1.140",
 * mono amount (released funds `+` in positive) and the badge under it. A highlight color tints the row.
 */
export function ExpenseRow({
  invoice,
  onPress,
  first = false,
}: {
  invoice: Invoice;
  onPress: () => void;
  first?: boolean;
}) {
  const { t } = useTranslation();
  const tokens = useTokens();
  const colors = expenseTypeColor(tokens);
  const meta = [
    shortDayMonth(invoice.issue_date),
    invoice.invoice_number,
    invoice.type === "labor" && invoice.service_month
      ? `${t("invoices.serviceMonthShort")} ${shortMonthLabel(invoice.service_month.slice(0, 7))}`
      : null,
    TVA_TYPES.has(invoice.type)
      ? `${t("invoices.tvaShort")} ${formatMoney(invoiceTva(invoice.items))}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const badge = invoiceBadge(invoice, t);
  const ledgerType = ledgerTypeOf(invoice);
  const released = ledgerType === "released_funds";
  const amountClass = released
    ? "text-positive"
    : invoice.total_amount < 0
      ? "text-negative"
      : "text-ink";

  return (
    <Pressable
      testID={`invoice-row-${invoice.id}`}
      accessibilityRole="button"
      onPress={onPress}
      className={`flex-row items-center gap-3 px-4 py-3.5 active:opacity-70 ${first ? "" : "border-t border-line"}`}
      style={{ backgroundColor: highlightRowTint(invoice.highlight_color) }}
    >
      <View
        className="h-9 w-1 rounded-sm"
        style={{ backgroundColor: colors[ledgerType] }}
      />
      <View className="min-w-0 flex-1">
        <Text
          className="font-sans-medium text-[15px] leading-[18px] text-ink"
          numberOfLines={1}
        >
          {invoice.recipient_name}
        </Text>
        <Text
          className="mt-0.5 font-sans text-[11.5px] leading-[14px] text-muted"
          numberOfLines={1}
        >
          {meta}
        </Text>
      </View>
      <View className="items-end">
        <Text className={`font-mono text-[15px] leading-[18px] ${amountClass}`}>
          {released && invoice.total_amount > 0 ? "+" : ""}
          {formatMoney(invoice.total_amount)}
        </Text>
        {badge ? (
          <Text
            className={`mt-0.5 font-sans-medium text-[10.5px] ${badge.tone === "warning" ? "text-accent-ink" : "text-muted"}`}
          >
            {badge.label}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/** "septembre 2026" → "Septembre 2026", "tháng 9 năm 2026" → "Tháng 9 năm 2026". */
/** "Tháng 8   31.480,00 €" line above an older month's card. */
export function MonthSectionHeader({
  label,
  total,
}: {
  label: string;
  total: number;
}) {
  return (
    <View className="flex-row items-baseline justify-between px-1 pt-1.5">
      {/* First letter only: a capitalize class gave "Tháng 9 Năm 2026". */}
      <Text className="font-sans-semibold text-[15px] leading-[18px] text-ink">
        {capitalizeFirst(label)}
      </Text>
      <Text className="font-mono text-[14px] text-muted">
        {formatMoney(total)}
      </Text>
    </View>
  );
}

/** 1b month card (r20, shadow): just the rows; the month header lives outside when needed. */
export function ExpenseMonthCard({
  invoices,
  onOpen,
  testID,
}: {
  invoices: Invoice[];
  onOpen: (invoiceId: string) => void;
  testID?: string;
}) {
  return (
    <Card
      radius={20}
      elevated
      padded={false}
      className="overflow-hidden"
      testID={testID}
    >
      {invoices.map((invoice, index) => (
        <ExpenseRow
          key={invoice.id}
          invoice={invoice}
          first={index === 0}
          onPress={() => onOpen(invoice.id)}
        />
      ))}
    </Card>
  );
}

/** Colors the 1b FAB / accent buttons draw on the ink block. */
export const INK_FAB_SHADOW = `0 12px 24px -8px ${INK_BLOCK.accent}99`;
