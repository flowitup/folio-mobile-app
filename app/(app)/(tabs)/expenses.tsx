import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { ProjectTopBar } from "@/components/shell/project-top-bar";
import { ChipRow } from "@/components/ui/chip";
import { Icon } from "@/components/ui/icon";
import { shortMonthLabel } from "@/components/ui/month-picker";
import { EmptyState, ErrorState } from "@/components/ui/primitives";
import { ScreenTitle } from "@/components/ui/typography";
import { useBillingAccess } from "@/features/companies/companies-api";
import {
  ExpenseMonthCard,
  PendingRefundBanner,
  PurseCard,
} from "@/features/invoices/expense-cards";
import { InvoiceExportSheet } from "@/features/invoices/invoice-export-sheet";
import type { InvoiceType } from "@/features/invoices/invoice-types";
import { useInvoices } from "@/features/invoices/invoices-api";
import { WorkerSalaryTab } from "@/features/labor/worker-salary-tab";
import { useWorkerMode } from "@/features/labor/use-worker-mode";
import { useSelectedProject } from "@/features/projects/selected-project";
import { currentMonth, formatMonth } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";
import { buildPursesSummary } from "@/lib/invoices/expense-purses";
import { groupInvoicesByMonth } from "@/lib/invoices/group-invoices-by-month";
import { useRefetchOnFocus } from "@/lib/query/use-refetch-on-focus";
import { useTokens } from "@/theme/tokens";

type Filter = "all" | Exclude<InvoiceType, "return">;
const FILTERS: Filter[] = [
  "all",
  "released_funds",
  "labor",
  "materials_services",
  "others",
];

/** Chi phí: month header, type chips, purse cards, pending refunds, month cards, export. */
function ExpensesTabContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const tokens = useTokens();
  const { projectId, project } = useSelectedProject();
  const [filter, setFilter] = useState<Filter>("all");
  const invoices = useInvoices(projectId);
  const billing = useBillingAccess();
  useRefetchOnFocus(invoices.refetch);
  const exportSheet = useRef<BottomSheetModal>(null);

  const rows = useMemo(() => invoices.data?.invoices ?? [], [invoices.data]);
  // Type filtering is client-side (README "Chi phí"): one list fetch, chips just narrow it.
  const months = useMemo(() => {
    const filtered =
      filter === "all" ? rows : rows.filter((inv) => inv.type === filter);
    return groupInvoicesByMonth(filtered)
      .map((month) => ({
        monthKey: month.monthKey,
        total: month.expenseSubtotal,
        invoices: month.categories.flatMap((category) => category.items),
      }))
      .filter((month) => month.invoices.length > 0);
  }, [rows, filter]);
  const summary = useMemo(() => buildPursesSummary(rows), [rows]);
  const thisMonth = useMemo(() => {
    const key = currentMonth();
    const group = groupInvoicesByMonth(rows).find((m) => m.monthKey === key);
    return {
      key,
      total: group?.expenseSubtotal ?? 0,
      count: group?.categories.reduce((n, c) => n + c.items.length, 0) ?? 0,
    };
  }, [rows]);
  const meta = invoices.data;
  const releasedPersonal = meta?.funds_released_personal_total ?? 0;
  const releasedCompany =
    meta?.funds_released_company_total ??
    (meta?.funds_released_total ?? 0) - releasedPersonal;

  return (
    <View className="flex-1 bg-paper">
      <ProjectTopBar />
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-6 pt-3.5"
        contentContainerStyle={{ gap: 16 }}
      >
        <View className="flex-row items-end justify-between">
          <View>
            <ScreenTitle testID="expenses-title">
              {t("tabs.expenses")}
            </ScreenTitle>
            <Text className="mt-1 font-sans text-[12.5px] text-muted">
              {shortMonthLabel(thisMonth.key)} ·{" "}
              <Text className="font-mono text-ink">
                {formatMoney(thisMonth.total)}
              </Text>{" "}
              · {t("expenses.itemsCount", { count: thisMonth.count })}
            </Text>
          </View>
          {project ? (
            <Pressable
              testID="invoices-create"
              accessibilityRole="button"
              onPress={() => router.push(`/projects/${projectId}/invoices/new`)}
              className="h-[38px] flex-row items-center gap-1.5 rounded-full bg-ink px-3.5 active:opacity-70"
            >
              <Icon name="plus" size={14} color={tokens.onInk} />
              <Text className="font-sans-semibold text-[13px] text-on-ink">
                {t("expenses.add")}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <ChipRow<Filter>
          testID="expenses-filter"
          options={FILTERS.map((value) => ({
            value,
            label:
              value === "all"
                ? t("invoices.all")
                : t(`expenses.filters.${value}`),
          }))}
          value={filter}
          onChange={setFilter}
        />

        {invoices.isPending ? (
          <ActivityIndicator className="mt-6" color={tokens.ink} />
        ) : null}
        {invoices.isError ? (
          <ErrorState
            message={t("home.loadError")}
            retryLabel={t("common.retry")}
            onRetry={() => void invoices.refetch()}
          />
        ) : null}

        {meta ? (
          <View className="flex-row gap-2.5">
            <PurseCard
              testID="expenses-purse-company"
              label={meta.company_name ?? t("invoices.summary.companyPurse")}
              released={releasedCompany}
              spent={summary.company.spent}
              tone="company"
            />
            <PurseCard
              testID="expenses-purse-personal"
              label={t("invoices.summary.personalPurse")}
              released={releasedPersonal}
              spent={summary.personal.spent}
              tone="personal"
            />
          </View>
        ) : null}
        {meta && summary.refundable.count > 0 ? (
          <PendingRefundBanner
            count={summary.refundable.count}
            total={summary.refundable.total}
            onPress={
              billing.allowed
                ? () => router.push("/billing/refundable")
                : undefined
            }
          />
        ) : null}

        {invoices.data && months.length === 0 ? (
          <EmptyState message={t("invoices.none")} />
        ) : null}
        {months.map((month) => (
          <ExpenseMonthCard
            key={month.monthKey}
            testID={`invoices-month-${month.monthKey}`}
            label={formatMonth(month.monthKey)}
            total={month.total}
            invoices={month.invoices}
            onOpen={(invoiceId) =>
              router.push(`/projects/${projectId}/invoices/${invoiceId}`)
            }
          />
        ))}

        {project ? (
          <Pressable
            testID="invoices-export"
            accessibilityRole="button"
            onPress={() => exportSheet.current?.present()}
            className="h-11 flex-row items-center justify-center gap-2 rounded-xl border border-line-2 active:opacity-70"
          >
            <Icon name="download" size={15} color={tokens.ink} />
            <Text className="font-sans-medium text-[13px] text-ink">
              {t("expenses.export")}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <InvoiceExportSheet ref={exportSheet} projectId={projectId} />
    </View>
  );
}

/** Worker mode (no project:manage_labor) replaces this tab with the worker's own view. */
export default function ExpensesTab() {
  const { workerMode } = useWorkerMode();
  return workerMode ? <WorkerSalaryTab /> : <ExpensesTabContent />;
}
