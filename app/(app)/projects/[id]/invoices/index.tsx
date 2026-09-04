import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { Button } from "@/components/ui/button";
import { MonthPicker } from "@/components/ui/month-picker";
import { EmptyState, ErrorState } from "@/components/ui/primitives";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import { showToast } from "@/components/ui/toast";
import { INVOICE_TYPES } from "@/features/invoices/invoice-form";
import { ExpensePursesCard } from "@/features/invoices/expense-purses-card";
import { InvoiceRow } from "@/features/invoices/invoice-row";
import type {
  InvoiceExportFormat,
  InvoiceType,
} from "@/features/invoices/invoice-types";
import {
  exportInvoices,
  useInvoices,
  useLaborPaymentsSummary,
} from "@/features/invoices/invoices-api";
import { BankReleaseCard } from "@/features/dashboard/dashboard-cards";
import { useProject } from "@/features/projects/projects-api";
import { useTags } from "@/features/projects/tags-api";
import {
  buildDrawSeries,
  computeBankReleaseMetrics,
} from "@/lib/dashboard/bank-release-metrics";
import { buildPursesSummary } from "@/lib/invoices/expense-purses";
import { currentMonth, formatMonth } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";
import { groupInvoicesByMonth } from "@/lib/invoices/group-invoices-by-month";
import { groupLaborInvoicesByWorker } from "@/lib/invoices/group-labor-invoices-by-worker";
import { useRefetchOnFocus } from "@/lib/query/use-refetch-on-focus";

type Tab = "all" | InvoiceType;

/** Expenses ledger: tabs per type, month-grouped "all" view, labor grouped by worker, tag filter, export. */
export default function ProjectInvoicesSection() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>("all");
  const [tagId, setTagId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const invoices = useInvoices(id, {
    type: tab === "all" ? undefined : tab,
    tagId,
  });
  const tags = useTags(id);
  const laborSummary = useLaborPaymentsSummary(id, tab === "labor");
  useRefetchOnFocus(invoices.refetch);

  const exportSheet = useRef<BottomSheetModal>(null);
  const [exportFormat, setExportFormat] = useState<InvoiceExportFormat>("xlsx");
  const [exportFrom, setExportFrom] = useState(currentMonth());
  const [exportTo, setExportTo] = useState(currentMonth());
  const [exportType, setExportType] = useState<Tab>("all");
  const [exporting, setExporting] = useState(false);

  const project = useProject(id);
  const rows = useMemo(() => invoices.data?.invoices ?? [], [invoices.data]);
  const monthGroups = useMemo(
    () => (tab === "all" ? groupInvoicesByMonth(rows) : []),
    [rows, tab],
  );
  const workerGroups = useMemo(
    () => (tab === "labor" ? groupLaborInvoicesByWorker(rows) : []),
    [rows, tab],
  );
  const paidByWorker = useMemo(() => {
    const map = new Map<string, number>();
    for (const month of laborSummary.data?.months ?? [])
      for (const worker of month.workers)
        map.set(
          worker.worker_id,
          (map.get(worker.worker_id) ?? 0) + worker.paid,
        );
    return map;
  }, [laborSummary.data]);

  const open = (invoiceId: string) =>
    router.push(`/projects/${id}/invoices/${invoiceId}`);
  const toggleMonth = (key: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  async function runExport() {
    setExporting(true);
    try {
      await exportInvoices(
        id,
        exportFormat,
        exportFrom,
        exportTo,
        exportType === "all" ? undefined : exportType,
      );
      exportSheet.current?.dismiss();
    } catch (caught) {
      showToast((caught as Error).message, "error");
    } finally {
      setExporting(false);
    }
  }

  const meta = invoices.data;

  return (
    <View className="flex-1 bg-white">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="max-h-11 border-b border-border"
        contentContainerClassName="px-2"
      >
        {(["all", ...INVOICE_TYPES] as Tab[]).map((value) => (
          <Pressable
            key={value}
            testID={`invoices-tab-${value}`}
            onPress={() => setTab(value)}
            className={`justify-center border-b-2 px-3 ${tab === value ? "border-primary" : "border-transparent"}`}
          >
            <Text
              className={
                tab === value
                  ? "font-semibold text-primary"
                  : "text-muted-foreground"
              }
            >
              {value === "all"
                ? t("invoices.all")
                : t(`invoices.types.${value}`)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView className="flex-1" contentContainerClassName="p-4 pb-12">
        <View className="mb-2 flex-row items-center gap-2">
          <View className="flex-1">
            <Select
              testID="invoices-tag-filter"
              placeholder={t("invoices.allTags")}
              value={tagId ?? "__all__"}
              options={[
                { value: "__all__", label: t("invoices.allTags") },
                ...(tags.data ?? []).map((tag) => ({
                  value: tag.id,
                  label: tag.name,
                })),
              ]}
              onChange={(value) => setTagId(value === "__all__" ? null : value)}
            />
          </View>
          <Button
            testID="invoices-export"
            label={t("invoices.export.trigger")}
            variant="secondary"
            size="sm"
            className="mb-4"
            onPress={() => exportSheet.current?.present()}
          />
          <Button
            testID="invoices-create"
            label="＋"
            size="sm"
            className="mb-4"
            onPress={() => router.push(`/projects/${id}/invoices/new`)}
          />
        </View>

        {meta && tab === "all" && !tagId ? (
          <>
            <ExpensePursesCard
              summary={buildPursesSummary(rows)}
              releasedCompany={
                meta.funds_released_company_total ??
                (meta.funds_released_total ?? 0) -
                  (meta.funds_released_personal_total ?? 0)
              }
              releasedPersonal={meta.funds_released_personal_total ?? 0}
              companyName={meta.company_name ?? null}
            />
            <BankReleaseCard
              metrics={computeBankReleaseMetrics(
                project.data?.budget == null
                  ? null
                  : Number(project.data.budget),
                meta.funds_released_total ?? 0,
              )}
              draws={buildDrawSeries(rows)}
            />
          </>
        ) : null}

        {invoices.isPending ? (
          <ActivityIndicator className="mt-8" />
        ) : invoices.isError ? (
          <ErrorState
            message={t("home.loadError")}
            retryLabel={t("common.retry")}
            onRetry={() => invoices.refetch()}
          />
        ) : rows.length === 0 ? (
          <EmptyState message={t("invoices.none")} />
        ) : tab === "all" ? (
          monthGroups.map((month) => (
            <View key={month.monthKey} className="mb-3">
              <Pressable
                testID={`invoices-month-${month.monthKey}`}
                onPress={() => toggleMonth(month.monthKey)}
                className="flex-row items-center justify-between border-b border-border py-2"
              >
                <Text className="text-base font-semibold capitalize text-primary">
                  {collapsed.has(month.monthKey) ? "▸ " : "▾ "}
                  {formatMonth(month.monthKey)}
                </Text>
                <Text className="text-sm font-medium text-primary">
                  {formatMoney(month.expenseSubtotal)}
                </Text>
              </Pressable>
              {collapsed.has(month.monthKey)
                ? null
                : month.categories.map((group) => (
                    <View key={group.type} className="mt-2">
                      <View className="mb-1 flex-row justify-between">
                        <Text className="text-xs uppercase text-muted-foreground">
                          {t(`invoices.types.${group.type}`)}
                        </Text>
                        <Text className="text-xs text-muted-foreground">
                          {formatMoney(group.subtotal)}
                        </Text>
                      </View>
                      {group.items.map((invoice) => (
                        <InvoiceRow
                          key={invoice.id}
                          invoice={invoice}
                          showType={false}
                          onPress={() => open(invoice.id)}
                        />
                      ))}
                    </View>
                  ))}
            </View>
          ))
        ) : tab === "labor" ? (
          workerGroups.map((group) => (
            <View key={group.workerId ?? "unassigned"} className="mb-3">
              <View className="mb-1 flex-row items-center justify-between border-b border-border py-2">
                <Text className="text-base font-semibold text-primary">
                  {group.displayName ?? t("invoices.unassignedWorker")}
                </Text>
                <Text className="text-sm text-muted-foreground">
                  {t("invoices.paidTotal", {
                    amount: formatMoney(
                      group.workerId
                        ? (paidByWorker.get(group.workerId) ?? group.totalPaid)
                        : group.totalPaid,
                    ),
                  })}
                </Text>
              </View>
              {group.invoices.map((invoice) => (
                <InvoiceRow
                  key={invoice.id}
                  invoice={invoice}
                  showType={false}
                  onPress={() => open(invoice.id)}
                />
              ))}
            </View>
          ))
        ) : (
          rows.map((invoice) => (
            <InvoiceRow
              key={invoice.id}
              invoice={invoice}
              showType={false}
              onPress={() => open(invoice.id)}
            />
          ))
        )}
      </ScrollView>

      <Sheet
        ref={exportSheet}
        title={t("invoices.export.title")}
        snapPoints={["70%"]}
      >
        <View className="p-4">
          <Select<InvoiceExportFormat>
            testID="export-format"
            label={t("invoices.export.format")}
            value={exportFormat}
            options={[
              { value: "xlsx", label: "Excel (.xlsx)" },
              { value: "pdf", label: "PDF" },
            ]}
            onChange={setExportFormat}
          />
          <Text className="mb-1 text-sm text-muted-foreground">
            {t("invoices.export.from")}
          </Text>
          <MonthPicker
            testID="export-from"
            value={exportFrom}
            onChange={setExportFrom}
          />
          <Text className="mb-1 text-sm text-muted-foreground">
            {t("invoices.export.to")}
          </Text>
          <MonthPicker
            testID="export-to"
            value={exportTo}
            onChange={setExportTo}
          />
          <Select<Tab>
            testID="export-type"
            label={t("invoices.form.type")}
            value={exportType}
            options={[
              { value: "all", label: t("invoices.all") },
              ...INVOICE_TYPES.map((value) => ({
                value,
                label: t(`invoices.types.${value}`),
              })),
            ]}
            onChange={setExportType}
          />
          <Button
            testID="export-run"
            label={t("invoices.export.run")}
            loading={exporting}
            onPress={() => void runExport()}
          />
        </View>
      </Sheet>
    </View>
  );
}
