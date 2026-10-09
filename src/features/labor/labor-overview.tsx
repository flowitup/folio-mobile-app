import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { Avatar } from "@/components/ui/avatar";
import { ChipRow } from "@/components/ui/chip";
import { Icon } from "@/components/ui/icon";
import { MonthPicker } from "@/components/ui/month-picker";
import { Badge, Card, ErrorState } from "@/components/ui/primitives";
import type { LaborPaymentsSummary } from "@/features/invoices/invoices-api";
import {
  useLaborMonthlySummary,
  useLaborSummary,
} from "@/features/labor/labor-api";
import type { Worker } from "@/features/labor/labor-types";
import { formatMonth, localeTag, toIsoDate } from "@/lib/format/date";
import { formatMoney, formatNumber } from "@/lib/format/money";
import { dayCount } from "@/lib/labor/day-count";
import {
  CENT,
  availableYears,
  monthDetail,
  overviewMonths,
  rollupTotals,
  rowsInScope,
  scopeRange,
} from "@/lib/labor/labor-overview";
import type { OverviewMonth, OverviewScope } from "@/lib/labor/labor-overview";
import { useRefetchOnFocus } from "@/lib/query/use-refetch-on-focus";
import { useTokens } from "@/theme/tokens";

type Props = {
  projectId: string;
  workers: Worker[];
  payments: LaborPaymentsSummary | undefined;
  colorOf: (workerId: string) => string;
  roleOf: (workerId: string) => string | null;
};

/** "Sept 2026" — short month for the ledger cards, capitalised like the web. */
function shortMonth(year: number, month: number): string {
  const label = new Intl.DateTimeFormat(localeTag(), {
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Day counts: whole numbers bare, fractions up to two decimals ("5,5"). */
function days(value: number): string {
  return formatNumber(value, 2) || "0";
}

/** Horizontal share bar drawn with Views (no native SVG module in the app). */
function MiniBar({
  value,
  max,
  color,
  height = 6,
}: {
  value: number;
  max: number;
  color: string;
  height?: number;
}) {
  const share = Math.min(1, Math.max(0.02, value / (max || 1)));
  return (
    <View
      className="w-full overflow-hidden rounded-full bg-line"
      style={{ height }}
    >
      <View
        style={{
          width: `${share * 100}%`,
          height,
          borderRadius: height / 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

/** Muted "Company 550 € · Personal 40 €" line under a paid amount; nothing when both are 0. */
function PaidSplit({
  company,
  personal,
  testID,
}: {
  company: number;
  personal: number;
  testID?: string;
}) {
  const { t } = useTranslation();
  const parts: string[] = [];
  if (company > 0)
    parts.push(
      t("labor.overview.companyShare", { amount: formatMoney(company) }),
    );
  if (personal > 0)
    parts.push(
      t("labor.overview.personalShare", { amount: formatMoney(personal) }),
    );
  if (parts.length === 0) return null;
  return (
    <Text
      testID={testID}
      className="text-right font-mono-regular text-[10.5px] text-muted"
    >
      {parts.join(" · ")}
    </Text>
  );
}

function Kpi({
  label,
  value,
  caption,
  testID,
  accent = false,
}: {
  label: string;
  value: string;
  caption: string;
  testID: string;
  accent?: boolean;
}) {
  return (
    <Card radius={14} elevated className="flex-1 p-3">
      <Text
        className="font-sans text-[11px] uppercase tracking-[0.8px] text-muted"
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {label}
      </Text>
      <Text
        testID={testID}
        className={`mt-1 font-mono text-[18px] ${accent ? "text-accent-ink" : "text-ink"}`}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      <Text className="mt-1 font-sans text-[11px] text-muted" numberOfLines={2}>
        {caption}
      </Text>
    </Card>
  );
}

/**
 * Labor Summary (web parity): KPIs, then the monthly ledger — all history or one year, each
 * month with its crew, cost bar, paid amount and unpaid/overpaid warnings — and a single-month
 * view, worker by worker, with paid and balance. Tapping a month opens it.
 */
export function LaborOverview({
  projectId,
  workers,
  payments,
  colorOf,
  roleOf,
}: Props) {
  const { t } = useTranslation();
  const tokens = useTokens();
  const [scope, setScope] = useState<OverviewScope>({ kind: "all" });
  const [openMonths, setOpenMonths] = useState<Set<string>>(() => new Set());
  const range = scopeRange(scope);
  const today = toIsoDate(new Date());

  const monthly = useLaborMonthlySummary(projectId);
  // Scoped per-worker summary: banked hours and bonus figures for the KPIs, and the worker
  // rows of a single month.
  const scoped = useLaborSummary(projectId, range?.from, range?.to);
  const todaySummary = useLaborSummary(projectId, today, today);
  useRefetchOnFocus(monthly.refetch);
  useRefetchOnFocus(scoped.refetch);

  const allRows = useMemo(() => monthly.data?.rows ?? [], [monthly.data]);
  const years = useMemo(() => availableYears(allRows), [allRows]);
  const months = useMemo(
    () => overviewMonths(rowsInScope(allRows, scope), payments),
    [allRows, scope, payments],
  );
  const rollup = useMemo(() => rollupTotals(months), [months]);
  const maxCost = months.reduce((m, x) => Math.max(m, x.row.total_cost), 1);
  const workerById = useMemo(
    () => new Map(workers.map((w) => [w.id, w])),
    [workers],
  );

  const isMonth = scope.kind === "month";
  const detail = useMemo(
    () =>
      scope.kind === "month"
        ? monthDetail(scoped.data, payments, scope.month)
        : null,
    [scope, scoped.data, payments],
  );

  const totalCost = detail ? detail.cost : rollup.cost;
  const totalDays = detail ? detail.days : rollup.days;
  const workerCount = detail ? detail.lines.length : rollup.workerCount;
  const bankedHours = scoped.data?.total_banked_hours ?? 0;
  const bonusDays = scoped.data?.total_bonus_days ?? 0;
  const bonusCost = scoped.data?.total_bonus_cost ?? 0;
  const onSiteToday = todaySummary.data?.rows.length ?? 0;
  const periodLabel =
    scope.kind === "month"
      ? formatMonth(scope.month)
      : scope.kind === "year"
        ? String(scope.year)
        : t("labor.overview.allHistory");
  const title =
    scope.kind === "month"
      ? t("labor.overview.titleMonth", { month: formatMonth(scope.month) })
      : scope.kind === "year"
        ? t("labor.overview.titleYear", { year: scope.year })
        : t("labor.overview.titleAll");

  const chipValue =
    scope.kind === "month"
      ? "month"
      : scope.kind === "year"
        ? String(scope.year)
        : "all";
  const chipOptions = [
    { value: "all", label: t("labor.overview.allYears") },
    ...years.map((y) => ({ value: String(y), label: String(y) })),
    ...(scope.kind === "month"
      ? [{ value: "month", label: formatMonth(scope.month) }]
      : []),
  ];

  const toggle = (key: string) =>
    setOpenMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const loading = isMonth && scoped.isPending;

  if (monthly.isPending)
    return (
      <ActivityIndicator
        testID="labor-overview-loading"
        className="my-6"
        color={tokens.ink}
      />
    );

  // Without the monthly ledger every figure would read as 0 € and "No entries found".
  if (monthly.isError && !monthly.data)
    return (
      <ErrorState
        message={t("common.loadError")}
        retryLabel={t("common.retry")}
        onRetry={() => void monthly.refetch()}
      />
    );

  return (
    <View className="gap-4" testID="labor-overview">
      {bankedHours > 0 ? (
        <View
          testID="labor-overview-banner"
          className="rounded-[14px] bg-warning-tint p-3.5"
        >
          <Text className="font-sans-medium text-[13px] text-ink">
            {t("labor.overview.banner", {
              count: dayCount(bonusDays, 1),
              banked: formatNumber(bankedHours, 2),
              bonusDays: formatNumber(bonusDays, 1),
              bonusCost: formatMoney(bonusCost),
            })}
          </Text>
        </View>
      ) : null}

      <Card radius={16} elevated>
        <Text className="font-sans text-[11px] uppercase tracking-[0.8px] text-muted">
          {t("labor.overview.totalCost")}
        </Text>
        <Text
          testID="labor-overview-total"
          className="mt-1.5 font-mono text-[28px] text-ink"
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {formatMoney(totalCost)}
        </Text>
        <Text className="mt-1.5 font-sans text-[11.5px] text-positive">
          {periodLabel}
        </Text>
      </Card>
      <View className="flex-row gap-2">
        <Kpi
          testID="labor-overview-days"
          label={t("labor.overview.workerDays")}
          value={days(totalDays)}
          caption={t("labor.overview.acrossWorkers", { count: workerCount })}
        />
        <Kpi
          testID="labor-overview-today"
          label={t("labor.overview.onSiteToday")}
          value={String(onSiteToday)}
          caption={t("labor.overview.workersLogged")}
        />
        <Kpi
          testID="labor-overview-bonus"
          accent
          label={t("labor.overview.bonusCost")}
          value={formatMoney(bonusCost)}
          caption={t("labor.overview.bonusDaysSubtitle", {
            count: dayCount(bonusDays, 1),
            days: formatNumber(bonusDays, 1) || "0",
          })}
        />
      </View>

      <View className="gap-2.5">
        <Text className="font-sans-semibold text-[16px] text-ink">{title}</Text>
        <ChipRow
          testID="labor-overview-scope"
          value={chipValue}
          options={chipOptions}
          onChange={(value) => {
            if (value === "all") setScope({ kind: "all" });
            else if (value !== "month")
              setScope({ kind: "year", year: Number(value) });
          }}
        />
        {scope.kind === "month" ? (
          <MonthPicker
            testID="labor-overview-month"
            value={scope.month}
            onChange={(month) => setScope({ kind: "month", month })}
          />
        ) : null}
      </View>

      {loading ? (
        <ActivityIndicator className="my-6" color={tokens.ink} />
      ) : detail ? (
        <MonthDetailList detail={detail} colorOf={colorOf} roleOf={roleOf} />
      ) : months.length === 0 ? (
        <Text className="py-6 text-center font-sans text-[13px] text-muted">
          {t("labor.overview.empty")}
        </Text>
      ) : (
        <View className="gap-2.5">
          {months.map((m) => (
            <MonthCard
              key={m.key}
              month={m}
              maxCost={maxCost}
              open={openMonths.has(m.key)}
              onToggle={() => toggle(m.key)}
              onOpen={() => setScope({ kind: "month", month: m.key })}
              colorOf={colorOf}
              rateOf={(id) => {
                const w = workerById.get(id);
                return w ? (w.current_daily_rate ?? w.daily_rate) : null;
              }}
            />
          ))}
          <Card
            radius={14}
            className="bg-paper-2"
            testID="labor-overview-grand-total"
          >
            <View className="flex-row items-start justify-between gap-3">
              <View className="min-w-0 flex-1">
                <Text className="font-sans-semibold text-[14px] text-ink">
                  {t("labor.overview.grandTotal")}
                </Text>
                <Text className="mt-0.5 font-sans text-[11.5px] text-muted">
                  {t("labor.overview.workers", { count: rollup.workerCount })} ·{" "}
                  {days(rollup.days)}{" "}
                  {t("labor.overview.daysUnit", {
                    count: dayCount(rollup.days),
                  })}
                </Text>
              </View>
              <View className="items-end">
                <Text className="font-mono text-[15px] text-accent-ink">
                  {formatMoney(rollup.cost)}
                </Text>
                <Text className="mt-0.5 font-mono-regular text-[12px] text-ink">
                  {t("labor.overview.paid")}{" "}
                  {rollup.paid > 0 ? formatMoney(rollup.paid) : "—"}
                </Text>
              </View>
            </View>
            <PaidSplit
              company={rollup.companyPaid}
              personal={rollup.personalPaid}
              testID="labor-overview-total-split"
            />
          </Card>
        </View>
      )}
    </View>
  );
}

function MonthCard({
  month,
  maxCost,
  open,
  onToggle,
  onOpen,
  colorOf,
  rateOf,
}: {
  month: OverviewMonth;
  maxCost: number;
  open: boolean;
  onToggle: () => void;
  onOpen: () => void;
  colorOf: (workerId: string) => string;
  rateOf: (workerId: string) => number | null;
}) {
  const { t } = useTranslation();
  const tokens = useTokens();
  const { row, key } = month;
  return (
    <Card radius={14} elevated padded={false} testID={`overview-month-${key}`}>
      <Pressable
        testID={`overview-month-open-${key}`}
        accessibilityRole="button"
        accessibilityLabel={t("labor.overview.openMonth")}
        onPress={onOpen}
        className="px-3.5 pb-2.5 pt-3 active:opacity-70"
      >
        <View className="flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-1">
            <Text className="font-sans-semibold text-[15px] text-ink">
              {shortMonth(row.year, row.month)}
            </Text>
            <Text className="mt-0.5 font-sans text-[11.5px] text-muted">
              {t("labor.overview.workers", { count: row.workers.length })} ·{" "}
              {days(row.total_days)}{" "}
              {t("labor.overview.daysUnit", {
                count: dayCount(row.total_days),
              })}
            </Text>
          </View>
          <View className="items-end">
            <Text className="font-mono text-[15px] text-ink">
              {formatMoney(row.total_cost)}
            </Text>
            <Text className="mt-0.5 font-mono-regular text-[12px] text-muted">
              {t("labor.overview.paid")}{" "}
              <Text className="text-ink">
                {month.paid > 0 ? formatMoney(month.paid) : "—"}
              </Text>
            </Text>
          </View>
        </View>
        <View className="mt-2.5">
          <MiniBar value={row.total_cost} max={maxCost} color={tokens.accent} />
        </View>
        {month.unpaidWarning > 0 ||
        month.overpaidWarning > 0 ||
        month.unassignedCount > 0 ? (
          <View className="mt-2.5 flex-row flex-wrap gap-1.5">
            {month.unpaidWarning > 0 ? (
              <Badge
                testID={`overview-unpaid-${key}`}
                tone="warning"
                label={t("labor.overview.unpaid", {
                  amount: formatMoney(month.unpaidWarning),
                })}
              />
            ) : null}
            {month.overpaidWarning > 0 ? (
              <Badge
                testID={`overview-overpaid-${key}`}
                tone="danger"
                label={t("labor.overview.overpaid", {
                  amount: formatMoney(month.overpaidWarning),
                })}
              />
            ) : null}
            {month.unassignedCount > 0 ? (
              <Badge
                label={t("labor.overview.unassignedHint", {
                  count: month.unassignedCount,
                })}
              />
            ) : null}
          </View>
        ) : null}
        <View className="mt-1">
          <PaidSplit
            company={month.companyPaid}
            personal={month.personalPaid}
            testID={`overview-split-${key}`}
          />
        </View>
      </Pressable>
      <Pressable
        testID={`overview-month-toggle-${key}`}
        accessibilityRole="button"
        accessibilityLabel={t("labor.overview.toggleWorkers")}
        accessibilityState={{ expanded: open }}
        onPress={onToggle}
        className="flex-row items-center gap-1.5 border-t border-line px-3.5 py-2.5 active:opacity-70"
      >
        <View style={{ transform: [{ rotate: open ? "90deg" : "0deg" }] }}>
          <Icon name="chevron-right" size={14} color={tokens.muted} />
        </View>
        <View className="flex-1 flex-row items-center">
          {row.workers.slice(0, 6).map((w, i) => (
            <View
              key={w.worker_id}
              style={{
                marginLeft: i ? -6 : 0,
                borderWidth: 2,
                borderColor: tokens.card,
                borderRadius: 13,
              }}
            >
              <Avatar
                name={w.worker_name}
                size={22}
                color={colorOf(w.worker_id)}
              />
            </View>
          ))}
        </View>
      </Pressable>
      {open ? (
        <View className="gap-2.5 px-3.5 pb-3">
          {row.workers.map((w) => {
            const rate = rateOf(w.worker_id);
            const paid = month.paidByWorker.get(w.worker_id) ?? 0;
            const color = colorOf(w.worker_id);
            return (
              <View
                key={w.worker_id}
                testID={`overview-worker-${key}-${w.worker_id}`}
                className="gap-1.5"
              >
                <View className="flex-row items-center gap-2.5">
                  <Avatar name={w.worker_name} size={24} color={color} />
                  <View className="min-w-0 flex-1">
                    <Text
                      className="font-sans-medium text-[13px] text-ink"
                      numberOfLines={1}
                    >
                      {w.worker_name}
                    </Text>
                    <Text className="font-mono-regular text-[11px] text-muted">
                      {days(w.days_worked)}{" "}
                      {t("labor.overview.daysUnit", {
                        count: dayCount(w.days_worked),
                      })}
                      {rate != null && rate > 0
                        ? ` · ${t("labor.overview.perDay", { rate: formatMoney(rate) })}`
                        : ""}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="font-mono text-[13px] text-ink">
                      {formatMoney(w.total_cost)}
                    </Text>
                    <Text className="font-mono-regular text-[11px] text-muted">
                      {t("labor.overview.paid")}{" "}
                      {paid > 0 ? formatMoney(paid) : "—"}
                    </Text>
                  </View>
                </View>
                <MiniBar
                  value={w.total_cost}
                  max={maxCost}
                  color={color}
                  height={4}
                />
              </View>
            );
          })}
        </View>
      ) : null}
    </Card>
  );
}

function MonthDetailList({
  detail,
  colorOf,
  roleOf,
}: {
  detail: NonNullable<ReturnType<typeof monthDetail>>;
  colorOf: (workerId: string) => string;
  roleOf: (workerId: string) => string | null;
}) {
  const { t } = useTranslation();
  if (detail.lines.length === 0)
    return (
      <Text className="py-6 text-center font-sans text-[13px] text-muted">
        {t("labor.overview.empty")}
      </Text>
    );
  return (
    <View className="gap-2.5">
      {detail.lines.map((line) => {
        const overpaid = line.balance < -CENT;
        return (
          <Card
            key={line.workerId}
            radius={14}
            elevated
            testID={`overview-line-${line.workerId}`}
          >
            <View className="flex-row items-center gap-3">
              <Avatar
                name={line.name}
                size={34}
                color={colorOf(line.workerId)}
              />
              <View className="min-w-0 flex-1">
                <Text
                  className="font-sans-medium text-[14px] text-ink"
                  numberOfLines={1}
                >
                  {line.name}
                </Text>
                <Text
                  className="font-sans text-[11.5px] text-muted"
                  numberOfLines={1}
                >
                  {roleOf(line.workerId) ? `${roleOf(line.workerId)} · ` : ""}
                  {days(line.days)}{" "}
                  {t("labor.overview.daysUnit", { count: dayCount(line.days) })}
                </Text>
              </View>
              <Text className="font-mono text-[14px] text-ink">
                {formatMoney(line.cost)}
              </Text>
            </View>
            <View className="mt-2.5 flex-row justify-between border-t border-line pt-2.5">
              <View>
                <Text className="font-sans text-[11px] text-muted">
                  {t("labor.overview.paid")}
                </Text>
                <Text className="font-mono-regular text-[13px] text-ink">
                  {line.paid > 0 ? formatMoney(line.paid) : "—"}
                </Text>
              </View>
              <View className="items-center">
                <Text className="font-sans text-[11px] text-muted">
                  {t("labor.overview.bonusDays")}
                </Text>
                <Text className="font-mono-regular text-[13px] text-ink">
                  {line.bankedHours > 0
                    ? `${line.bonusFullDays}F + ${line.bonusHalfDays}H`
                    : "—"}
                </Text>
                {line.bankedHours > 0 ? (
                  <Text className="font-mono-regular text-[10.5px] text-muted">
                    {formatNumber(line.bankedHours, 2)}h ·{" "}
                    {formatMoney(line.bonusCost)}
                  </Text>
                ) : null}
              </View>
              <View className="items-end">
                <Text className="font-sans text-[11px] text-muted">
                  {t("labor.overview.balance")}
                </Text>
                <Text
                  testID={`overview-balance-${line.workerId}`}
                  className={`font-mono text-[13px] ${overpaid ? "text-negative" : "text-ink"}`}
                >
                  {formatMoney(line.balance)}
                </Text>
              </View>
            </View>
          </Card>
        );
      })}
      <Card
        radius={14}
        className="bg-paper-2"
        testID="labor-overview-grand-total"
      >
        <View className="flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-1">
            <Text className="font-sans-semibold text-[14px] text-ink">
              {t("labor.overview.grandTotal")}
            </Text>
            <Text className="mt-0.5 font-sans text-[11.5px] text-muted">
              {days(detail.days)}{" "}
              {t("labor.overview.daysUnit", { count: dayCount(detail.days) })}
              {detail.bonusCost > 0
                ? ` · ${t("labor.overview.bonusCost")} ${formatMoney(detail.bonusCost)}`
                : ""}
            </Text>
          </View>
          <View className="items-end">
            <Text className="font-mono text-[15px] text-accent-ink">
              {formatMoney(detail.cost)}
            </Text>
            <Text className="mt-0.5 font-mono-regular text-[12px] text-ink">
              {t("labor.overview.paid")}{" "}
              {detail.paid > 0 ? formatMoney(detail.paid) : "—"}
            </Text>
            <Text
              testID="labor-overview-month-balance"
              className={`mt-0.5 font-mono-regular text-[12px] ${detail.balance < -CENT ? "text-negative" : "text-accent-ink"}`}
            >
              {t("labor.overview.balance")} {formatMoney(detail.balance)}
            </Text>
          </View>
        </View>
      </Card>
    </View>
  );
}
