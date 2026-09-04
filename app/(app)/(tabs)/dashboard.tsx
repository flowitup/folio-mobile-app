import * as SecureStore from "expo-secure-store";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState } from "@/components/ui/primitives";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Select } from "@/components/ui/select";
import {
  BankReleaseCard,
  MoneyPanel,
  TypeMinis,
} from "@/features/dashboard/dashboard-cards";
import { useInvoices } from "@/features/invoices/invoices-api";
import {
  useDismissNotification,
  useNotifications,
} from "@/features/notes/notes-api";
import { useProjects } from "@/features/projects/projects-api";
import { useTasks } from "@/features/tasks/tasks-api";
import {
  buildDrawSeries,
  computeBankReleaseMetrics,
} from "@/lib/dashboard/bank-release-metrics";
import { groupAgendaTasks } from "@/lib/dashboard/overview-agenda";
import {
  buildMonthlySpendSeries,
  buildPurseViews,
  buildTypeMonthlyBuckets,
  computeBankOutstanding,
  computeBudgetMetrics,
  computeMonthDelta,
  computePendingRefunds,
  computeSpentTotal,
  sharedMonthlyMax,
} from "@/lib/dashboard/overview-metrics";
import { formatDate } from "@/lib/format/date";
import { useRefetchOnFocus } from "@/lib/query/use-refetch-on-focus";

const PROJECT_KEY = "folio.dashboard.project";

/** Dashboard for one project: money panel, bank release, spend by type, this-week agenda, reminders. */
export default function DashboardTab() {
  const { t } = useTranslation();
  const router = useRouter();
  const projects = useProjects();
  const [stored, setStored] = useState<string | null | undefined>(undefined);
  const [chosen, setChosen] = useState<string | null>(null);
  useEffect(() => {
    SecureStore.getItemAsync(PROJECT_KEY)
      .catch(() => null)
      .then((value) => setStored(value));
  }, []);
  const list = useMemo(() => projects.data?.projects ?? [], [projects.data]);
  const project =
    list.find((p) => p.id === chosen) ??
    list.find((p) => p.id === stored) ??
    list[0];
  const projectId = project?.id ?? "";

  const invoices = useInvoices(projectId);
  const tasks = useTasks(projectId);
  const notifications = useNotifications();
  const dismiss = useDismissNotification();
  useRefetchOnFocus(invoices.refetch);
  useRefetchOnFocus(tasks.refetch);
  useRefetchOnFocus(notifications.refetch);

  const referenceDate = useMemo(() => new Date(), []);
  const rows = useMemo(() => invoices.data?.invoices ?? [], [invoices.data]);
  const meta = invoices.data;
  const budgetValue = project?.budget == null ? null : Number(project.budget);
  const metrics = useMemo(() => {
    const spentTotal = computeSpentTotal(rows);
    const fundsReleased = meta?.funds_released_total ?? 0;
    return {
      spentTotal,
      budget: computeBudgetMetrics(budgetValue, spentTotal, fundsReleased),
      series: buildMonthlySpendSeries(rows, 6, referenceDate),
      purses: buildPurseViews(rows, {
        fundsReleasedTotal: fundsReleased,
        fundsReleasedCompanyTotal: meta?.funds_released_company_total,
        fundsReleasedPersonalTotal: meta?.funds_released_personal_total,
        companySpentTotal: meta?.company_spent_total ?? 0,
        personalSpentTotal: meta?.personal_spent_total,
      }),
      pendingCompany: computePendingRefunds(rows),
      pendingBank: computeBankOutstanding(rows),
      bank: computeBankReleaseMetrics(budgetValue, fundsReleased),
      draws: buildDrawSeries(rows),
      buckets: buildTypeMonthlyBuckets(rows, 6, referenceDate),
    };
  }, [rows, meta, budgetValue, referenceDate]);
  const agenda = useMemo(
    () => groupAgendaTasks(tasks.data ?? [], referenceDate),
    [tasks.data, referenceDate],
  );
  const pending = (notifications.data ?? []).filter((item) => !item.dismissed);

  return (
    <View className="flex-1 bg-white">
      <ScreenHeader title={t("tabs.dashboard")} />
      <ScrollView contentContainerClassName="p-4 pb-12">
        {projects.isPending ? <ActivityIndicator className="mt-8" /> : null}
        {projects.data && list.length === 0 ? (
          <EmptyState message={t("dashboard.noProjects")} />
        ) : null}
        {list.length > 0 ? (
          <Select
            testID="dashboard-project"
            label={t("dashboard.project")}
            value={projectId}
            options={list.map((p) => ({ value: p.id, label: p.name }))}
            onChange={(id) => {
              setChosen(id);
              void SecureStore.setItemAsync(PROJECT_KEY, id).catch(
                () => undefined,
              );
            }}
          />
        ) : null}
        {invoices.isError ? (
          <Text className="mb-3 text-sm text-danger">
            {t("dashboard.loadError")}
          </Text>
        ) : null}
        {project && invoices.isPending ? (
          <ActivityIndicator className="my-4" />
        ) : null}
        {project && invoices.data ? (
          <>
            <MoneyPanel
              budget={metrics.budget}
              spentTotal={metrics.spentTotal}
              series={metrics.series}
              deltaPct={computeMonthDelta(metrics.series).deltaPct}
              purses={metrics.purses}
              pendingCompany={metrics.pendingCompany}
              pendingBank={metrics.pendingBank}
            />
            <BankReleaseCard metrics={metrics.bank} draws={metrics.draws} />
            <TypeMinis
              buckets={metrics.buckets}
              max={sharedMonthlyMax(metrics.buckets)}
            />
            <Pressable
              testID="dashboard-expenses"
              onPress={() => router.push(`/projects/${project.id}/invoices`)}
              className="mb-3"
            >
              <Text className="text-sm text-primary underline">
                {t("dashboard.spendByType.viewExpense")} ›
              </Text>
            </Pressable>
          </>
        ) : null}

        {project ? (
          <Card className="mb-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-base font-semibold text-primary">
                {t("dashboard.agenda.title")}
              </Text>
              <Pressable
                testID="dashboard-agenda"
                onPress={() => router.push(`/projects/${project.id}/planning`)}
              >
                <Text className="text-sm text-primary">
                  {t("dashboard.agenda.viewAll")} ›
                </Text>
              </Pressable>
            </View>
            {agenda.length === 0 ? (
              <Text className="mt-2 text-sm text-muted-foreground">
                {t("dashboard.agenda.empty")}
              </Text>
            ) : null}
            {agenda.map((group) => (
              <View key={group.key} className="mt-2">
                <Text className="text-xs text-muted-foreground">
                  {t(`dashboard.agenda.${group.key}`)}
                </Text>
                {group.tasks.map((task) => (
                  <View
                    key={task.id}
                    className="flex-row items-center justify-between py-1"
                  >
                    <Text
                      className="flex-1 pr-2 text-sm text-primary"
                      numberOfLines={1}
                    >
                      ☐ {task.title}
                    </Text>
                    <Text className="text-xs text-muted-foreground">
                      {formatDate(task.due_date)}
                    </Text>
                    {group.key === "overdue" ? (
                      <View className="ml-1">
                        <Badge
                          label={t("dashboard.agenda.overdue")}
                          tone="danger"
                        />
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>
            ))}
          </Card>
        ) : null}

        <Card className="mb-3">
          <Text className="text-sm text-muted-foreground">
            {t("dashboard.weather")}
          </Text>
        </Card>

        <Text className="mb-2 text-sm font-medium text-muted-foreground">
          {t("notifications.title", { count: pending.length })}
        </Text>
        {notifications.isPending ? <ActivityIndicator /> : null}
        {!notifications.isPending && pending.length === 0 ? (
          <EmptyState message={t("notifications.none")} />
        ) : null}
        {pending.map(({ note }) => (
          <Card key={note.id} className="mb-2">
            <Pressable
              testID={`notification-${note.id}`}
              onPress={() => router.push(`/projects/${note.project_id}/notes`)}
            >
              <View className="flex-row items-center justify-between">
                <Text className="flex-1 pr-2 text-base font-medium text-primary">
                  {note.title}
                </Text>
                <Badge label={t(`notes.categories.${note.category}`)} />
              </View>
              {note.description ? (
                <Text className="text-sm text-primary">{note.description}</Text>
              ) : null}
              {note.due_date ? (
                <Text className="text-xs text-muted-foreground">
                  {t("notifications.due", { date: formatDate(note.due_date) })}
                </Text>
              ) : null}
            </Pressable>
            <Button
              testID={`notification-dismiss-${note.id}`}
              label={t("notifications.dismiss")}
              variant="secondary"
              size="sm"
              className="mt-2"
              onPress={() => dismiss.mutate({ noteId: note.id })}
            />
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}
