import { useRouter } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, View } from "react-native";

import { ProjectTopBar } from "@/components/shell/project-top-bar";
import { InkSheetScreen } from "@/components/ui/ink-sheet-screen";
import { EmptyState, ErrorState } from "@/components/ui/primitives";
import { useBillingAccess } from "@/features/companies/companies-api";
import {
  AgendaCard,
  MonthSpendCard,
} from "@/features/dashboard/overview-cards";
import { OverviewDueTiles } from "@/features/dashboard/overview-due-tiles";
import { OverviewHero } from "@/features/dashboard/overview-hero";
import { TodayOnSiteCard } from "@/features/dashboard/today-on-site-card";
import { useInvoices } from "@/features/invoices/invoices-api";
import { useLaborEntries } from "@/features/labor/labor-api";
import { WorkerAttendanceTab } from "@/features/labor/worker-attendance-tab";
import { useWorkerMode } from "@/features/labor/use-worker-mode";
import { useSelectedProject } from "@/features/projects/selected-project";
import { useTasks } from "@/features/tasks/tasks-api";
import { computeBankReleaseMetrics } from "@/lib/dashboard/bank-release-metrics";
import { countWorkersOnSite } from "@/lib/dashboard/weather";
import { groupAgendaTasks } from "@/lib/dashboard/overview-agenda";
import {
  buildMonthlySpendSeries,
  buildTypeMonthlyBuckets,
  computeBudgetMetrics,
  computeMonthDelta,
  computePendingRefunds,
  computeSpentTotal,
} from "@/lib/dashboard/overview-metrics";
import { toIsoDate } from "@/lib/format/date";
import { useRefetchOnFocus } from "@/lib/query/use-refetch-on-focus";
import { INK_BLOCK } from "@/theme/tokens";

/**
 * Tổng quan (design 1b): ink hero — remaining figure, ring gauge, quick actions — then the paper
 * sheet: due tiles, this month's spend by type, this week's agenda, today on site.
 */
function OverviewTabContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const { project, projectId, isPending, isError, refetch } =
    useSelectedProject();
  const invoices = useInvoices(projectId);
  const tasks = useTasks(projectId);
  const billing = useBillingAccess();
  useRefetchOnFocus(invoices.refetch);
  useRefetchOnFocus(tasks.refetch);

  const referenceDate = useMemo(() => new Date(), []);
  const todayIso = useMemo(() => toIsoDate(referenceDate), [referenceDate]);
  const todayEntries = useLaborEntries(projectId, todayIso, todayIso);
  useRefetchOnFocus(todayEntries.refetch);
  const workersOnSite = useMemo(
    () => countWorkersOnSite(todayEntries.data, todayIso),
    [todayEntries.data, todayIso],
  );
  const rows = useMemo(() => invoices.data?.invoices ?? [], [invoices.data]);
  const fundsReleased = invoices.data?.funds_released_total ?? 0;
  const budgetValue = project?.budget == null ? null : Number(project.budget);
  const metrics = useMemo(() => {
    const spentTotal = computeSpentTotal(rows);
    const series = buildMonthlySpendSeries(rows, 6, referenceDate);
    return {
      spentTotal,
      budget: computeBudgetMetrics(budgetValue, spentTotal, fundsReleased),
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

  const ready = Boolean(project && invoices.data);
  const payLabor = () =>
    router.navigate({
      pathname: "/(app)/(tabs)/labor",
      params: { segment: "payments" },
    });

  return (
    <InkSheetScreen
      header={<ProjectTopBar tone="ink" />}
      hero={
        ready && project ? (
          <OverviewHero
            budget={metrics.budget}
            spentTotal={metrics.spentTotal}
            spentByCredits={project.spent_by_credits ?? 0}
            spentPersonal={project.spent_personal ?? 0}
            bankRemaining={
              metrics.bank.hasCredit ? metrics.bank.remaining : null
            }
            onAddInvoice={() =>
              router.push(`/projects/${projectId}/invoices/new`)
            }
            onAddRelease={() =>
              router.push({
                pathname: `/projects/${projectId}/invoices/new`,
                params: { type: "released_funds" },
              })
            }
            onPayLabor={payLabor}
          />
        ) : (
          <View className="h-24 items-center justify-center">
            {isPending || (project && invoices.isPending) ? (
              <ActivityIndicator color={INK_BLOCK.text} />
            ) : null}
          </View>
        )
      }
    >
      {isError && !project ? (
        <ErrorState
          message={t("home.loadError")}
          retryLabel={t("common.retry")}
          onRetry={refetch}
        />
      ) : null}
      {!isPending && !isError && !project ? (
        <EmptyState message={t("dashboard.noProjects")} />
      ) : null}
      {project && invoices.isError && !invoices.data ? (
        <ErrorState
          message={t("dashboard.loadError")}
          retryLabel={t("common.retry")}
          onRetry={() => void invoices.refetch()}
        />
      ) : null}
      {ready && project ? (
        <>
          <OverviewDueTiles
            laborUnpaid={project.labor_unpaid ?? 0}
            pendingRefundCount={metrics.pendingCompany.count}
            pendingRefundTotal={metrics.pendingCompany.total}
            onPayLabor={payLabor}
            onOpenRefunds={() =>
              billing.allowed
                ? router.push("/billing/refundable")
                : router.navigate("/(app)/(tabs)/expenses")
            }
          />
          <MonthSpendCard
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
          <TodayOnSiteCard
            address={project.address}
            workersOnSite={workersOnSite}
          />
        </>
      ) : null}
    </InkSheetScreen>
  );
}

/** Worker mode (no project:manage_labor) replaces this tab with the worker's own view. */
export default function OverviewTab() {
  const { workerMode } = useWorkerMode();
  return workerMode ? <WorkerAttendanceTab /> : <OverviewTabContent />;
}
