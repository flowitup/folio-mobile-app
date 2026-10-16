import i18n from "@/i18n";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { shortMonthLabel } from "@/components/ui/month-picker";
import { Card } from "@/components/ui/primitives";
import { localeTag } from "@/lib/format/date";
import { SectionLink } from "@/components/ui/typography";
import type { AgendaGroup } from "@/lib/dashboard/overview-agenda";
import {
  sharedMonthlyMax,
  type TypeMonthlyBucket,
} from "@/lib/dashboard/overview-metrics";
import { formatMoney, formatNumber } from "@/lib/format/money";
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

/**
 * Neutral, whatever the sign: spending less is not good news by itself (labor accrued but not
 * yet paid reads −100 %), and a month still running compares with a whole one.
 */
export function deltaColor(_deltaPct: number | null, tokens: Tokens): string {
  return tokens.muted;
}

/** Axis tick for a "YYYY-MM" month: the short month name ("mai", "sept."), "T9" in Vietnamese. */
export function monthTick(key: string): string {
  const m = Number(key.slice(5, 7));
  return i18n.language === "vi" ? `T${m}` : shortMonthLabel(key);
}

/** A bar's value in a few characters: "850", "1,2 k", "12 k", "1,5 M". */
export function compactAmount(value: number): string {
  const abs = Math.abs(value);
  if (abs < 1000) return formatNumber(Math.round(value), 0);
  if (abs < 1_000_000)
    return `${formatNumber(value / 1000, abs < 10_000 ? 1 : 0)} k`;
  return `${formatNumber(value / 1_000_000, 1)} M`;
}

type ExpenseFilters = { month?: string; type?: string };

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
  onOpenExpenses: (filters?: ExpenseFilters) => void;
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
      onPress={() => onOpenExpenses({ month: currentMonthKey })}
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
            <Pressable
              key={bucket.type}
              testID={`overview-type-open-${bucket.type}`}
              accessibilityRole="button"
              accessibilityLabel={`${t(`expenses.filters.${bucket.type}`)} · ${formatMoney(bucket.value)}`}
              onPress={() =>
                onOpenExpenses({ month: currentMonthKey, type: bucket.type })
              }
              className="min-w-0 flex-1 active:opacity-60"
            >
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
            </Pressable>
          ))}
        </View>
      </Card>
    </Pressable>
  );
}

const TREND_BAR_AREA = 56;
/** Room above the tallest bar for its value label. */
const TREND_VALUE_H = 14;

function formatMonthLong(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Intl.DateTimeFormat(localeTag(), {
    month: "long",
    year: "numeric",
  }).format(new Date(y, m - 1, 1));
}

/**
 * Web "Monthly spend by type": one small multiple per expense type, six month bars on one shared
 * scale with the current month solid and the earlier ones faded, net of returns.
 */
export function TypeTrendsCard({
  buckets,
  onOpenExpenses,
}: {
  buckets: TypeMonthlyBucket[];
  onOpenExpenses: (filters?: ExpenseFilters) => void;
}) {
  const { t } = useTranslation();
  const tokens = useTokens();
  const colors = expenseTypeColor(tokens);
  // One scale for the three types, so their bars compare.
  const sharedMax = sharedMonthlyMax(buckets);
  const sixMonthTotal = buckets.reduce((acc, bucket) => acc + bucket.total, 0);
  return (
    <Pressable
      testID="overview-type-trends"
      accessibilityRole="button"
      onPress={() => onOpenExpenses()}
      className="active:opacity-80"
    >
      <Card radius={20} elevated>
        <View className="flex-row items-baseline justify-between">
          <Text className="font-sans-semibold text-[15px] leading-[18px] text-ink">
            {t("dashboard.overview.spendByType")}
          </Text>
          <Text className="font-mono-semibold text-[13px] text-ink">
            {formatMoney(sixMonthTotal)}
          </Text>
        </View>
        {buckets.map((bucket) => {
          const lastIdx = bucket.monthly.length - 1;
          return (
            <View key={bucket.type} className="mt-4">
              <Pressable
                testID={`overview-trend-type-${bucket.type}`}
                accessibilityRole="button"
                onPress={() => onOpenExpenses({ type: bucket.type })}
                className="flex-row items-center justify-between active:opacity-60"
              >
                <View className="flex-row items-center gap-[5px]">
                  <View
                    className="h-2 w-2 rounded-sm"
                    style={{ backgroundColor: colors[bucket.type] }}
                  />
                  <Text className="font-sans-medium text-[12.5px] text-ink">
                    {t(`expenses.filters.${bucket.type}`)}
                  </Text>
                </View>
                <Text className="font-mono text-[13px] text-ink">
                  {formatMoney(bucket.total)}
                </Text>
              </Pressable>
              {/* Each column opens that type's expenses of that month; its value sits on top. */}
              <View
                className="mt-2 flex-row items-end gap-1.5 border-b border-line"
                style={{ height: TREND_BAR_AREA + TREND_VALUE_H }}
              >
                {bucket.monthly.map((point, i) => (
                  <Pressable
                    key={point.key}
                    testID={`overview-trend-bar-${bucket.type}-${point.key}`}
                    accessibilityRole="button"
                    accessibilityLabel={`${t(`expenses.filters.${bucket.type}`)} · ${formatMonthLong(point.key)} · ${formatMoney(point.total)}`}
                    onPress={() =>
                      onOpenExpenses({ type: bucket.type, month: point.key })
                    }
                    className="h-full flex-1 justify-end active:opacity-60"
                  >
                    {point.total !== 0 ? (
                      <Text
                        className="text-center font-mono-regular text-[9px] text-muted"
                        numberOfLines={1}
                        testID={`overview-trend-value-${bucket.type}-${point.key}`}
                      >
                        {compactAmount(point.total)}
                      </Text>
                    ) : null}
                    <View
                      className="rounded-t-[3px]"
                      style={{
                        height: Math.max(
                          (Math.max(point.total, 0) / sharedMax) *
                            TREND_BAR_AREA,
                          2,
                        ),
                        backgroundColor: colors[bucket.type],
                        opacity: i === lastIdx ? 1 : 0.55,
                      }}
                    />
                  </Pressable>
                ))}
              </View>
              <View className="mt-1 flex-row gap-1.5">
                {bucket.monthly.map((point) => (
                  <Text
                    key={point.key}
                    className="flex-1 text-center font-sans text-[10px] text-muted"
                    numberOfLines={1}
                    testID={`overview-trend-tick-${bucket.type}-${point.key}`}
                  >
                    {monthTick(point.key)}
                  </Text>
                ))}
              </View>
            </View>
          );
        })}
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
  onOpenTask,
}: {
  groups: AgendaGroup[];
  onOpenPlanning: () => void;
  /** Opens one task on the board, as on the web. */
  onOpenTask?: (taskId: string) => void;
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
          <Pressable
            key={task.id}
            testID={`overview-agenda-task-${task.id}`}
            accessibilityRole="button"
            accessibilityLabel={task.title}
            onPress={() =>
              onOpenTask ? onOpenTask(task.id) : onOpenPlanning()
            }
            className="flex-row items-center gap-3 border-t border-line py-2.5 active:opacity-60"
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
          </Pressable>
        )),
      )}
    </Card>
  );
}
