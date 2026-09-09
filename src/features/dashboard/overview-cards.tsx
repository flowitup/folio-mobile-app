import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { shortMonthLabel } from "@/components/ui/month-picker";
import { Card } from "@/components/ui/primitives";
import { SectionLink } from "@/components/ui/typography";
import type { AgendaGroup } from "@/lib/dashboard/overview-agenda";
import type { TypeMonthlyBucket } from "@/lib/dashboard/overview-metrics";
import { formatMoney } from "@/lib/format/money";
import { useTokens } from "@/theme/tokens";
import type { Tokens } from "@/theme/tokens";

/** `dd/mm` for the compact mono dates of the overview tables. */
export function shortDayMonth(iso: string | null | undefined): string {
  if (!iso) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return match ? `${match[3]}/${match[2]}` : "";
}

/** `+17 %`, `−12 %`, `0 %`; null when there is no previous month to compare with. */
export function formatDelta(deltaPct: number | null): string {
  if (deltaPct == null) return "—";
  if (deltaPct > 0) return `+${deltaPct} %`;
  if (deltaPct < 0) return `−${Math.abs(deltaPct)} %`;
  return "0 %";
}

/** Spend going up is bad (negative), going down is good (positive), flat is muted. */
export function deltaColor(deltaPct: number | null, tokens: Tokens): string {
  if (deltaPct == null || deltaPct === 0) return tokens.muted;
  return deltaPct > 0 ? tokens.negative : tokens.positive;
}

/** Expense type colors shared by the 1b bars and rows: materials ink, labor accent, others muted-2. */
export function expenseTypeColor(tokens: Tokens): Record<string, string> {
  return {
    labor: tokens.accent,
    materials_services: tokens.ink,
    others: tokens.muted2,
    released_funds: tokens.positive,
    return: tokens.negative,
  };
}

/**
 * 1b "Chi tháng 9" card (r20, shadow): month total + delta, a 14px stacked bar of the month's
 * spend by type, then a 3-column grid of type / mono amount / delta. Tapping opens the ledger.
 */
export function MonthSpendCard({
  buckets,
  currentMonthKey,
  totalCurrent,
  totalDeltaPct,
  onOpenExpenses,
}: {
  buckets: TypeMonthlyBucket[];
  currentMonthKey: string;
  totalCurrent: number;
  totalDeltaPct: number | null;
  onOpenExpenses: () => void;
}) {
  const { t } = useTranslation();
  const tokens = useTokens();
  const colors = expenseTypeColor(tokens);
  const current = buckets.map((bucket) => ({
    ...bucket,
    value: Math.max(0, bucket.monthly[bucket.monthly.length - 1]?.total ?? 0),
  }));
  const sum = current.reduce((acc, bucket) => acc + bucket.value, 0);
  return (
    <Pressable
      testID="overview-spend-by-type"
      accessibilityRole="button"
      onPress={onOpenExpenses}
      className="active:opacity-80"
    >
      <Card radius={20} elevated>
        <View className="flex-row items-baseline justify-between">
          <Text className="font-sans-semibold text-[15px] leading-[18px] text-ink">
            {t("dashboard.overview.monthSpend", {
              month: shortMonthLabel(currentMonthKey),
            })}
          </Text>
          <Text className="font-mono-semibold text-[15px] text-ink">
            {formatMoney(totalCurrent)}
            <Text
              className="font-mono text-xs"
              style={{ color: deltaColor(totalDeltaPct, tokens) }}
            >
              {"  "}
              {formatDelta(totalDeltaPct)}
            </Text>
          </Text>
        </View>
        <View className="mt-3 h-3.5 flex-row gap-0.5 overflow-hidden rounded-[7px]">
          {sum > 0 ? (
            current.map((bucket) =>
              bucket.value > 0 ? (
                <View
                  key={bucket.type}
                  style={{
                    flex: bucket.value / sum,
                    backgroundColor: colors[bucket.type],
                  }}
                />
              ) : null,
            )
          ) : (
            <View className="flex-1 bg-paper-2" />
          )}
        </View>
        <View className="mt-3 flex-row gap-2">
          {current.map((bucket) => (
            <View key={bucket.type} className="min-w-0 flex-1">
              <View className="flex-row items-center gap-[5px]">
                <View
                  className="h-2 w-2 rounded-sm"
                  style={{ backgroundColor: colors[bucket.type] }}
                />
                <Text
                  className="min-w-0 flex-1 font-sans text-[11.5px] text-muted"
                  numberOfLines={1}
                >
                  {t(`expenses.filters.${bucket.type}`)}
                </Text>
              </View>
              <Text
                className="mt-0.5 font-mono text-[14px] text-ink"
                numberOfLines={1}
                adjustsFontSizeToFit
                testID={`overview-type-${bucket.type}`}
              >
                {formatMoney(bucket.value)}
              </Text>
              <Text
                className="font-mono-regular text-[11px]"
                style={{ color: deltaColor(bucket.deltaPct, tokens) }}
              >
                {formatDelta(bucket.deltaPct)}
              </Text>
            </View>
          ))}
        </View>
      </Card>
    </Pressable>
  );
}

const AGENDA_PILL = {
  overdue: { box: "bg-negative-tint", text: "text-negative" },
  today: { box: "bg-accent-tint", text: "text-accent-ink" },
} as const;

/**
 * 1b "Tuần này · N việc" card (r20): rows with a 20px outline checkbox (negative when overdue),
 * the title and a status pill — "Quá hạn" / "Hôm nay" — or the mono due date for later days.
 */
export function AgendaCard({
  groups,
  onOpenPlanning,
}: {
  groups: AgendaGroup[];
  onOpenPlanning: () => void;
}) {
  const { t } = useTranslation();
  const count = groups.reduce((sum, group) => sum + group.tasks.length, 0);
  return (
    <Card
      radius={20}
      elevated
      padded={false}
      className="px-4 py-1.5"
      testID="overview-agenda"
    >
      <View className="flex-row items-center justify-between pb-1.5 pt-2.5">
        <Text className="font-sans-semibold text-[15px] leading-[18px] text-ink">
          {t("dashboard.agenda.title")}
          <Text className="font-sans text-muted">
            {" · "}
            {t("dashboard.overview.taskCount", { count })}
          </Text>
        </Text>
        <SectionLink
          label={t("dashboard.agenda.viewAll")}
          onPress={onOpenPlanning}
          testID="overview-open-planning"
        />
      </View>
      {groups.length === 0 ? (
        <Text className="border-t border-line py-3 font-sans text-[14px] text-muted">
          {t("dashboard.agenda.empty")}
        </Text>
      ) : null}
      {groups.flatMap((group) =>
        group.tasks.map((task) => (
          <View
            key={task.id}
            className="flex-row items-center gap-3 border-t border-line py-2.5"
          >
            <View
              className={`h-5 w-5 rounded-md border-[1.5px] ${group.key === "overdue" ? "border-negative" : "border-line-2"}`}
            />
            <Text
              className="min-w-0 flex-1 font-sans text-[14px] leading-[18px] text-ink"
              numberOfLines={1}
            >
              {task.title}
            </Text>
            {group.key === "thisWeek" ? (
              <Text className="font-mono-regular text-xs text-muted">
                {shortDayMonth(task.due_date)}
              </Text>
            ) : (
              <View
                className={`rounded-full px-[7px] py-0.5 ${AGENDA_PILL[group.key].box}`}
              >
                <Text
                  className={`font-sans-medium text-[11px] ${AGENDA_PILL[group.key].text}`}
                >
                  {t(`dashboard.agenda.${group.key}`)}
                </Text>
              </View>
            )}
          </View>
        )),
      )}
    </Card>
  );
}
