import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useShell } from "@/components/shell/shell-context";
import { ChipRow } from "@/components/ui/chip";
import { Icon } from "@/components/ui/icon";
import { InkFigure, InkSheetScreen } from "@/components/ui/ink-sheet-screen";
import { MonthPicker, shortMonthLabel } from "@/components/ui/month-picker";
import { EmptyState, ErrorState } from "@/components/ui/primitives";
import { useChatEnabled } from "@/features/chat/chat-api";
import { useBillingAccess } from "@/features/companies/companies-api";
import { deltaColor, formatDelta } from "@/features/dashboard/overview-cards";
import {
  ExpenseMonthCard,
  INK_FAB_SHADOW,
  MonthSectionHeader,
  PendingRefundBanner,
  PurseCard,
} from "@/features/invoices/expense-cards";
import { InvoiceExportSheet } from "@/features/invoices/invoice-export-sheet";
import type { InvoiceType } from "@/features/invoices/invoice-types";
import { useInvoices } from "@/features/invoices/invoices-api";
import { WorkerSalaryTab } from "@/features/labor/worker-salary-tab";
import { useWorkerMode } from "@/features/labor/use-worker-mode";
import { useSelectedProject } from "@/features/projects/selected-project";
import { currentMonth, formatMonth, shiftMonth } from "@/lib/format/date";
import { buildPursesSummary } from "@/lib/invoices/expense-purses";
import { groupInvoicesByMonth } from "@/lib/invoices/group-invoices-by-month";
import { useRefetchOnFocus } from "@/lib/query/use-refetch-on-focus";
import { DARK, INK_BLOCK, useTokens } from "@/theme/tokens";

type Filter = "all" | Exclude<InvoiceType, "return">;
const FILTERS: Filter[] = [
  "all",
  "released_funds",
  "labor",
  "materials_services",
  "others",
];

/**
 * Chi phí (design 1b): ink header — project ▾, Fraunces title, month stepper — and hero with the
 * selected month's total, count + delta, outlined purse cards; then the paper sheet: type chips,
 * refund banner, the selected month's rows (headless) and older months under section headers,
 * export button. Accent "+" FAB creates an invoice.
 */
function ExpensesTabContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const tokens = useTokens();
  const insets = useSafeAreaInsets();
  const { openSheet, tabBarHeight } = useShell();
  const {
    projectId,
    project,
    isPending: projectPending,
  } = useSelectedProject();
  const [filter, setFilter] = useState<Filter>("all");
  const [month, setMonth] = useState(currentMonth());
  const invoices = useInvoices(projectId);
  const billing = useBillingAccess();
  const chatEnabled = useChatEnabled();
  useRefetchOnFocus(invoices.refetch);
  const exportSheet = useRef<BottomSheetModal>(null);

  const rows = useMemo(() => invoices.data?.invoices ?? [], [invoices.data]);
  const allMonths = useMemo(() => groupInvoicesByMonth(rows), [rows]);
  // The stepper cannot go past the newest month that has data (or the current month).
  const latestMonth = allMonths[0]
    ? allMonths[0].monthKey > currentMonth()
      ? allMonths[0].monthKey
      : currentMonth()
    : currentMonth();
  // Type filtering is client-side (README "Chi phí"): one list fetch, chips just narrow it.
  // The list shows the selected month first, then the older months.
  const months = useMemo(() => {
    const filtered =
      filter === "all" ? rows : rows.filter((inv) => inv.type === filter);
    return groupInvoicesByMonth(filtered)
      .filter((group) => group.monthKey <= month)
      .map((group) => ({
        monthKey: group.monthKey,
        total: group.expenseSubtotal,
        invoices: group.categories.flatMap((category) => category.items),
      }))
      .filter((group) => group.invoices.length > 0);
  }, [rows, filter, month]);
  const summary = useMemo(() => buildPursesSummary(rows), [rows]);
  const headline = useMemo(() => {
    const countOf = (key: string) =>
      allMonths
        .find((m) => m.monthKey === key)
        ?.categories.reduce((n, c) => n + c.items.length, 0) ?? 0;
    const totalOf = (key: string) =>
      allMonths.find((m) => m.monthKey === key)?.expenseSubtotal ?? 0;
    const previous = shiftMonth(month, -1);
    const total = totalOf(month);
    const previousTotal = totalOf(previous);
    return {
      total,
      count: countOf(month),
      previous,
      deltaPct:
        previousTotal > 0
          ? Math.round(((total - previousTotal) / previousTotal) * 100)
          : null,
    };
  }, [allMonths, month]);
  const meta = invoices.data;
  const releasedPersonal = meta?.funds_released_personal_total ?? 0;
  const releasedCompany =
    meta?.funds_released_company_total ??
    (meta?.funds_released_total ?? 0) - releasedPersonal;

  return (
    <View className="flex-1">
      <InkSheetScreen
        gap={14}
        bottomPadding={96}
        header={
          <View
            className="flex-row items-center gap-2 bg-ink-block pl-5 pr-4"
            style={{ paddingTop: insets.top + 8 }}
          >
            <Pressable
              testID="top-bar-switcher"
              accessibilityRole="button"
              onPress={() => openSheet("switcher")}
              className="min-w-0 flex-1 active:opacity-70"
            >
              <View className="flex-row items-center gap-1">
                <Text
                  className="font-sans text-[11px] leading-[14px] text-ink-block-muted"
                  numberOfLines={1}
                >
                  {project?.name ??
                    (projectPending ? "…" : t("home.noProjects"))}
                </Text>
                <Icon name="chevron-down" size={10} color={INK_BLOCK.muted} />
              </View>
              <Text
                testID="expenses-title"
                className="font-serif-medium text-[26px] leading-[30px] text-on-ink-block"
              >
                {t("tabs.expenses")}
              </Text>
            </Pressable>
            <MonthPicker
              compact
              tone="ink"
              testID="expenses-month"
              value={month}
              onChange={(next) => setMonth(next > latestMonth ? month : next)}
              prevLabel={t("expenses.prevMonth")}
              nextLabel={t("expenses.nextMonth")}
            />
          </View>
        }
        hero={
          <View className="px-5 pb-[22px] pt-[18px]">
            {invoices.isPending ? (
              <ActivityIndicator className="my-6" color={INK_BLOCK.text} />
            ) : null}
            {meta ? (
              <>
                <InkFigure
                  amount={headline.total}
                  size={36}
                  testID="expenses-total"
                />
                <Text className="mt-1 font-sans text-[12.5px] leading-[17px] text-ink-block-muted">
                  {t("expenses.itemsCount", { count: headline.count })} ·{" "}
                  <Text style={{ color: deltaColor(headline.deltaPct, DARK) }}>
                    {formatDelta(headline.deltaPct)}
                  </Text>{" "}
                  {t("invoices.summary.vsMonth", {
                    delta: "",
                    month: shortMonthLabel(headline.previous),
                  }).trim()}
                </Text>
                <View className="mt-4 flex-row gap-2.5">
                  <PurseCard
                    testID="expenses-purse-company"
                    label={
                      meta.company_name ?? t("invoices.summary.companyPurse")
                    }
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
              </>
            ) : null}
          </View>
        }
      >
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

        {invoices.isError && !meta ? (
          <ErrorState
            message={t("home.loadError")}
            retryLabel={t("common.retry")}
            onRetry={() => void invoices.refetch()}
          />
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
        {months.map((group) => (
          <View key={group.monthKey} style={{ gap: 10 }}>
            {group.monthKey !== month ? (
              <MonthSectionHeader
                label={formatMonth(group.monthKey)}
                total={group.total}
              />
            ) : null}
            <ExpenseMonthCard
              testID={`invoices-month-${group.monthKey}`}
              invoices={group.invoices}
              onOpen={(invoiceId) =>
                router.push(`/projects/${projectId}/invoices/${invoiceId}`)
              }
            />
          </View>
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
      </InkSheetScreen>

      {project ? (
        <Pressable
          testID="invoices-create"
          accessibilityRole="button"
          accessibilityLabel={t("expenses.add")}
          onPress={() => router.push(`/projects/${projectId}/invoices/new`)}
          className="absolute right-5 h-14 w-14 items-center justify-center rounded-full bg-ink-block-accent active:opacity-80"
          style={{
            bottom: tabBarHeight + 12 + (chatEnabled ? 64 : 0),
            boxShadow: INK_FAB_SHADOW,
          }}
        >
          <Icon name="plus" size={24} color={INK_BLOCK.bg} />
        </Pressable>
      ) : null}

      <InvoiceExportSheet ref={exportSheet} projectId={projectId} />
    </View>
  );
}

/** Worker mode (no project:manage_labor) replaces this tab with the worker's own view. */
export default function ExpensesTab() {
  const { workerMode } = useWorkerMode();
  return workerMode ? <WorkerSalaryTab /> : <ExpensesTabContent />;
}
