import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { InkFigure } from "@/components/ui/ink-sheet-screen";
import { RingGauge } from "@/components/ui/ring-gauge";
import type { BudgetMetrics } from "@/lib/dashboard/overview-metrics";
import { formatMoney } from "@/lib/format/money";
import { INK_BLOCK } from "@/theme/tokens";

type Props = {
  budget: BudgetMetrics;
  spentTotal: number;
  spentByCredits: number;
  spentPersonal: number;
  /** Bank credit not yet released (credit − draws); null when the project has no bank credit. */
  bankRemaining: number | null;
  onAddInvoice: () => void;
  onAddRelease: () => void;
  onPayLabor: () => void;
};

/**
 * 1b ink hero of the overview: "Còn lại để chi" 40px mono figure with a 104px ring gauge
 * (credit spend on-ink, personal spend muted, "61 % ĐÃ CHI" inside), the spent-of-credit
 * caption, the bank credit still to draw, then three quick actions — accent "+ Hoá đơn", outlined "Giải ngân" / "Trả lương".
 */
export function OverviewHero({
  budget,
  spentTotal,
  spentByCredits,
  spentPersonal,
  bankRemaining,
  onAddInvoice,
  onAddRelease,
  onPayLabor,
}: Props) {
  const { t } = useTranslation();
  const share = (value: number) =>
    budget.denominator > 0
      ? Math.min(100, Math.max(0, (value / budget.denominator) * 100))
      : 0;
  return (
    <View testID="overview-headline">
      <View className="flex-row items-center gap-[18px] px-5 pb-[30px] pt-[26px]">
        <View className="min-w-0 flex-1">
          <Text className="font-sans text-[11px] uppercase tracking-[1.1px] text-ink-block-muted">
            {t("dashboard.remainingToSpend")}
          </Text>
          <View className="mt-1.5">
            <InkFigure
              amount={budget.left}
              negative={budget.left < 0}
              testID="overview-remaining"
            />
          </View>
          <Text className="mt-1.5 font-sans text-[12.5px] leading-[17px] text-ink-block-muted">
            {t(
              budget.usesBudget
                ? "dashboard.overview.spentOfCredit"
                : "dashboard.overview.spentOfReleased",
              {
                spent: formatMoney(spentTotal),
                total: formatMoney(budget.denominator),
              },
            )}
          </Text>
          {bankRemaining !== null ? (
            <Text
              className="mt-0.5 font-sans text-[12.5px] leading-[17px] text-ink-block-muted"
              testID="overview-figure-bank"
            >
              {t("dashboard.overview.bankRemaining")}{" "}
              <Text className="font-mono text-on-ink-block">
                {formatMoney(bankRemaining)}
              </Text>
            </Text>
          ) : null}
        </View>
        <RingGauge
          testID="overview-ring"
          segments={[
            { pct: share(spentByCredits), color: INK_BLOCK.text },
            { pct: share(spentPersonal), color: INK_BLOCK.muted },
          ]}
          trackColor={INK_BLOCK.tile}
        >
          <Text
            className="font-mono text-[22px] leading-[26px] text-on-ink-block"
            testID="overview-ring-pct"
          >
            {budget.pct}%
          </Text>
          <Text className="font-sans text-[10px] uppercase tracking-[0.8px] text-ink-block-muted">
            {t("project.spent")}
          </Text>
        </RingGauge>
      </View>
      <View className="flex-row gap-2 px-5 pb-6">
        <Pressable
          testID="overview-add-invoice"
          accessibilityRole="button"
          onPress={onAddInvoice}
          className="h-11 flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-ink-block-accent active:opacity-70"
        >
          <Icon name="plus" size={15} color={INK_BLOCK.bg} />
          <Text
            className="font-sans-semibold text-[13px]"
            style={{ color: INK_BLOCK.bg }}
          >
            {t("dashboard.overview.addInvoice")}
          </Text>
        </Pressable>
        <Pressable
          testID="overview-add-release"
          accessibilityRole="button"
          onPress={onAddRelease}
          className="h-11 flex-1 items-center justify-center rounded-xl border border-ink-block-line active:opacity-70"
        >
          <Text className="font-sans-medium text-[13px] text-on-ink-block">
            {t("dashboard.overview.addRelease")}
          </Text>
        </Pressable>
        <Pressable
          testID="overview-pay-labor"
          accessibilityRole="button"
          onPress={onPayLabor}
          className="h-11 flex-1 items-center justify-center rounded-xl border border-ink-block-line active:opacity-70"
        >
          <Text className="font-sans-medium text-[13px] text-on-ink-block">
            {t("dashboard.overview.payLabor")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
