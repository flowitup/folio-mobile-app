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
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { MonthPicker } from "@/components/ui/month-picker";
import { Badge, Card, EmptyState } from "@/components/ui/primitives";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import { showToast } from "@/components/ui/toast";
import type {
  Invoice,
  InvoiceExportFormat,
} from "@/features/invoices/invoice-types";
import {
  useCreateInvoice,
  useInvoices,
  useLaborPaymentsSummary,
  usePaymentMethods,
  useAssignInvoiceWorker,
} from "@/features/invoices/invoices-api";
import { CalendarMonthGrid } from "@/features/labor/calendar-month-grid";
import {
  exportLabor,
  fetchConflicts,
  useActivities,
  useBulkLog,
  useCreateActivity,
  useCreateWorker,
  useDayDescriptions,
  useDeleteActivity,
  useDeleteAttendance,
  useDeleteWorker,
  useLaborEntries,
  useLaborMonthlySummary,
  useLaborSummary,
  useSetDayDescription,
  useSetDayTag,
  useUpdateAttendance,
  useUpdateWorker,
  useWorkers,
} from "@/features/labor/labor-api";
import {
  EditEntrySheet,
  LogDaySheet,
  RateChangesSheet,
  WorkerFormSheet,
} from "@/features/labor/labor-sheets";
import type { SheetHandle } from "@/features/labor/labor-sheets";
import type {
  BulkLogEntry,
  ConflictGroup,
  LaborEntry,
  Worker,
} from "@/features/labor/labor-types";
import { useProject } from "@/features/projects/projects-api";
import { useTags } from "@/features/projects/tags-api";
import { currentMonth, formatDate, formatMonth } from "@/lib/format/date";
import { formatMoney, parseMoneyInput } from "@/lib/format/money";
import { ApiError } from "@/lib/query/api-error";
import { useRefetchOnFocus } from "@/lib/query/use-refetch-on-focus";

type Tab = "summary" | "attendance" | "workers" | "payments";
const TABS: Tab[] = ["summary", "attendance", "workers", "payments"];

function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  return {
    from: `${month}-01`,
    to: `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`,
  };
}

/** Labor section: summary · attendance calendar · workers · payments — same four tabs as the web page. */
export default function ProjectLaborSection() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>("summary");
  const [month, setMonth] = useState(currentMonth());
  const range = useMemo(() => monthRange(month), [month]);

  const project = useProject(id);
  const workers = useWorkers(id);
  const tags = useTags(id);
  const entries = useLaborEntries(id, range.from, range.to);
  const activities = useActivities(id);
  const dayDescriptions = useDayDescriptions(id);
  const summary = useLaborSummary(id, range.from, range.to);
  const allTimeSummary = useLaborSummary(id);
  const monthly = useLaborMonthlySummary(id);
  const laborPayments = useLaborPaymentsSummary(id);
  const laborInvoices = useInvoices(id, { type: "labor" });
  const paymentMethods = usePaymentMethods(project.data?.company_id);
  useRefetchOnFocus(entries.refetch);

  const createWorker = useCreateWorker(id);
  const updateWorker = useUpdateWorker(id);
  const deleteWorker = useDeleteWorker(id);
  const bulkLog = useBulkLog(id);
  const updateEntry = useUpdateAttendance(id);
  const deleteEntry = useDeleteAttendance(id);
  const createActivity = useCreateActivity(id);
  const deleteActivity = useDeleteActivity(id);
  const setDayDescription = useSetDayDescription(id);
  const setDayTag = useSetDayTag(id);
  const createInvoice = useCreateInvoice(id);
  const assignWorker = useAssignInvoiceWorker(id);

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [editingWorker, setEditingWorker] = useState<Worker | undefined>(
    undefined,
  );
  const [rateWorker, setRateWorker] = useState<Worker | null>(null);
  const [deletingWorker, setDeletingWorker] = useState<Worker | null>(null);
  const [editingEntry, setEditingEntry] = useState<LaborEntry | null>(null);
  const [activityTitle, setActivityTitle] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [conflicts, setConflicts] = useState<ConflictGroup[] | null>(null);
  const [pendingBulk, setPendingBulk] = useState<BulkLogEntry[] | null>(null);
  const [paymentWorker, setPaymentWorker] = useState<Worker | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<InvoiceExportFormat>("xlsx");
  const [exportFrom, setExportFrom] = useState(currentMonth());
  const [exportTo, setExportTo] = useState(currentMonth());
  const [exportWorker, setExportWorker] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const workerForm = useRef<SheetHandle>(null);
  const rateSheet = useRef<SheetHandle>(null);
  const logDaySheet = useRef<SheetHandle>(null);
  const entrySheet = useRef<SheetHandle>(null);
  const daySheet = useRef<BottomSheetModal>(null);
  const paymentSheet = useRef<BottomSheetModal>(null);
  const exportSheet = useRef<BottomSheetModal>(null);

  const dayEntries = useMemo(
    () => (entries.data ?? []).filter((e) => e.date === selectedDay),
    [entries.data, selectedDay],
  );
  const dayActivities = useMemo(
    () => (activities.data ?? []).filter((a) => a.date === selectedDay),
    [activities.data, selectedDay],
  );
  const dayDescription = useMemo(
    () => dayDescriptions.data?.find((d) => d.date === selectedDay) ?? null,
    [dayDescriptions.data, selectedDay],
  );
  const lastDayEntries = useMemo(() => {
    if (!selectedDay) return [];
    const previous = (entries.data ?? [])
      .filter((e) => e.date < selectedDay)
      .map((e) => e.date)
      .sort()
      .pop();
    return previous
      ? (entries.data ?? []).filter((e) => e.date === previous)
      : [];
  }, [entries.data, selectedDay]);

  const paidByWorker = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const bucket = laborPayments.data?.months.find(
      (b) => b.year === y && b.month === m,
    );
    return new Map((bucket?.workers ?? []).map((w) => [w.worker_id, w.paid]));
  }, [laborPayments.data, month]);
  const unassignedLabor = useMemo(
    () => (laborInvoices.data?.invoices ?? []).filter((inv) => !inv.worker_id),
    [laborInvoices.data],
  );

  function openDay(iso: string) {
    setSelectedDay(iso);
    setDescriptionDraft(
      dayDescriptions.data?.find((d) => d.date === iso)?.description ?? "",
    );
    setActivityTitle("");
    daySheet.current?.present();
  }

  async function submitBulk(bulkEntries: BulkLogEntry[], acknowledge = false) {
    if (!selectedDay) return;
    if (!acknowledge) {
      const personIds = bulkEntries
        .map((e) => workers.data?.find((w) => w.id === e.worker_id)?.person_id)
        .filter((p): p is string => Boolean(p));
      if (personIds.length > 0) {
        const found = await fetchConflicts(id, selectedDay, personIds).catch(
          () => ({ conflicts: [] }),
        );
        if (found.conflicts.length > 0) {
          setConflicts(found.conflicts);
          setPendingBulk(bulkEntries);
          return;
        }
      }
    }
    bulkLog.mutate(
      {
        date: selectedDay,
        entries: bulkEntries,
        acknowledge_conflicts: acknowledge,
      },
      {
        onSuccess: () => {
          logDaySheet.current?.close();
          setConflicts(null);
          setPendingBulk(null);
        },
        onError: (error) => {
          if (error instanceof ApiError && error.status === 409) {
            setConflicts([]);
            setPendingBulk(bulkEntries);
            return true;
          }
        },
      },
    );
  }

  async function runExport() {
    setExporting(true);
    try {
      await exportLabor(id, exportFormat, exportFrom, exportTo, exportWorker);
      exportSheet.current?.dismiss();
    } catch (caught) {
      showToast((caught as Error).message, "error");
    } finally {
      setExporting(false);
    }
  }

  function recordPayment() {
    const amount = parseMoneyInput(paymentAmount);
    if (!paymentWorker || !amount || amount <= 0)
      return showToast(t("labor.payments.amountRequired"), "error");
    createInvoice.mutate(
      {
        type: "labor",
        issue_date: new Date().toISOString().slice(0, 10),
        recipient_name: paymentWorker.name,
        items: [
          {
            description: t("labor.payments.itemDescription", {
              month: formatMonth(month),
            }),
            quantity: 1,
            unit_price: amount,
            vat_rate: 0,
          },
        ],
        payment_method_id: paymentMethodId,
        service_month: `${month}-01`,
        worker_id: paymentWorker.id,
      },
      {
        onSuccess: () => {
          paymentSheet.current?.dismiss();
          setPaymentAmount("");
        },
      },
    );
  }

  const workerOptions = (workers.data ?? []).map((w) => ({
    value: w.id,
    label: w.name,
  }));

  return (
    <View className="flex-1 bg-white">
      <View className="flex-row border-b border-border">
        {TABS.map((value) => (
          <Pressable
            key={value}
            testID={`labor-tab-${value}`}
            onPress={() => setTab(value)}
            className={`flex-1 items-center border-b-2 py-2 ${tab === value ? "border-primary" : "border-transparent"}`}
          >
            <Text
              className={
                tab === value
                  ? "text-sm font-semibold text-primary"
                  : "text-sm text-muted-foreground"
              }
            >
              {t(`labor.tabs.${value}`)}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView className="flex-1" contentContainerClassName="p-4 pb-12">
        {tab !== "workers" ? (
          <MonthPicker testID="labor-month" value={month} onChange={setMonth} />
        ) : null}

        {tab === "summary" ? (
          summary.isPending ? (
            <ActivityIndicator className="mt-8" />
          ) : (
            <>
              <Card className="mb-3">
                <View className="flex-row justify-between py-1">
                  <Text className="text-sm text-muted-foreground">
                    {t("labor.summary.days")}
                  </Text>
                  <Text className="text-sm text-primary">
                    {summary.data?.total_days ?? 0}
                  </Text>
                </View>
                <View className="flex-row justify-between py-1">
                  <Text className="text-sm text-muted-foreground">
                    {t("labor.summary.cost")}
                  </Text>
                  <Text className="text-sm font-semibold text-primary">
                    {formatMoney(summary.data?.total_cost ?? 0)}
                  </Text>
                </View>
                <View className="flex-row justify-between py-1">
                  <Text className="text-sm text-muted-foreground">
                    {t("labor.summary.bankedHours")}
                  </Text>
                  <Text className="text-sm text-primary">
                    {summary.data?.total_banked_hours ?? 0} h
                  </Text>
                </View>
                <View className="flex-row justify-between py-1">
                  <Text className="text-sm text-muted-foreground">
                    {t("labor.summary.bonus")}
                  </Text>
                  <Text className="text-sm text-primary">
                    {summary.data?.total_bonus_days ?? 0} ·{" "}
                    {formatMoney(summary.data?.total_bonus_cost ?? 0)}
                  </Text>
                </View>
                <View className="flex-row justify-between py-1">
                  <Text className="text-sm text-muted-foreground">
                    {t("labor.summary.allTime")}
                  </Text>
                  <Text className="text-sm text-primary">
                    {formatMoney(allTimeSummary.data?.total_cost ?? 0)}
                  </Text>
                </View>
              </Card>
              {(summary.data?.rows ?? []).length === 0 ? (
                <EmptyState message={t("labor.summary.none")} />
              ) : null}
              {(summary.data?.rows ?? []).map((row) => (
                <Card key={row.worker_id} className="mb-2">
                  <View className="flex-row justify-between">
                    <Text className="text-base font-medium text-primary">
                      {row.worker_name}
                    </Text>
                    <Text className="text-base font-semibold text-primary">
                      {formatMoney(row.total_cost)}
                    </Text>
                  </View>
                  <Text className="text-xs text-muted-foreground">
                    {t("labor.summary.rowLine", {
                      days: row.days_worked,
                      banked: row.banked_hours,
                      bonus: row.bonus_full_days + row.bonus_half_days / 2,
                      paid: formatMoney(paidByWorker.get(row.worker_id) ?? 0),
                    })}
                  </Text>
                </Card>
              ))}
              <Text className="mb-2 mt-4 text-sm font-medium text-muted-foreground">
                {t("labor.summary.monthly")}
              </Text>
              {(monthly.data?.rows ?? []).map((row) => (
                <Pressable
                  key={`${row.year}-${row.month}`}
                  testID={`labor-monthly-${row.year}-${row.month}`}
                  onPress={() =>
                    setMonth(
                      `${row.year}-${String(row.month).padStart(2, "0")}`,
                    )
                  }
                >
                  <Card className="mb-2 flex-row justify-between">
                    <Text className="capitalize text-primary">
                      {formatMonth(
                        `${row.year}-${String(row.month).padStart(2, "0")}`,
                      )}
                    </Text>
                    <Text className="text-primary">
                      {row.total_days} j · {formatMoney(row.total_cost)}
                    </Text>
                  </Card>
                </Pressable>
              ))}
              <Button
                testID="labor-export"
                label={t("invoices.export.trigger")}
                variant="secondary"
                className="mt-3"
                onPress={() => exportSheet.current?.present()}
              />
            </>
          )
        ) : null}

        {tab === "attendance" ? (
          entries.isPending ? (
            <ActivityIndicator className="mt-8" />
          ) : (
            <CalendarMonthGrid
              month={month}
              entries={entries.data ?? []}
              activities={activities.data ?? []}
              dayDescriptions={dayDescriptions.data ?? []}
              tags={tags.data ?? []}
              selected={selectedDay}
              onSelectDay={openDay}
            />
          )
        ) : null}

        {tab === "workers" ? (
          <>
            <Button
              testID="worker-add"
              label={t("labor.workers.add")}
              className="mb-3"
              onPress={() => {
                setEditingWorker(undefined);
                workerForm.current?.open();
              }}
            />
            {(workers.data ?? []).length === 0 ? (
              <EmptyState message={t("labor.workers.none")} />
            ) : null}
            {(workers.data ?? []).map((worker) => (
              <Card key={worker.id} className="mb-2">
                <View className="flex-row items-center">
                  <View
                    className="mr-2 h-3 w-3 rounded-full"
                    style={{ backgroundColor: worker.role_color ?? "#a3a3a3" }}
                  />
                  <Text className="flex-1 text-base font-medium text-primary">
                    {worker.name}
                  </Text>
                  {!worker.is_active ? (
                    <Badge label={t("labor.workers.inactive")} tone="warning" />
                  ) : null}
                </View>
                <Text className="text-xs text-muted-foreground">
                  {worker.role_name ?? "—"} ·{" "}
                  {formatMoney(worker.current_daily_rate ?? worker.daily_rate)}/
                  {t("labor.workers.day")}
                  {worker.phone ? ` · ${worker.phone}` : ""}
                </Text>
                <View className="mt-2 flex-row gap-4">
                  <Pressable
                    testID={`worker-edit-${worker.id}`}
                    onPress={() => {
                      setEditingWorker(worker);
                      setTimeout(() => workerForm.current?.open(), 0);
                    }}
                  >
                    <Text className="text-sm text-primary">
                      {t("common.edit")}
                    </Text>
                  </Pressable>
                  <Pressable
                    testID={`worker-rates-${worker.id}`}
                    onPress={() => {
                      setRateWorker(worker);
                      setTimeout(() => rateSheet.current?.open(), 0);
                    }}
                  >
                    <Text className="text-sm text-primary">
                      {t("labor.rates.link")}
                    </Text>
                  </Pressable>
                  <Pressable
                    testID={`worker-delete-${worker.id}`}
                    onPress={() => setDeletingWorker(worker)}
                  >
                    <Text className="text-sm text-danger">
                      {t("common.delete")}
                    </Text>
                  </Pressable>
                </View>
              </Card>
            ))}
          </>
        ) : null}

        {tab === "payments" ? (
          <>
            {(summary.data?.rows ?? []).map((row) => {
              const paid = paidByWorker.get(row.worker_id) ?? 0;
              const worker = workers.data?.find((w) => w.id === row.worker_id);
              return (
                <Card key={row.worker_id} className="mb-2">
                  <View className="flex-row justify-between">
                    <Text className="text-base font-medium text-primary">
                      {row.worker_name}
                    </Text>
                    <Badge
                      label={
                        paid >= row.total_cost
                          ? t("labor.payments.settled")
                          : t("labor.payments.due")
                      }
                      tone={paid >= row.total_cost ? "success" : "warning"}
                    />
                  </View>
                  <Text className="text-xs text-muted-foreground">
                    {t("labor.payments.line", {
                      owed: formatMoney(row.total_cost),
                      paid: formatMoney(paid),
                      balance: formatMoney(row.total_cost - paid),
                    })}
                  </Text>
                  {worker ? (
                    <Button
                      testID={`payment-record-${row.worker_id}`}
                      label={t("labor.payments.record")}
                      variant="secondary"
                      size="sm"
                      className="mt-2"
                      onPress={() => {
                        setPaymentWorker(worker);
                        setPaymentAmount(
                          String(Math.max(0, row.total_cost - paid)),
                        );
                        paymentSheet.current?.present();
                      }}
                    />
                  ) : null}
                </Card>
              );
            })}
            {(summary.data?.rows ?? []).length === 0 ? (
              <EmptyState message={t("labor.payments.none")} />
            ) : null}
            {unassignedLabor.length > 0 ? (
              <>
                <Text className="mb-2 mt-4 text-sm font-medium text-muted-foreground">
                  {t("labor.payments.unassigned")}
                </Text>
                {unassignedLabor.map((invoice: Invoice) => (
                  <Card key={invoice.id} className="mb-2">
                    <View className="flex-row justify-between">
                      <Text className="text-base text-primary">
                        {invoice.recipient_name}
                      </Text>
                      <Text className="text-base font-medium text-primary">
                        {formatMoney(invoice.total_amount)}
                      </Text>
                    </View>
                    <Text className="text-xs text-muted-foreground">
                      {invoice.invoice_number} ·{" "}
                      {formatDate(invoice.issue_date)}
                    </Text>
                    <Select
                      testID={`assign-worker-${invoice.id}`}
                      placeholder={t("labor.payments.assignWorker")}
                      value={null}
                      options={workerOptions}
                      onChange={(workerId) =>
                        assignWorker.mutate({ invoiceId: invoice.id, workerId })
                      }
                    />
                    <Pressable
                      onPress={() =>
                        router.push(`/projects/${id}/invoices/${invoice.id}`)
                      }
                    >
                      <Text className="text-sm text-primary">
                        {t("labor.payments.openInvoice")}
                      </Text>
                    </Pressable>
                  </Card>
                ))}
              </>
            ) : null}
          </>
        ) : null}
      </ScrollView>

      {/* Day detail: entries of the day, activities, description, day tag, log more */}
      <Sheet
        ref={daySheet}
        title={selectedDay ? formatDate(selectedDay) : ""}
        snapPoints={["80%"]}
      >
        <View className="p-4">
          <Button
            testID="day-log"
            label={t("labor.log.open")}
            className="mb-3"
            onPress={() => logDaySheet.current?.open()}
          />
          {dayEntries.map((entry) => (
            <Pressable
              key={entry.id}
              testID={`day-entry-${entry.id}`}
              onPress={() => {
                setEditingEntry(entry);
                setTimeout(() => entrySheet.current?.open(), 0);
              }}
            >
              <Card className="mb-2 flex-row items-center">
                <View
                  className="mr-2 h-3 w-3 rounded-full"
                  style={{ backgroundColor: entry.role_color ?? "#a3a3a3" }}
                />
                <View className="flex-1">
                  <Text className="text-base text-primary">
                    {entry.worker_name}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    {entry.shift_type
                      ? t(`labor.shift.${entry.shift_type}`)
                      : t("labor.shift.none")}
                    {entry.supplement_hours
                      ? ` +${entry.supplement_hours} h`
                      : ""}
                    {entry.note ? ` · ${entry.note}` : ""}
                  </Text>
                </View>
                <Text className="text-sm font-medium text-primary">
                  {formatMoney(entry.effective_cost)}
                </Text>
              </Card>
            </Pressable>
          ))}
          {dayEntries.length > 0 && (tags.data ?? []).length > 0 ? (
            <Select
              testID="day-tag"
              label={t("labor.log.dayTag")}
              placeholder={t("invoices.form.tagNone")}
              value={dayEntries[0]?.tag_id ?? null}
              options={(tags.data ?? []).map((tag) => ({
                value: tag.id,
                label: tag.name,
              }))}
              onChange={(tagId) =>
                selectedDay && setDayTag.mutate({ date: selectedDay, tagId })
              }
            />
          ) : null}
          <Text className="mb-1 mt-2 text-sm font-medium text-muted-foreground">
            {t("labor.activities.title")}
          </Text>
          {dayActivities.map((activity) => (
            <Card
              key={activity.id}
              className="mb-2 flex-row items-center justify-between"
            >
              <Text className="flex-1 text-sm text-primary">
                {activity.title}
              </Text>
              <Pressable
                testID={`activity-delete-${activity.id}`}
                onPress={() =>
                  deleteActivity.mutate({ activityId: activity.id })
                }
              >
                <Text className="text-sm text-danger">
                  {t("common.delete")}
                </Text>
              </Pressable>
            </Card>
          ))}
          <Input
            testID="activity-title"
            placeholder={t("labor.activities.placeholder")}
            value={activityTitle}
            onChangeText={setActivityTitle}
            onSubmitEditing={() =>
              selectedDay &&
              activityTitle.trim() &&
              createActivity.mutate(
                { date: selectedDay, title: activityTitle.trim() },
                { onSuccess: () => setActivityTitle("") },
              )
            }
          />
          <Button
            testID="activity-add"
            label={t("labor.activities.add")}
            variant="secondary"
            size="sm"
            className="mb-3"
            disabled={!activityTitle.trim()}
            onPress={() =>
              selectedDay &&
              createActivity.mutate(
                { date: selectedDay, title: activityTitle.trim() },
                { onSuccess: () => setActivityTitle("") },
              )
            }
          />
          <Input
            testID="day-description"
            label={t("labor.description.title")}
            value={descriptionDraft}
            onChangeText={setDescriptionDraft}
            multiline
          />
          <Button
            testID="day-description-save"
            label={t("common.save")}
            variant="secondary"
            size="sm"
            loading={setDayDescription.isPending}
            disabled={descriptionDraft === (dayDescription?.description ?? "")}
            onPress={() =>
              selectedDay &&
              setDayDescription.mutate({
                date: selectedDay,
                description: descriptionDraft.trim(),
              })
            }
          />
        </View>
      </Sheet>

      <LogDaySheet
        ref={logDaySheet}
        date={selectedDay}
        workers={workers.data ?? []}
        loggedWorkerIds={new Set(dayEntries.map((e) => e.worker_id))}
        lastDayEntries={lastDayEntries}
        tags={tags.data ?? []}
        submitting={bulkLog.isPending}
        onSubmit={(bulkEntries) => void submitBulk(bulkEntries)}
      />
      <EditEntrySheet
        ref={entrySheet}
        entry={editingEntry}
        tags={tags.data ?? []}
        submitting={updateEntry.isPending}
        onSubmit={(values) =>
          editingEntry &&
          updateEntry.mutate(
            { entryId: editingEntry.id, ...values },
            { onSuccess: () => entrySheet.current?.close() },
          )
        }
        onDelete={() =>
          editingEntry &&
          deleteEntry.mutate(
            { entryId: editingEntry.id },
            { onSuccess: () => entrySheet.current?.close() },
          )
        }
      />
      <WorkerFormSheet
        ref={workerForm}
        worker={editingWorker}
        submitting={createWorker.isPending || updateWorker.isPending}
        onSubmit={(values) =>
          editingWorker
            ? updateWorker.mutate(
                { workerId: editingWorker.id, ...values },
                { onSuccess: () => workerForm.current?.close() },
              )
            : createWorker.mutate(
                values as Parameters<typeof createWorker.mutate>[0],
                { onSuccess: () => workerForm.current?.close() },
              )
        }
      />
      <RateChangesSheet ref={rateSheet} projectId={id} worker={rateWorker} />

      <Sheet
        ref={paymentSheet}
        title={t("labor.payments.recordTitle", {
          name: paymentWorker?.name ?? "",
        })}
        snapPoints={["55%"]}
      >
        <View className="p-4">
          <Input
            testID="payment-amount"
            label={t("labor.payments.amount")}
            value={paymentAmount}
            onChangeText={setPaymentAmount}
            keyboardType="decimal-pad"
          />
          {project.data?.company_id ? (
            <Select
              testID="payment-method"
              label={t("invoices.form.paymentMethod")}
              placeholder={t("invoices.form.paymentMethodNone")}
              value={paymentMethodId}
              options={(paymentMethods.data ?? [])
                .filter((m) => m.is_active)
                .map((m) => ({ value: m.id, label: m.label }))}
              onChange={setPaymentMethodId}
            />
          ) : null}
          <Button
            testID="payment-submit"
            label={t("labor.payments.record")}
            loading={createInvoice.isPending}
            onPress={recordPayment}
          />
        </View>
      </Sheet>

      <Sheet
        ref={exportSheet}
        title={t("labor.export.title")}
        snapPoints={["75%"]}
      >
        <View className="p-4">
          <Select<InvoiceExportFormat>
            testID="labor-export-format"
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
            testID="labor-export-from"
            value={exportFrom}
            onChange={setExportFrom}
          />
          <Text className="mb-1 text-sm text-muted-foreground">
            {t("invoices.export.to")}
          </Text>
          <MonthPicker
            testID="labor-export-to"
            value={exportTo}
            onChange={setExportTo}
          />
          <Select
            testID="labor-export-worker"
            label={t("labor.export.worker")}
            placeholder={t("labor.export.allWorkers")}
            value={exportWorker ?? "__all__"}
            options={[
              { value: "__all__", label: t("labor.export.allWorkers") },
              ...workerOptions,
            ]}
            onChange={(value) =>
              setExportWorker(value === "__all__" ? null : value)
            }
          />
          <Button
            testID="labor-export-run"
            label={t("invoices.export.run")}
            loading={exporting}
            onPress={() => void runExport()}
          />
        </View>
      </Sheet>

      <ConfirmDialog
        visible={deletingWorker !== null}
        title={t("labor.workers.deleteConfirm", {
          name: deletingWorker?.name ?? "",
        })}
        message={t("labor.workers.deleteHint")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        destructive
        loading={deleteWorker.isPending}
        onCancel={() => setDeletingWorker(null)}
        onConfirm={() =>
          deletingWorker &&
          deleteWorker.mutate(
            { workerId: deletingWorker.id },
            { onSettled: () => setDeletingWorker(null) },
          )
        }
      />
      <ConfirmDialog
        visible={conflicts !== null}
        title={t("labor.log.conflictTitle")}
        message={
          (conflicts ?? [])
            .map(
              (group) =>
                `${group.person_name}: ${group.entries.map((e) => `${e.project_name} (${e.shift_type ? t(`labor.shift.${e.shift_type}`) : `+${e.supplement_hours} h`})`).join(", ")}`,
            )
            .join("\n") || t("labor.log.conflictGeneric")
        }
        confirmLabel={t("labor.log.conflictConfirm")}
        cancelLabel={t("common.cancel")}
        loading={bulkLog.isPending}
        onCancel={() => {
          setConflicts(null);
          setPendingBulk(null);
        }}
        onConfirm={() => pendingBulk && void submitBulk(pendingBulk, true)}
      />
    </View>
  );
}
