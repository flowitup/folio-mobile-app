import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Card } from "@/components/ui/primitives";
import { Eyebrow } from "@/components/ui/typography";
import type { Invoice } from "@/features/invoices/invoice-types";
import { formatMoney } from "@/lib/format/money";

/**
 * Secondary details the 1b hero does not carry (address, service month, linked returns, notes…),
 * one label / value row each. Renders nothing when every field is empty.
 */
export function InvoiceInfoCard({ invoice }: { invoice: Invoice }) {
  const { t } = useTranslation();
  const rows: { label: string; value: string | null | undefined }[] = [
    {
      label: t("invoices.form.recipientAddress"),
      value: invoice.recipient_address,
    },
    {
      label: t("invoices.form.serviceMonth"),
      value: invoice.service_month?.slice(0, 7),
    },
    { label: t("invoices.refundOf"), value: invoice.refunds_invoice_number },
    {
      label: t("invoices.form.settledVia"),
      value: invoice.settled_via
        ? t(
            `invoices.form.settledVia${invoice.settled_via === "avoir" ? "Avoir" : "Cash"}`,
          )
        : null,
    },
    {
      label: t("invoices.form.appliedTo"),
      value: invoice.applied_to_invoice_number,
    },
    {
      label: t("invoices.paidWithAvoir"),
      value: invoice.paid_with_returns?.length
        ? invoice.paid_with_returns
            .map((r) => `${r.invoice_number} (${formatMoney(r.total_amount)})`)
            .join(", ")
        : null,
    },
    { label: t("invoices.form.notes"), value: invoice.notes },
  ].filter((row) => Boolean(row.value));
  if (rows.length === 0) return null;

  return (
    <Card
      radius={20}
      elevated
      padded={false}
      className="px-4 pb-2 pt-3"
      testID="invoice-info"
    >
      <Eyebrow className="pb-1">{t("invoices.detail.info")}</Eyebrow>
      {rows.map((row) => (
        <View
          key={row.label}
          className="flex-row justify-between gap-3 border-t border-line py-2"
        >
          <Text className="font-sans text-[13px] leading-[18px] text-muted">
            {row.label}
          </Text>
          <Text className="min-w-0 flex-1 text-right font-sans text-[13px] leading-[18px] text-ink">
            {row.value}
          </Text>
        </View>
      ))}
    </Card>
  );
}
