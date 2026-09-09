import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/icon";
import { InkFigure } from "@/components/ui/ink-sheet-screen";
import type { Invoice } from "@/features/invoices/invoice-types";
import { formatDate } from "@/lib/format/date";
import { INK_BLOCK } from "@/theme/tokens";

/** Fixed ink header: 40px back chevron, mono invoice number, outlined type pill. */
export function InvoiceDetailHeader({
  invoice,
  onBack,
}: {
  invoice: Invoice;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <View
      className="flex-row items-center gap-2 bg-ink-block pl-3 pr-4"
      style={{ paddingTop: insets.top + 8 }}
    >
      <Pressable
        testID="header-back"
        accessibilityRole="button"
        accessibilityLabel={t("common.back")}
        onPress={onBack}
        hitSlop={8}
        className="h-10 w-10 items-center justify-center active:opacity-70"
      >
        <Icon name="chevron-left" size={22} color={INK_BLOCK.text} />
      </Pressable>
      <Text
        className="min-w-0 flex-1 font-mono-regular text-[13px] text-ink-block-muted"
        numberOfLines={1}
      >
        {invoice.invoice_number}
      </Text>
      <View className="rounded-full border border-ink-block-line px-2.5 py-[5px]">
        <Text className="font-sans-medium text-[11.5px] text-on-ink-block-2">
          {t(`invoices.types.${invoice.type}`)}
        </Text>
      </View>
    </View>
  );
}

/**
 * Scrolling ink hero: 40px mono total, recipient, "date · payment method · purse" meta line and
 * the refund status pill (warning while pending, positive once refunded, with the refunder).
 */
export function InvoiceDetailHero({ invoice }: { invoice: Invoice }) {
  const { t } = useTranslation();
  const purse = invoice.paid_by_personal
    ? t("invoices.summary.personalPurse")
    : invoice.paid_by_company
      ? t("invoices.summary.companyPurse")
      : null;
  const meta = [
    formatDate(invoice.issue_date),
    invoice.payment_method_label ?? t("invoices.form.paymentMethodNone"),
    purse,
  ]
    .filter(Boolean)
    .join(" · ");
  const refunded = invoice.refundable_status === "refunded";
  const pill = refunded
    ? { bg: INK_BLOCK.positiveTint, fg: INK_BLOCK.positive }
    : { bg: INK_BLOCK.warningTint, fg: INK_BLOCK.warning };

  return (
    <View className="px-5 pb-[26px] pt-[22px]">
      <InkFigure
        amount={invoice.total_amount}
        negative={invoice.total_amount < 0}
        testID="invoice-detail-total"
      />
      <Text
        className="mt-2 font-sans-medium text-[17px] leading-[22px] text-on-ink-block"
        numberOfLines={2}
      >
        {invoice.recipient_name}
      </Text>
      <Text
        className="font-sans text-[12.5px] leading-[17px] text-ink-block-muted"
        numberOfLines={2}
      >
        {meta}
      </Text>
      {invoice.refundable_status ? (
        <View
          testID="invoice-refund-status"
          className="mt-3.5 flex-row items-center gap-2 self-start rounded-full px-3 py-1.5"
          style={{ backgroundColor: pill.bg }}
        >
          <View
            className="h-[7px] w-[7px] rounded-full"
            style={{ backgroundColor: pill.fg }}
          />
          <Text className="font-sans-medium text-xs" style={{ color: pill.fg }}>
            {t(`invoices.refund.${invoice.refundable_status}`)}
            {refunded && invoice.refunded_by
              ? ` ${t(`invoices.refund.by.${invoice.refunded_by}`)}`
              : ""}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
