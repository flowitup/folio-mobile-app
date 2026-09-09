import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { shortMonthLabel } from "@/components/ui/month-picker";
import { Card } from "@/components/ui/primitives";
import {
  expenseTypeColor,
  shortDayMonth,
} from "@/features/dashboard/overview-cards";
import type { Invoice, InvoiceType } from "@/features/invoices/invoice-types";
import { formatMoney } from "@/lib/format/money";
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
}: {
  label: string;
  released: number;
  spent: number;
  tone: "company" | "personal";
  testID: string;
}) {
  const pct =
    released > 0 ? Math.min(100, Math.round((spent / released) * 100)) : 0;
  const left = released - spent;
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
        <Text className="font-sans text-[11px] leading-[14px] text-ink-block-muted">
          {pct} %
        </Text>
      </View>
      <Text
        className={`mt-1.5 font-mono text-base leading-5 ${left < 0 ? "text-negative" : "text-on-ink-block"}`}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {formatMoney(left)}
      </Text>
      <View className="mt-2 h-[5px] overflow-hidden rounded-[3px] bg-ink-block-tile">
        <View
          className={`h-[5px] rounded-[3px] ${tone === "company" ? "bg-on-ink-block" : "bg-ink-block-accent"}`}
          style={{ width: `${pct}%` }}
        />
      </View>
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

/** Tabs where the web ledger shows a VAT column: Σ qty × price × vat_rate / 100. */
const TVA_TYPES = new Set<InvoiceType>([
  "released_funds",
  "materials_services",
  "others",
]);
export function invoiceTva(items: Invoice["items"]): number {
  return items.reduce(
    (sum, it) => sum + it.quantity * it.unit_price * ((it.vat_rate ?? 0) / 100),
    0,
  );
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
  return null;
}

/**
 * 1b ledger row: 4×36 color bar of the type, recipient 15/500, meta "06/09 · HĐ-041 · VAT 1.140",
 * mono amount (released funds `+` in positive) and the badge under it.
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
  const released = invoice.type === "released_funds";
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
    >
      <View
        className="h-9 w-1 rounded-sm"
        style={{ backgroundColor: colors[invoice.type] }}
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
      <Text className="font-sans-semibold text-[15px] capitalize leading-[18px] text-ink">
        {label}
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
