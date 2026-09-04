import { useRouter } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, ScrollView, View } from "react-native";

import { ProjectTopBar } from "@/components/shell/project-top-bar";
import { EmptyState, ErrorState } from "@/components/ui/primitives";
import {
  AgendaCard,
  FiguresCard,
  HeadlineBlock,
  SpendByTypeCard,
} from "@/features/dashboard/overview-cards";
import type { Figure } from "@/features/dashboard/overview-cards";
import { useInvoices } from "@/features/invoices/invoices-api";
import { useSelectedProject } from "@/features/projects/selected-project";
import { useTasks } from "@/features/tasks/tasks-api";
import { computeBankReleaseMetrics } from "@/lib/dashboard/bank-release-metrics";
import { groupAgendaTasks } from "@/lib/dashboard/overview-agenda";
import {
  buildMonthlySpendSeries,
  buildTypeMonthlyBuckets,
  computeBudgetMetrics,
  computeMonthDelta,
  computePendingRefunds,
  computeSpentTotal,
} from "@/lib/dashboard/overview-metrics";
import { formatMoney } from "@/lib/format/money";
import { useRefetchOnFocus } from "@/lib/query/use-refetch-on-focus";
import { useTokens } from "@/theme/tokens";

/** Tổng quan: headline remaining, figures, spend by type (6 months), this week's agenda. */
export default function OverviewTab() {
  const { t } = useTranslation();
  const router = useRouter();
  const tokens = useTokens();
  const { project, projectId, isPending, isError, refetch } =
    useSelectedProject();
  const invoices = useInvoices(projectId);
  const tasks = useTasks(projectId);
  useRefetchOnFocus(invoices.refetch);
  useRefetchOnFocus(tasks.refetch);

  const referenceDate = useMemo(() => new Date(), []);
  const rows = useMemo(() => invoices.data?.invoices ?? [], [invoices.data]);
  const fundsReleased = invoices.data?.funds_released_total ?? 0;
  const budgetValue = project?.budget == null ? null : Number(project.budget);
  const metrics = useMemo(() => {
    const spentTotal = computeSpentTotal(rows);
    const series = buildMonthlySpendSeries(rows, 6, referenceDate);
    return {
      spentTotal,
      budget: computeBudgetMetrics(budgetValue, spentTotal, fundsReleased),
      series,
      monthDelta: computeMonthDelta(series),
      pendingCompany: computePendingRefunds(rows),
      bank: computeBankReleaseMetrics(budgetValue, fundsReleased),
      buckets: buildTypeMonthlyBuckets(rows, 6, referenceDate),
    };
  }, [rows, budgetValue, fundsReleased, referenceDate]);
  const agenda = useMemo(
    () => groupAgendaTasks(tasks.data ?? [], referenceDate),
    [tasks.data, referenceDate],
  );

  const figures: Figure[] = project
    ? [
        {
          key: "credit",
          label: t("dashboard.overview.budgetCredit"),
          value: formatMoney(metrics.budget.denominator),
        },
        {
          key: "spent",
          label: t("project.spent"),
          value: formatMoney(metrics.spentTotal),
        },
        {
          key: "credits",
          label: t("project.spentByCredits"),
          value: formatMoney(project.spent_by_credits ?? 0),
        },
        {
          key: "personal",
          label: t("project.spentPersonal"),
          value: formatMoney(project.spent_personal ?? 0),
        },
        {
          key: "bank",
          label: t("dashboard.overview.bankRemaining"),
          value: metrics.bank.hasCredit
            ? formatMoney(metrics.bank.remaining)
            : "—",
        },
        {
          key: "pending",
          label: t("dashboard.overview.pendingCompany", {
            count: metrics.pendingCompany.count,
          }),
          value: formatMoney(metrics.pendingCompany.total),
          tone: "warning",
        },
      ]
    : [];

  return (
    <View className="flex-1 bg-paper">
      <ProjectTopBar />
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-6 pt-5"
        contentContainerStyle={{ gap: 22 }}
      >
        {isPending ? (
          <ActivityIndicator className="mt-8" color={tokens.ink} />
        ) : null}
        {isError ? (
          <ErrorState
            message={t("home.loadError")}
            retryLabel={t("common.retry")}
            onRetry={refetch}
          />
        ) : null}
        {!isPending && !isError && !project ? (
          <EmptyState message={t("dashboard.noProjects")} />
        ) : null}
        {project && invoices.isPending ? (
          <ActivityIndicator className="my-4" color={tokens.ink} />
        ) : null}
        {project && invoices.isError ? (
          <ErrorState
            message={t("dashboard.loadError")}
            retryLabel={t("common.retry")}
            onRetry={() => void invoices.refetch()}
          />
        ) : null}
        {project && invoices.data ? (
          <>
            <HeadlineBlock
              budget={metrics.budget}
              spentTotal={metrics.spentTotal}
              spentByCredits={project.spent_by_credits ?? 0}
              spentPersonal={project.spent_personal ?? 0}
            />
            <FiguresCard
              figures={figures}
              laborUnpaid={project.labor_unpaid ?? 0}
              onPayLabor={() =>
                router.navigate({
                  pathname: "/(app)/(tabs)/labor",
                  params: { segment: "payments" },
                })
              }
            />
            <SpendByTypeCard
              buckets={metrics.buckets}
              currentMonthKey={metrics.monthDelta.current.key}
              totalCurrent={metrics.monthDelta.current.total}
              totalDeltaPct={metrics.monthDelta.deltaPct}
              onOpenExpenses={() => router.navigate("/(app)/(tabs)/expenses")}
            />
            <AgendaCard
              groups={agenda}
              onOpenPlanning={() => router.navigate("/(app)/(tabs)/planning")}
            />
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
