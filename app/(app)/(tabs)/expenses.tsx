import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { ProjectTopBar } from "@/components/shell/project-top-bar";
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
import { RestrictedArea } from "@/features/labor/restricted-area";
import {
  useRestrictedMember,
  useWorkerMode,
} from "@/features/labor/use-worker-mode";
import { useSelectedProject } from "@/features/projects/selected-project";
import { useProjectCan } from "@/features/projects/use-project-can";
import { businessToday, formatMonth, shiftMonth } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";
import { buildPursesSummary } from "@/lib/invoices/expense-purses";
import {
  groupInvoicesByMonth,
  ledgerTypeOf,
} from "@/lib/invoices/group-invoices-by-month";
import { useRefetchOnFocus } from "@/lib/query/use-refetch-on-focus";
import { DARK, INK_BLOCK, useTokens } from "@/theme/tokens";
import { useInkStatusBar } from "@/theme/use-ink-status-bar";
import { refreshKeys, usePullToRefresh } from "@/lib/query/use-pull-to-refresh";

type Filter = "all" | Exclude<InvoiceType, "return">;
/** Diameter of the floating add button below — keep in step with its `h-14 w-14`. */
const FAB_SIZE = 56;

const FILTERS: Filter[] = [
  "all",
  "released_funds",
  "labor",
  "materials_services",
  "others",
];
/** Same chips minus the financing side, for a caller without `project:view_budget`. */
const SPEND_ONLY_FILTERS: Filter[] = FILTERS.filter(
  (value) => value !== "released_funds",
);

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
  // This screen builds its own ink header, so it owns the bar over it.
  useInkStatusBar(true);
  const { tabBarHeight } = useShell();
  const { projectId, project } = useSelectedProject();
  const [filter, setFilter] = useState<Filter>("all");
  // Opens on the business's (Paris) month, the one the overview calls "this month".
  const [month, setMonth] = useState(() => businessToday().slice(0, 7));
  // A bar or a type tapped on the overview opens this tab on its month and type. The link
  // carries a changing `focus` nonce so the same bar tapped again re-applies them.
  const params = useLocalSearchParams<{
    month?: string;
    type?: string;
    focus?: string;
  }>();
  useEffect(() => {
    if (!params.focus) return;
    if (params.month && /^\d{4}-\d{2}$/.test(params.month))
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMonth(params.month);
    setFilter(
      params.type && (FILTERS as string[]).includes(params.type)
        ? (params.type as Filter)
        : "all",
    );
  }, [params.month, params.type, params.focus]);
  const invoices = useInvoices(projectId);
  const canViewBudget = useProjectCan(projectId, "project:view_budget");
  // Writing an invoice needs `project:manage_invoices`; without it the form would only walk
  // the user into a 403 on submit, so the "+" never appears.
  const canManageInvoices = useProjectCan(projectId, "project:manage_invoices");
  // The backend exports invoices only for a full project view (manage_labor or view_pay, as
  // its labor scope rule); a restricted member would only get a 403 from the sheet.
  const canManageLabor = useProjectCan(projectId, "project:manage_labor");
  const canViewPay = useProjectCan(projectId, "project:view_pay");
  const canExport = canManageLabor || canViewPay;
  const billing = useBillingAccess();
  const chatEnabled = useChatEnabled();
  // The add button floats over the sheet, so the sheet has to end above it — otherwise the
  // last row (the export button) sits under it and its right end cannot be tapped.
  const fabOffset = tabBarHeight + 12 + (chatEnabled ? 64 : 0);
  useRefetchOnFocus(invoices.refetch);
  const pullToRefresh = usePullToRefresh([refreshKeys.projects], {
    onInk: true,
  });
  const exportSheet = useRef<BottomSheetModal>(null);

  const rows = useMemo(() => invoices.data?.invoices ?? [], [invoices.data]);
  const allMonths = useMemo(() => groupInvoicesByMonth(rows), [rows]);
  // The stepper cannot go past the newest month that has data (or the current month).
  const thisMonth = businessToday().slice(0, 7);
  const latestMonth =
    allMonths[0] && allMonths[0].monthKey > thisMonth
      ? allMonths[0].monthKey
      : thisMonth;
  // Type filtering is client-side (README "Chi phí"): one list fetch, chips just narrow it.
  // The list shows the selected month first, then the older months.
  const months = useMemo(() => {
    const filtered =
      filter === "all"
        ? rows
        : rows.filter((inv) => ledgerTypeOf(inv) === filter);
    return groupInvoicesByMonth(filtered)
      .filter((group) => group.monthKey <= month)
      .map((group) => ({
        monthKey: group.monthKey,
        // "All" heads the month with its spend (releases left out). With a chip
        // on, the header adds up exactly the rows listed under it, so the
        // released-funds chip shows the releases rather than 0.
        total:
          filter === "all"
            ? group.expenseSubtotal
            : group.categories.reduce((sum, c) => sum + c.subtotal, 0),
        // One date order for the whole card: the type groups have no header here, so
        // listing them back to back made the dates look shuffled.
        invoices: group.categories
          .flatMap((category) => category.items)
          .sort(
            (a, b) =>
              b.issue_date.localeCompare(a.issue_date) ||
              b.invoice_number.localeCompare(a.invoice_number),
          ),
      }))
      .filter((group) => group.invoices.length > 0);
  }, [rows, filter, month]);
  const summary = useMemo(() => buildPursesSummary(rows), [rows]);
  const headline = useMemo(() => {
    // The figure above it is the month's SPEND — `expenseSubtotal` leaves the release
    // rows out — so the count beside it has to leave them out too, or a month with one
    // disbursement reads "4 items" next to a total that only adds up three of them.
    // Counts say what they cover, like the web dashboard: "7 dépenses · 2 avoirs".
    const current = allMonths.find((m) => m.monthKey === month);
    const totalOf = (key: string) =>
      allMonths.find((m) => m.monthKey === key)?.expenseSubtotal ?? 0;
    const previous = shiftMonth(month, -1);
    const total = totalOf(month);
    const previousTotal = totalOf(previous);
    return {
      total,
      count: (current?.expenseCount ?? 0) - (current?.returnCount ?? 0),
      returns: current?.returnCount ?? 0,
      released: current?.releasedSubtotal ?? 0,
      previous,
      deltaPct:
        previousTotal > 0
          ? Math.round(((total - previousTotal) / previousTotal) * 100)
          : null,
    };
  }, [allMonths, month]);
  const meta = invoices.data;
  // Without `project:view_budget` the backend strips the release rows and
  // zeroes these totals, so the purse cards — spend as a share of what was
  // released — are hidden rather than drawn against zero.
  const releasedPersonal = meta?.funds_released_personal_total ?? 0;
  const releasedCompany =
    meta?.funds_released_company_total ??
    (meta?.funds_released_total ?? 0) - releasedPersonal;
  // Company purse spend = company-paid expenses + cash handed out to people (as on
  // the web): the handover left the company's hands, even though what it pays for
  // is booked elsewhere. The month headline and total expenses leave it out.
  const cashAdvanced = meta?.company_cash_advanced_total ?? 0;

  return (
    <View className="flex-1">
      <InkSheetScreen
        refreshControl={pullToRefresh}
        gap={14}
        bottomPadding={fabOffset + FAB_SIZE + 12}
        header={
          <View className="bg-ink-block">
            <ProjectTopBar tone="ink" />
            <View className="flex-row items-center gap-2 pb-1 pl-5 pr-4 pt-3">
              <Text
                testID="expenses-title"
                className="min-w-0 flex-1 font-serif-medium text-[26px] leading-[30px] text-on-ink-block"
                numberOfLines={1}
              >
                {t("tabs.expenses")}
              </Text>
              <MonthPicker
                compact
                tone="ink"
                testID="expenses-month"
                value={month}
                max={latestMonth}
                onChange={setMonth}
                prevLabel={t("expenses.prevMonth")}
                nextLabel={t("expenses.nextMonth")}
              />
            </View>
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
                  amount={
                    filter === "released_funds"
                      ? headline.released
                      : headline.total
                  }
                  size={36}
                  testID="expenses-total"
                />
                {filter === "released_funds" ? (
                  <Text
                    testID="expenses-total-caption"
                    className="mt-1 font-sans text-[12.5px] leading-[17px] text-ink-block-muted"
                  >
                    {t("invoices.summary.releasedTotal")}
                  </Text>
                ) : (
                  <Text
                    testID="expenses-total-caption"
                    className="mt-1 font-sans text-[12.5px] leading-[17px] text-ink-block-muted"
                  >
                    {t("expenses.spendCount", { count: headline.count })}
                    {headline.returns > 0
                      ? ` · ${t("expenses.returnsCount", { count: headline.returns })}`
                      : ""}{" "}
                    ·{" "}
                    <Text
                      style={{ color: deltaColor(headline.deltaPct, DARK) }}
                    >
                      {formatDelta(headline.deltaPct)}
                    </Text>{" "}
                    {t("invoices.summary.vsMonth", {
                      delta: "",
                      month: shortMonthLabel(headline.previous),
                    }).trim()}
                  </Text>
                )}
                {canViewBudget ? (
                  <View className="mt-4 flex-row gap-2.5">
                    <PurseCard
                      testID="expenses-purse-company"
                      label={
                        meta.company_name ?? t("invoices.summary.companyPurse")
                      }
                      released={releasedCompany}
                      spent={
                        (meta.company_spent_total ?? summary.company.spent) +
                        cashAdvanced
                      }
                      cashAdvanced={cashAdvanced}
                      tone="company"
                    />
                    <PurseCard
                      testID="expenses-purse-personal"
                      label={t("invoices.summary.personalPurse")}
                      released={releasedPersonal}
                      spent={
                        meta.personal_spent_total ?? summary.personal.spent
                      }
                      tone="personal"
                    />
                  </View>
                ) : null}
                {canViewBudget && summary.unassigned.count > 0 ? (
                  // Spend paid with a method flagged neither company nor personal sits in
                  // no purse; without this line the two cards cannot be squared with the
                  // project's total spend (the web shows the same note).
                  <Text
                    testID="expenses-no-purse"
                    accessibilityHint={t("invoices.summary.noPurseHint")}
                    className="mt-2 font-sans text-[12px] leading-[16px] text-ink-block-muted"
                  >
                    {t("invoices.summary.noPurseSpend", {
                      count: summary.unassigned.count,
                      amount: formatMoney(summary.unassigned.spent),
                    })}
                  </Text>
                ) : null}
              </>
            ) : null}
          </View>
        }
      >
        <ChipRow<Filter>
          testID="expenses-filter"
          options={(canViewBudget ? FILTERS : SPEND_ONLY_FILTERS).map(
            (value) => ({
              value,
              label:
                value === "all"
                  ? t("invoices.all")
                  : t(`expenses.filters.${value}`),
            }),
          )}
          value={filter}
          onChange={setFilter}
        />

        {invoices.isError && !meta ? (
          <ErrorState
            message={t("common.loadError")}
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

        {project && canExport ? (
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

      {project && canManageInvoices ? (
        <Pressable
          testID="invoices-create"
          accessibilityRole="button"
          accessibilityLabel={t("expenses.add")}
          onPress={() => router.push(`/projects/${projectId}/invoices/new`)}
          className="absolute right-5 h-14 w-14 items-center justify-center rounded-full bg-ink-block-accent active:opacity-80"
          style={{
            bottom: fabOffset,
            boxShadow: INK_FAB_SHADOW,
          }}
        >
          <Icon name="plus" size={24} color={INK_BLOCK.bg} />
        </Pressable>
      ) : null}

      <InvoiceExportSheet
        ref={exportSheet}
        projectId={projectId}
        canViewBudget={canViewBudget}
      />
    </View>
  );
}

/** Worker mode (no project:manage_labor) replaces this tab with the worker's own view. */
export default function ExpensesTab() {
  const { t } = useTranslation();
  const { workerMode } = useWorkerMode();
  const restricted = useRestrictedMember();
  if (workerMode) return <WorkerSalaryTab />;
  // An unlinked member without labor or pay access gets an empty ledger and zero totals.
  if (restricted)
    return (
      <RestrictedArea
        title={t("tabs.expenses")}
        message={t("labor.restricted.expenses")}
      />
    );
  return <ExpensesTabContent />;
}
