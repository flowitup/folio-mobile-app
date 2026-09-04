import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { Badge } from "@/components/ui/primitives";
import { formatDate } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";
import { HIGHLIGHT_COLORS } from "@/lib/invoices/invoice-totals";

import type { Invoice } from "./invoice-types";

/** Tabs where the web ledger shows a VAT column: Σ qty × price × vat_rate / 100. */
const TVA_TYPES = new Set(["released_funds", "materials_services", "others"]);
function invoiceTva(items: Invoice["items"]): number {
  return items.reduce(
    (sum, it) => sum + it.quantity * it.unit_price * ((it.vat_rate ?? 0) / 100),
    0,
  );
}

const REFUND_TONE = {
  refundable: "neutral",
  refund_pending: "warning",
  refunded: "success",
} as const;

/** Ledger row: number, recipient, date, type, refund stamps, TTC total; background = highlight color. */
export function InvoiceRow({
  invoice,
  showType = true,
  onPress,
}: {
  invoice: Invoice;
  showType?: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const background = invoice.highlight_color
    ? HIGHLIGHT_COLORS[invoice.highlight_color]
    : "#ffffff";
  const negative = invoice.total_amount < 0;

  return (
    <Pressable
      testID={`invoice-row-${invoice.id}`}
      onPress={onPress}
      className="mb-2 rounded-lg border border-border px-4 py-3"
      style={{ backgroundColor: background }}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-2">
          <Text
            className="text-base font-medium text-primary"
            numberOfLines={1}
          >
            {invoice.recipient_name}
          </Text>
          <Text className="text-xs text-muted-foreground">
            {invoice.invoice_number} · {formatDate(invoice.issue_date)}
            {invoice.service_month
              ? ` · ${t("invoices.serviceMonthShort")} ${invoice.service_month.slice(0, 7)}`
              : ""}
            {TVA_TYPES.has(invoice.type)
              ? ` · ${t("invoices.tvaShort")} ${formatMoney(invoiceTva(invoice.items))}`
              : ""}
          </Text>
        </View>
        <Text
          className={`text-base font-semibold ${negative ? "text-danger" : "text-primary"}`}
        >
          {formatMoney(invoice.total_amount)}
        </Text>
      </View>
      <View className="mt-1 flex-row flex-wrap gap-1">
        {showType ? (
          <Badge label={t(`invoices.types.${invoice.type}`)} />
        ) : null}
        {invoice.refundable_status ? (
          <Badge
            label={t(`invoices.refund.${invoice.refundable_status}`)}
            tone={REFUND_TONE[invoice.refundable_status]}
          />
        ) : null}
        {invoice.settled_via === "avoir" ? (
          <Badge label={t("invoices.form.settledViaAvoir")} tone="warning" />
        ) : null}
        {invoice.paid_with_returns && invoice.paid_with_returns.length > 0 ? (
          <Badge label={t("invoices.paidWithAvoir")} tone="success" />
        ) : null}
        {invoice.has_bank_refund ? (
          <Badge label={t("invoices.refund.bank")} tone="success" />
        ) : null}
        {invoice.is_auto_generated ? (
          <Badge label={t("invoices.auto")} />
        ) : null}
      </View>
    </Pressable>
  );
}
