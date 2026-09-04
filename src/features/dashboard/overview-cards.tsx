import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { shortMonthLabel } from "@/components/ui/month-picker";
import { Card } from "@/components/ui/primitives";
import { Eyebrow, SectionLink } from "@/components/ui/typography";
import type { AgendaGroup } from "@/lib/dashboard/overview-agenda";
import type {
  BudgetMetrics,
  MonthlySpendPoint,
  TypeMonthlyBucket,
} from "@/lib/dashboard/overview-metrics";
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

function deltaColor(deltaPct: number | null, tokens: Tokens): string {
  if (deltaPct == null || deltaPct === 0) return tokens.muted;
  return deltaPct > 0 ? tokens.negative : tokens.positive;
}

type HeadlineProps = {
  budget: BudgetMetrics;
  spentTotal: number;
  spentByCredits: number;
  spentPersonal: number;
};

/** "Còn lại để chi": 38px mono figure, caption, 4px stacked bar (credit spend ink, personal muted-2). */
export function HeadlineBlock({
  budget,
  spentTotal,
  spentByCredits,
  spentPersonal,
}: HeadlineProps) {
  const { t } = useTranslation();
  const share = (value: number) =>
    budget.denominator > 0
      ? Math.min(100, Math.max(0, (value / budget.denominator) * 100))
      : 0;
  return (
    <View testID="overview-headline">
      <Eyebrow>{t("dashboard.remainingToSpend")}</Eyebrow>
      <Text
        testID="overview-remaining"
        className={`mt-1 font-mono text-[38px] leading-[42px] tracking-[-0.76px] ${budget.left < 0 ? "text-negative" : "text-ink"}`}
      >
        {formatMoney(budget.left)}
      </Text>
      <Text className="mt-1 font-sans text-[13px] text-muted">
        {t("dashboard.overview.pctSpent", { pct: budget.pct })} ·{" "}
        <Text className="font-mono text-ink">{formatMoney(spentTotal)}</Text>{" "}
        {t("dashboard.overview.ofCredit")}{" "}
        <Text className="font-mono">{formatMoney(budget.denominator)}</Text>{" "}
        {budget.usesBudget
          ? t("dashboard.overview.creditWord")
          : t("dashboard.overview.releasedWord")}
      </Text>
      <View className="mt-2.5 h-1 flex-row overflow-hidden rounded-sm bg-paper-2">
        <View
          className="h-1 bg-ink"
          style={{ width: `${share(spentByCredits)}%` }}
        />
        <View
          className="h-1 bg-muted-2"
          style={{ width: `${share(spentPersonal)}%` }}
        />
      </View>
      <View className="mt-1.5 flex-row gap-3.5">
        <View className="flex-row items-center gap-[5px]">
          <View className="h-2 w-2 rounded-sm bg-ink" />
          <Text className="font-sans text-[11px] text-muted">
            {t("project.spentByCredits")} {formatMoney(spentByCredits)}
          </Text>
        </View>
        <View className="flex-row items-center gap-[5px]">
          <View className="h-2 w-2 rounded-sm bg-muted-2" />
          <Text className="font-sans text-[11px] text-muted">
            {t("dashboard.overview.personal")} {formatMoney(spentPersonal)}
          </Text>
        </View>
      </View>
    </View>
  );
}

export type Figure = {
  key: string;
  label: string;
  value: string;
  tone?: "ink" | "warning";
};

/** Figures table: label muted / mono value; last row "Nhân công chưa trả · Trả ›" on warning tint. */
export function FiguresCard({
  figures,
  laborUnpaid,
  onPayLabor,
}: {
  figures: Figure[];
  laborUnpaid: number;
  onPayLabor: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Card padded={false} className="overflow-hidden" testID="overview-figures">
      {figures.map((figure) => (
        <View
          key={figure.key}
          className="flex-row items-center justify-between border-b border-line px-3.5 py-[11px]"
        >
          <Text className="font-sans text-[14px] text-muted">
            {figure.label}
          </Text>
          <Text
            testID={`overview-figure-${figure.key}`}
            className={`font-mono text-[14px] ${figure.tone === "warning" ? "text-warning" : "text-ink"}`}
          >
            {figure.value}
          </Text>
        </View>
      ))}
      <Pressable
        testID="overview-labor-unpaid"
        accessibilityRole="button"
        onPress={onPayLabor}
        className="flex-row items-center justify-between bg-warning-tint px-3.5 py-[11px] active:opacity-70"
      >
        <Text className="font-sans text-[14px] text-ink">
          {t("project.laborUnpaid")}
        </Text>
        <View className="flex-row items-center gap-2.5">
          <Text className="font-mono-semibold text-[14px] text-warning">
            {formatMoney(laborUnpaid)}
          </Text>
          <Text className="font-sans text-xs text-muted">
            {t("dashboard.overview.pay")} ›
          </Text>
        </View>
      </Pressable>
    </Card>
  );
}

const SPARK_HEIGHT = 14;

function Sparkline({
  points,
  color,
}: {
  points: MonthlySpendPoint[];
  color: string;
}) {
  const max = Math.max(1, ...points.map((p) => Math.max(p.total, 0)));
  return (
    <View
      className="mt-1.5 flex-row items-end gap-0.5"
      style={{ height: SPARK_HEIGHT }}
    >
      {points.map((point, index) => (
        <View
          key={point.key}
          className="flex-1 rounded-[1px]"
          style={{
            height: Math.max(
              SPARK_HEIGHT * 0.08,
              (Math.max(point.total, 0) / max) * SPARK_HEIGHT,
            ),
            backgroundColor: color,
            opacity: index === points.length - 1 ? 1 : 0.4,
          }}
        />
      ))}
    </View>
  );
}

/** "Chi theo loại · 6 tháng": grid 1fr / 74 / 52, color squares, mono current, colored Δ, sparkline, total row. */
export function SpendByTypeCard({
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
  const typeColor: Record<string, string> = {
    labor: tokens.accent,
    materials_services: tokens.ink,
    others: tokens.muted2,
  };
  return (
    <View testID="overview-spend-by-type">
      <View className="mb-2 flex-row items-end justify-between">
        <Eyebrow>{t("dashboard.overview.spendByType")}</Eyebrow>
        <SectionLink
          label={t("dashboard.overview.expensesLink")}
          onPress={onOpenExpenses}
          testID="overview-open-expenses"
        />
      </View>
      <Card padded={false} className="overflow-hidden">
        <View className="flex-row border-b border-line px-3.5 py-2">
          <Text className="flex-1 font-sans text-[10.5px] uppercase tracking-[0.84px] text-muted">
            {t("dashboard.overview.typeColumn")}
          </Text>
          <Text className="w-[74px] text-right font-sans text-[10.5px] uppercase tracking-[0.84px] text-muted">
            {shortMonthLabel(currentMonthKey)}
          </Text>
          <Text className="w-[52px] text-right font-sans text-[10.5px] uppercase tracking-[0.84px] text-muted">
            Δ
          </Text>
        </View>
        {buckets.map((bucket) => {
          const current = bucket.monthly[bucket.monthly.length - 1]?.total ?? 0;
          return (
            <View
              key={bucket.type}
              className="border-b border-line px-3.5 py-2.5"
            >
              <View className="flex-row items-center">
                <View className="flex-1 flex-row items-center gap-2">
                  <View
                    className="h-2 w-2 rounded-sm"
                    style={{ backgroundColor: typeColor[bucket.type] }}
                  />
                  <Text
                    className="font-sans text-[14px] text-ink"
                    numberOfLines={1}
                  >
                    {t(`invoices.types.${bucket.type}`)}
                  </Text>
                </View>
                <Text className="w-[74px] text-right font-mono-regular text-[14px] text-ink">
                  {formatMoney(current)}
                </Text>
                <Text
                  className="w-[52px] text-right font-mono-regular text-xs"
                  style={{ color: deltaColor(bucket.deltaPct, tokens) }}
                >
                  {formatDelta(bucket.deltaPct)}
                </Text>
              </View>
              <Sparkline
                points={bucket.monthly}
                color={typeColor[bucket.type]}
              />
            </View>
          );
        })}
        <View className="flex-row items-center px-3.5 py-2.5">
          <Text className="flex-1 font-sans-semibold text-[14px] text-ink">
            {t("dashboard.overview.monthTotal", {
              month: shortMonthLabel(currentMonthKey),
            })}
          </Text>
          <Text className="w-[74px] text-right font-mono-semibold text-[14px] text-ink">
            {formatMoney(totalCurrent)}
          </Text>
          <Text
            className="w-[52px] text-right font-mono-semibold text-xs"
            style={{ color: deltaColor(totalDeltaPct, tokens) }}
          >
            {formatDelta(totalDeltaPct)}
          </Text>
        </View>
      </Card>
    </View>
  );
}

const AGENDA_GROUP_CLASS = {
  overdue: "text-negative",
  today: "text-accent-ink",
  thisWeek: "text-muted",
} as const;

/** "Tuần này · N việc": grouped rows with a 16px outline checkbox, title and mono date. */
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
    <View testID="overview-agenda">
      <View className="mb-2 flex-row items-end justify-between">
        <Eyebrow>{t("dashboard.overview.thisWeek", { count })}</Eyebrow>
        <SectionLink
          label={t("dashboard.agenda.viewAll")}
          onPress={onOpenPlanning}
          testID="overview-open-planning"
        />
      </View>
      <Card padded={false} className="overflow-hidden">
        {groups.length === 0 ? (
          <Text className="px-3.5 py-3 font-sans text-[14px] text-muted">
            {t("dashboard.agenda.empty")}
          </Text>
        ) : null}
        {groups.map((group) => (
          <View key={group.key}>
            <Text
              className={`px-3.5 pb-0.5 pt-2 font-sans-medium text-[10.5px] uppercase tracking-[0.84px] ${AGENDA_GROUP_CLASS[group.key]}`}
            >
              {t(`dashboard.agenda.${group.key}`)}
            </Text>
            {group.tasks.map((task) => (
              <View
                key={task.id}
                className="flex-row items-center gap-2.5 border-b border-line px-3.5 py-2"
              >
                <View className="h-4 w-4 rounded border-[1.5px] border-line-2" />
                <Text
                  className="min-w-0 flex-1 font-sans text-[14px] text-ink"
                  numberOfLines={1}
                >
                  {task.title}
                </Text>
                <Text className="font-mono-regular text-xs text-muted">
                  {shortDayMonth(task.due_date)}
                </Text>
              </View>
            ))}
          </View>
        ))}
      </Card>
    </View>
  );
}
