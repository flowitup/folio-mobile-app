import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { formatMoney } from "@/lib/format/money";

type Props = {
  laborUnpaid: number;
  pendingRefundCount: number;
  pendingRefundTotal: number;
  onPayLabor: () => void;
  onOpenRefunds: () => void;
};

/**
 * 1b due tiles, first row of the paper sheet: "Chưa trả" (labor unpaid, warning tint, ink
 * "Trả ngay" pill) and "Chờ hoàn" (expenses awaiting the company refund, accent tint, outlined
 * "Xem" pill). 18px radius, 20px mono-semibold figures.
 */
export function OverviewDueTiles({
  laborUnpaid,
  pendingRefundCount,
  pendingRefundTotal,
  onPayLabor,
  onOpenRefunds,
}: Props) {
  const { t } = useTranslation();
  return (
    <View className="flex-row gap-2.5" testID="overview-due-tiles">
      <View className="flex-1 rounded-[18px] bg-warning-tint p-3.5">
        <Text className="font-sans text-[11px] uppercase tracking-[1.1px] text-warning">
          {t("dashboard.overview.unpaid")}
        </Text>
        <Text
          className="mt-2 font-mono-semibold text-xl leading-6 text-ink"
          testID="overview-labor-unpaid-amount"
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {formatMoney(laborUnpaid)}
        </Text>
        <Text className="mt-0.5 font-sans text-xs text-muted" numberOfLines={1}>
          {t("invoices.types.labor")}
        </Text>
        <Pressable
          testID="overview-labor-unpaid"
          accessibilityRole="button"
          onPress={onPayLabor}
          className="mt-3 h-[30px] flex-row items-center self-start rounded-full bg-ink px-3 active:opacity-70"
        >
          <Text className="font-sans-semibold text-xs text-on-ink">
            {t("dashboard.overview.payNow")}
          </Text>
        </Pressable>
      </View>
      <View className="flex-1 rounded-[18px] bg-accent-tint p-3.5">
        <Text className="font-sans text-[11px] uppercase tracking-[1.1px] text-accent-ink">
          {t("dashboard.overview.awaitingRefund")}
        </Text>
        <Text
          className="mt-2 font-mono-semibold text-xl leading-6 text-ink"
          testID="overview-figure-pending"
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {formatMoney(pendingRefundTotal)}
        </Text>
        <Text className="mt-0.5 font-sans text-xs text-muted" numberOfLines={1}>
          {t("dashboard.overview.refundItems", { count: pendingRefundCount })}
        </Text>
        <Pressable
          testID="overview-pending-refunds"
          accessibilityRole="button"
          onPress={onOpenRefunds}
          className="mt-3 h-[30px] flex-row items-center self-start rounded-full border-[1.5px] border-ink px-3 active:opacity-70"
        >
          <Text className="font-sans-semibold text-xs text-ink">
            {t("expenses.view")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
