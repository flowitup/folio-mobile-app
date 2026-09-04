import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Badge, Card } from "@/components/ui/primitives";
import type {
  DrawSeries,
  BankReleaseMetrics,
} from "@/lib/dashboard/bank-release-metrics";
import type {
  BudgetMetrics,
  MonthlySpendPoint,
  MoneyPurseView,
  PendingRefunds,
  TypeMonthlyBucket,
} from "@/lib/dashboard/overview-metrics";
import { monthKeyToDate } from "@/lib/dashboard/overview-metrics";
import { formatDate, formatMonth } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";

const BAR_MAX_HEIGHT = 56;

function shortMonth(key: string): string {
  return monthKeyToDate(key).toLocaleDateString(undefined, { month: "short" });
}

/** Plain-view bar row (no SVG dependency): one bar per month, current month at full opacity. */
export function MonthBars({
  points,
  max,
  color = "#171717",
}: {
  points: MonthlySpendPoint[];
  max: number;
  color?: string;
}) {
  return (
    <View
      className="mt-2 flex-row items-end gap-1"
      style={{ height: BAR_MAX_HEIGHT + 18 }}
    >
      {points.map((point, index) => {
        const height = Math.max(
          2,
          Math.round((Math.max(point.total, 0) / max) * BAR_MAX_HEIGHT),
        );
        const current = index === points.length - 1;
        return (
          <View key={point.key} className="flex-1 items-center justify-end">
            {point.creditCount > 0 ? (
              <Text className="text-[10px] text-warning">▼</Text>
            ) : null}
            <View
              style={{
                width: "100%",
                height,
                backgroundColor: color,
                opacity: current ? 1 : 0.55,
                borderRadius: 2,
              }}
            />
            <Text className="mt-1 text-[10px] text-muted-foreground">
              {shortMonth(point.key)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

type MoneyPanelProps = {
  budget: BudgetMetrics;
  spentTotal: number;
  series: MonthlySpendPoint[];
  deltaPct: number | null;
  purses: MoneyPurseView[];
  pendingCompany: PendingRefunds;
  pendingBank: PendingRefunds;
};

/** Headline "remaining to spend", progress bar, 6-month bars, purses and refund pills. */
export function MoneyPanel({
  budget,
  spentTotal,
  series,
  deltaPct,
  purses,
  pendingCompany,
  pendingBank,
}: MoneyPanelProps) {
  const { t } = useTranslation();
  const current = series[series.length - 1];
  const previous = series[series.length - 2];
  const max = Math.max(1, ...series.map((p) => p.total));
  return (
    <Card className="mb-3">
      <Text className="text-xs text-muted-foreground">
        {t("dashboard.remainingToSpend")}
      </Text>
      <Text
        testID="dashboard-left"
        className={`text-2xl font-bold ${budget.left < 0 ? "text-danger" : "text-primary"}`}
      >
        {formatMoney(budget.left)}
      </Text>
      <Text className="text-xs text-muted-foreground">
        {t("dashboard.money.pctSpent", {
          pct: budget.pct,
          spent: formatMoney(spentTotal),
        })}
        {budget.usesBudget
          ? ` · ${t("dashboard.credit")} ${formatMoney(budget.denominator)}`
          : ""}
      </Text>
      <View className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
        <View
          className="h-2 rounded-full bg-warning"
          style={{ width: `${budget.pctClamped}%` }}
        />
      </View>
      <Text className="mt-3 text-xs text-muted-foreground">
        {t("dashboard.money.spentThisMonth")}:{" "}
        {formatMoney(current?.total ?? 0)}
        {deltaPct != null && previous
          ? ` · ${t("dashboard.summary.vsMonth", { delta: `${deltaPct > 0 ? "+" : ""}${deltaPct} %`, month: formatMonth(previous.key) })}`
          : ""}
        {current?.creditCount
          ? ` · ${t("dashboard.summary.returnsReceived", { n: current.creditCount })}`
          : ""}
      </Text>
      <MonthBars points={series} max={max} color="#f59e0b" />
      {purses.map((purse) => {
        const pct =
          purse.released > 0
            ? Math.min(100, Math.round((purse.spent / purse.released) * 100))
            : 0;
        const left = purse.released - purse.spent;
        return (
          <View key={purse.key} className="mt-3 border-t border-border pt-2">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-medium text-primary">
                {t(
                  purse.key === "company"
                    ? "dashboard.summary.companyPurse"
                    : "dashboard.summary.personalPurse",
                )}
              </Text>
              <Text
                className={`text-sm font-semibold ${left < 0 ? "text-danger" : "text-primary"}`}
              >
                {formatMoney(left)} {t("dashboard.summary.left")}
              </Text>
            </View>
            <Text className="text-xs text-muted-foreground">
              {t("dashboard.summary.released")} {formatMoney(purse.released)} ·{" "}
              {t("dashboard.summary.spent")} {formatMoney(purse.spent)} ·{" "}
              {t("dashboard.invoiceCount", { n: purse.count })} · {pct} %
            </Text>
          </View>
        );
      })}
      <View className="mt-3 flex-row flex-wrap gap-1">
        {pendingCompany.count > 0 ? (
          <Badge
            label={`${t("dashboard.summary.refundableByCompany")} · ${formatMoney(pendingCompany.total)} · ${t("dashboard.summary.refundableCount", { n: pendingCompany.count })}`}
            tone="warning"
          />
        ) : null}
        {pendingBank.count > 0 ? (
          <Badge
            label={`${t("dashboard.summary.refundableByBank")} · ${formatMoney(pendingBank.total)} · ${t("dashboard.summary.refundableCount", { n: pendingBank.count })}`}
          />
        ) : null}
      </View>
    </Card>
  );
}

/** Credit drawdown: headline, segmented track (one segment per draw), largest / last draw. */
export function BankReleaseCard({
  metrics,
  draws,
}: {
  metrics: BankReleaseMetrics;
  draws: DrawSeries;
}) {
  const { t } = useTranslation();
  const domain = Math.max(metrics.credit, draws.totalDrawn, 1);
  return (
    <Card className="mb-3">
      <Text className="text-xs text-muted-foreground">
        {t("dashboard.bankRelease.title")}
      </Text>
      {!metrics.hasCredit ? (
        <>
          <Text className="text-base text-primary">
            {t("dashboard.bankRelease.noCredit")}
          </Text>
          <Text className="text-xs text-muted-foreground">
            {t("dashboard.bankRelease.noCreditHint")}
          </Text>
        </>
      ) : (
        <>
          <Text
            testID="dashboard-bank-remaining"
            className={`text-2xl font-bold ${metrics.remaining < 0 ? "text-danger" : "text-primary"}`}
          >
            {metrics.remaining < 0
              ? `${t("dashboard.bankRelease.overDrawn")} `
              : ""}
            {formatMoney(Math.abs(metrics.remaining))}
          </Text>
          <Text className="text-xs text-muted-foreground">
            {t("dashboard.bankRelease.headlineMeta", {
              credit: formatMoney(metrics.credit),
              pct: `${metrics.pct} %`,
            })}
          </Text>
        </>
      )}
      <View className="mt-2 h-3 w-full flex-row overflow-hidden rounded-full bg-muted">
        {draws.draws.map((draw, index) => (
          <View
            key={draw.id}
            style={{
              width: `${(draw.amount / domain) * 100}%`,
              backgroundColor: index % 2 === 0 ? "#171717" : "#5a5348",
            }}
          />
        ))}
      </View>
      {draws.draws.length === 0 ? (
        <Text className="mt-2 text-xs text-muted-foreground">
          {t("dashboard.bankRelease.noReleases")}
        </Text>
      ) : (
        <Text className="mt-2 text-xs text-muted-foreground">
          {t("dashboard.bank.draws", { count: draws.draws.length })} ·{" "}
          {t("dashboard.bank.segments")}
          {draws.largest
            ? ` · ${t("dashboard.bankRelease.largestDraw")} ${formatMoney(draws.largest.amount)} (${formatDate(draws.largest.date)})`
            : ""}
          {draws.last
            ? ` · ${t("dashboard.bankRelease.lastDraw")} ${formatMoney(draws.last.amount)} (${formatDate(draws.last.date)})`
            : ""}
        </Text>
      )}
    </Card>
  );
}

const TYPE_COLOR: Record<string, string> = {
  labor: "#f59e0b",
  materials_services: "#171717",
  others: "#737373",
};

/** "Monthly spend by type" small multiples on one shared scale. */
export function TypeMinis({
  buckets,
  max,
}: {
  buckets: TypeMonthlyBucket[];
  max: number;
}) {
  const { t } = useTranslation();
  return (
    <Card className="mb-3">
      <Text className="mb-1 text-base font-semibold text-primary">
        {t("dashboard.spendByType.title")}
      </Text>
      {buckets.map((bucket) => (
        <View key={bucket.type} className="mt-2 border-t border-border pt-2">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-medium text-primary">
              {t(`invoices.types.${bucket.type}`)}
            </Text>
            <Text className="text-sm text-primary">
              {formatMoney(bucket.total)} ·{" "}
              {t("dashboard.invoiceCount", { n: bucket.count })}
              {bucket.deltaPct != null
                ? ` · ${bucket.deltaPct > 0 ? "+" : ""}${bucket.deltaPct} %`
                : ""}
            </Text>
          </View>
          <MonthBars
            points={bucket.monthly}
            max={max}
            color={TYPE_COLOR[bucket.type]}
          />
        </View>
      ))}
      <Text className="mt-2 text-xs text-muted-foreground">
        {t("dashboard.spendByType.currentHighlighted")}
      </Text>
    </Card>
  );
}
