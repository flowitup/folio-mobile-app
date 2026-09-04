import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import type { IconName } from "@/components/ui/icon";
import { shortMonthLabel } from "@/components/ui/month-picker";
import { Card } from "@/components/ui/primitives";
import { shortDayMonth } from "@/features/dashboard/overview-cards";
import type { Invoice, InvoiceType } from "@/features/invoices/invoice-types";
import { formatMoney } from "@/lib/format/money";
import { useTokens } from "@/theme/tokens";

/** Purse card: 26px icon tile, muted label, 20px mono remaining, caption, 6px progress. */
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
  const { t } = useTranslation();
  const tokens = useTokens();
  const pct =
    released > 0 ? Math.min(100, Math.round((spent / released) * 100)) : 0;
  const icon: IconName = tone === "company" ? "home" : "user";
  return (
    <Card radius={14} elevated className="flex-1 p-3.5" testID={testID}>
      <View className="flex-row items-center gap-2">
        <View
          className={`h-[26px] w-[26px] items-center justify-center rounded-lg ${tone === "company" ? "bg-paper-2" : "bg-accent-tint"}`}
        >
          <Icon
            name={icon}
            size={14}
            color={tone === "company" ? tokens.ink : tokens.accentInk}
          />
        </View>
        <Text className="font-sans text-xs text-muted" numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text
        className={`mt-2.5 font-mono text-xl ${released - spent < 0 ? "text-negative" : "text-ink"}`}
      >
        {formatMoney(released - spent)}
      </Text>
      <Text className="font-sans text-[11.5px] text-muted">
        {t("expenses.purseCaption", { pct })}
      </Text>
      <View className="mt-2.5 h-1.5 overflow-hidden rounded-[3px] bg-paper-2">
        <View
          className={`h-1.5 rounded-[3px] ${tone === "company" ? "bg-ink" : "bg-accent"}`}
          style={{ width: `${pct}%` }}
        />
      </View>
    </Card>
  );
}

/** Warning-tint banner: "N khoản đang chờ công ty hoàn / total · Xem ›". */
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
  const tokens = useTokens();
  return (
    <Pressable
      testID="expenses-pending-refunds"
      accessibilityRole={onPress ? "button" : undefined}
      onPress={onPress}
      disabled={!onPress}
      className="flex-row items-center gap-3 rounded-[14px] bg-warning-tint px-3.5 py-3 active:opacity-70"
    >
      <View className="h-8 w-8 items-center justify-center rounded-full bg-card">
        <Icon name="refresh-ccw" size={16} color={tokens.warning} />
      </View>
      <View className="flex-1">
        <Text className="font-sans text-[13px] leading-[18px] text-ink">
          {t("expenses.pendingRefunds", { count })}
        </Text>
        <Text className="font-mono-semibold text-[13px] leading-[18px] text-ink">
          {formatMoney(total)}
        </Text>
      </View>
      {onPress ? (
        <Text className="font-sans text-xs text-muted">
          {t("expenses.view")} ›
        </Text>
      ) : null}
    </Pressable>
  );
}

const TILE_CLASS: Record<InvoiceType, { box: string; text: string }> = {
  labor: { box: "bg-accent-tint", text: "text-accent-ink" },
  materials_services: { box: "bg-paper-2", text: "text-ink" },
  others: { box: "bg-paper-2", text: "text-muted" },
  released_funds: { box: "bg-positive-tint", text: "text-positive" },
  return: { box: "bg-negative-tint", text: "text-negative" },
};

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

/** Ledger row of a month card: 38px type tile, name + meta, mono amount + badge. */
export function ExpenseRow({
  invoice,
  onPress,
}: {
  invoice: Invoice;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const tile = TILE_CLASS[invoice.type];
  const meta = [
    invoice.invoice_number,
    shortDayMonth(invoice.issue_date),
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
  const amountClass =
    invoice.type === "released_funds"
      ? "text-positive"
      : invoice.total_amount < 0
        ? "text-negative"
        : "text-ink";

  return (
    <Pressable
      testID={`invoice-row-${invoice.id}`}
      accessibilityRole="button"
      onPress={onPress}
      className="flex-row items-center gap-3 border-t border-line px-4 py-[11px] active:opacity-70"
    >
      <View
        className={`h-[38px] w-[38px] items-center justify-center rounded-xl ${tile.box}`}
      >
        <Text className={`font-sans-bold text-xs ${tile.text}`}>
          {t(`expenses.abbr.${invoice.type}`)}
        </Text>
      </View>
      <View className="min-w-0 flex-1">
        <Text
          className="font-sans-medium text-[14px] text-ink"
          numberOfLines={1}
        >
          {invoice.recipient_name}
        </Text>
        <Text
          className="mt-px font-sans text-[11.5px] text-muted"
          numberOfLines={1}
        >
          {meta}
        </Text>
      </View>
      <View className="items-end">
        <Text className={`font-mono text-[14px] ${amountClass}`}>
          {formatMoney(invoice.total_amount)}
        </Text>
        {badge ? (
          <Text
            className={`mt-px font-sans text-[10.5px] ${badge.tone === "warning" ? "text-warning" : "text-muted"}`}
          >
            {badge.label}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Month card (r16, shadow): "Tháng 9 2026 · mono total" header then the rows. */
export function ExpenseMonthCard({
  label,
  total,
  invoices,
  onOpen,
  testID,
}: {
  label: string;
  total: number;
  invoices: Invoice[];
  onOpen: (invoiceId: string) => void;
  testID?: string;
}) {
  return (
    <Card
      radius={16}
      elevated
      padded={false}
      className="overflow-hidden"
      testID={testID}
    >
      <View className="flex-row items-end justify-between px-4 pb-2.5 pt-3.5">
        <Text className="font-sans-semibold text-[14px] capitalize text-ink">
          {label}
        </Text>
        <Text className="font-mono-semibold text-[14px] text-ink">
          {formatMoney(total)}
        </Text>
      </View>
      {invoices.map((invoice) => (
        <ExpenseRow
          key={invoice.id}
          invoice={invoice}
          onPress={() => onOpen(invoice.id)}
        />
      ))}
    </Card>
  );
}
