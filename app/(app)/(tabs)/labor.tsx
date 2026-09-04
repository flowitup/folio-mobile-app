import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { useAuth } from "@/auth/auth-context";
import { ProjectTopBar } from "@/components/shell/project-top-bar";
import { Segmented } from "@/components/ui/chip";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Icon } from "@/components/ui/icon";
import { MonthPicker } from "@/components/ui/month-picker";
import { EmptyState } from "@/components/ui/primitives";
import { ScreenTitle } from "@/components/ui/typography";
import {
  useInvoices,
  useLaborPaymentsSummary,
} from "@/features/invoices/invoices-api";
import { AttendanceCalendar } from "@/features/labor/attendance-calendar";
import {
  exportLabor,
  fetchConflicts,
  useActivities,
  useBulkLog,
  useCreateWorker,
  useDayDescriptions,
  useDeleteAttendance,
  useDeleteWorker,
  useLaborEntries,
  useLaborSummary,
  useUpdateAttendance,
  useUpdateWorker,
  useWorkers,
} from "@/features/labor/labor-api";
import {
  LaborDayCard,
  LaborKpis,
  PaymentsPanel,
  WorkersPanel,
  dayCardTitle,
} from "@/features/labor/labor-panels";
import type { PaymentRow } from "@/features/labor/labor-panels";
import {
  EditEntrySheet,
  LogDaySheet,
  RateChangesSheet,
  WorkerFormSheet,
} from "@/features/labor/labor-sheets";
import type { SheetHandle } from "@/features/labor/labor-sheets";
import {
  DayDetailsSheet,
  LaborExportSheet,
  PaymentSheet,
  WorkerActionsSheet,
} from "@/features/labor/labor-tab-sheets";
import type {
  BulkLogEntry,
  ConflictGroup,
  LaborEntry,
  Worker,
} from "@/features/labor/labor-types";
import { projectCan, useProject } from "@/features/projects/projects-api";
import { useSelectedProject } from "@/features/projects/selected-project";
import { useTags } from "@/features/projects/tags-api";
import { currentMonth, formatMonth, toIsoDate } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";
import { ApiError } from "@/lib/query/api-error";
import { useRefetchOnFocus } from "@/lib/query/use-refetch-on-focus";
import { useTokens, workerColor } from "@/theme/tokens";

type Segment = "calendar" | "workers" | "payments";
const SEGMENTS: Segment[] = ["calendar", "workers", "payments"];

function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  return {
    from: `${month}-01`,
    to: `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`,
  };
}

/** Nhân công: month stepper, segmented Chấm công / Nhân công / Thanh toán, calendar + day card, worker and payment cards. */
export default function LaborTab() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const tokens = useTokens();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ segment?: string }>();
  const { projectId, project: selected } = useSelectedProject();
  const id = projectId;
  const [segment, setSegment] = useState<Segment>("calendar");
  const [month, setMonth] = useState(currentMonth());
  const range = useMemo(() => monthRange(month), [month]);
  const today = useMemo(() => toIsoDate(new Date()), []);
  const [selectedDay, setSelectedDay] = useState<string>(today);

  // "Trả ›" on the overview lands on the payments segment.
  useEffect(() => {
    if (params.segment && (SEGMENTS as string[]).includes(params.segment))
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSegment(params.segment as Segment);
  }, [params.segment]);

  const project = useProject(id);
  const workers = useWorkers(id);
  const tags = useTags(id);
  const entries = useLaborEntries(id, range.from, range.to);
  const activities = useActivities(id);
  const dayDescriptions = useDayDescriptions(id);
  const summary = useLaborSummary(id, range.from, range.to);
  const laborPayments = useLaborPaymentsSummary(id);
  const laborInvoices = useInvoices(id, { type: "labor" });
  useRefetchOnFocus(entries.refetch);
  useRefetchOnFocus(summary.refetch);

  const createWorker = useCreateWorker(id);
  const updateWorker = useUpdateWorker(id);
  const deleteWorker = useDeleteWorker(id);
  const bulkLog = useBulkLog(id);
  const updateEntry = useUpdateAttendance(id);
  const deleteEntry = useDeleteAttendance(id);

  const [editingWorker, setEditingWorker] = useState<Worker | undefined>(
    undefined,
  );
  const [actionWorker, setActionWorker] = useState<Worker | null>(null);
  const [rateWorker, setRateWorker] = useState<Worker | null>(null);
  const [deletingWorker, setDeletingWorker] = useState<Worker | null>(null);
  const [editingEntry, setEditingEntry] = useState<LaborEntry | null>(null);
  const [conflicts, setConflicts] = useState<ConflictGroup[] | null>(null);
  const [pendingBulk, setPendingBulk] = useState<BulkLogEntry[] | null>(null);
  const [paymentRow, setPaymentRow] = useState<PaymentRow | null>(null);

  const workerForm = useRef<SheetHandle>(null);
  const rateSheet = useRef<SheetHandle>(null);
  const logDaySheet = useRef<SheetHandle>(null);
  const entrySheet = useRef<SheetHandle>(null);
  const actionsSheet = useRef<BottomSheetModal>(null);
  const detailsSheet = useRef<BottomSheetModal>(null);
  const paymentSheet = useRef<BottomSheetModal>(null);
  const exportSheet = useRef<BottomSheetModal>(null);

  const coloredWorkers = useMemo(
    () =>
      (workers.data ?? []).map((worker, index) => ({
        worker,
        color: workerColor(tokens, worker.role_color, index),
      })),
    [workers.data, tokens],
  );
  const colorById = useMemo(
    () =>
      new Map(coloredWorkers.map(({ worker, color }) => [worker.id, color])),
    [coloredWorkers],
  );
  const colorOf = (workerId: string) =>
    colorById.get(workerId) ?? tokens.muted2;
  const roleOf = (workerId: string) =>
    workers.data?.find((w) => w.id === workerId)?.role_name ?? null;

  const dayEntries = useMemo(
    () => (entries.data ?? []).filter((e) => e.date === selectedDay),
    [entries.data, selectedDay],
  );
  const lastDayEntries = useMemo(() => {
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
  const daysByWorker = useMemo(
    () =>
      new Map(
        (summary.data?.rows ?? []).map((row) => [
          row.worker_id,
          row.days_worked,
        ]),
      ),
    [summary.data],
  );
  const paymentRows = useMemo<PaymentRow[]>(
    () =>
      (summary.data?.rows ?? []).flatMap((row) => {
        const entry = coloredWorkers.find((w) => w.worker.id === row.worker_id);
        return entry
          ? [
              {
                worker: entry.worker,
                color: entry.color,
                owed: row.total_cost,
                paid: paidByWorker.get(row.worker_id) ?? 0,
              },
            ]
          : [];
      }),
    [summary.data, coloredWorkers, paidByWorker],
  );
  const unpaid = paymentRows.reduce(
    (sum, row) => sum + Math.max(0, row.owed - row.paid),
    0,
  );
  const unassignedLabor = useMemo(
    () => (laborInvoices.data?.invoices ?? []).filter((inv) => !inv.worker_id),
    [laborInvoices.data],
  );
  const activeCount = (workers.data ?? []).filter((w) => w.is_active).length;
  const canManageInvoices = projectCan(
    project.data,
    "project:manage_invoices",
    user?.permissions,
  );

  async function submitBulk(bulkEntries: BulkLogEntry[], acknowledge = false) {
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

  if (!selected)
    return (
      <View className="flex-1 bg-paper">
        <ProjectTopBar />
        <EmptyState message={t("dashboard.noProjects")} />
      </View>
    );

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
            <ScreenTitle testID="labor-title">{t("tabs.labor")}</ScreenTitle>
            <Text className="mt-1 font-sans text-[12.5px] text-muted">
              {t("labor.headerSub", {
                count: activeCount,
                month: formatMonth(month),
              })}
            </Text>
          </View>
          <MonthPicker
            testID="labor-month"
            value={month}
            onChange={setMonth}
            compact
          />
        </View>
        <Segmented<Segment>
          testID="labor-tab"
          value={segment}
          onChange={setSegment}
          options={SEGMENTS.map((value) => ({
            value,
            label: t(`labor.segments.${value}`),
          }))}
        />

        {segment === "calendar" ? (
          <>
            <LaborKpis
              days={summary.data?.total_days ?? 0}
              cost={summary.data?.total_cost ?? 0}
              unpaid={unpaid}
            />
            {entries.isPending ? (
              <ActivityIndicator className="my-6" color={tokens.ink} />
            ) : (
              <AttendanceCalendar
                month={month}
                entries={entries.data ?? []}
                colorOf={colorOf}
                selected={selectedDay}
                onSelectDay={setSelectedDay}
              />
            )}
            <LaborDayCard
              title={dayCardTitle(
                selectedDay,
                i18n.language === "vi"
                  ? "vi-VN"
                  : i18n.language === "fr"
                    ? "fr-FR"
                    : "en-GB",
              )}
              entries={dayEntries}
              colorOf={colorOf}
              roleOf={roleOf}
              onEntry={(entry) => {
                setEditingEntry(entry);
                setTimeout(() => entrySheet.current?.open(), 0);
              }}
              onLog={() => logDaySheet.current?.open()}
              onDetails={() => detailsSheet.current?.present()}
            />
            <Pressable
              testID="labor-export"
              accessibilityRole="button"
              onPress={() => exportSheet.current?.present()}
              className="h-11 flex-row items-center justify-center gap-2 rounded-xl border border-line-2 active:opacity-70"
            >
              <Icon name="download" size={15} color={tokens.ink} />
              <Text className="font-sans-medium text-[13px] text-ink">
                {t("expenses.export")}
              </Text>
            </Pressable>
          </>
        ) : null}

        {segment === "workers" ? (
          <WorkersPanel
            workers={coloredWorkers}
            daysOf={(workerId) => daysByWorker.get(workerId) ?? 0}
            onWorker={(worker) => {
              setActionWorker(worker);
              actionsSheet.current?.present();
            }}
            onAdd={() => {
              setEditingWorker(undefined);
              workerForm.current?.open();
            }}
          />
        ) : null}

        {segment === "payments" ? (
          <>
            {summary.isPending ? (
              <ActivityIndicator className="my-6" color={tokens.ink} />
            ) : null}
            <PaymentsPanel
              rows={paymentRows}
              canRecord={canManageInvoices}
              onRow={(row) => {
                setPaymentRow(row);
                paymentSheet.current?.present();
              }}
              onRecord={() => {
                setPaymentRow(
                  paymentRows.find((row) => row.owed - row.paid > 0) ??
                    paymentRows[0] ??
                    null,
                );
                paymentSheet.current?.present();
              }}
            />
            {unassignedLabor.length > 0 ? (
              <View className="gap-2">
                <Text className="font-sans-medium text-[11px] uppercase tracking-[1.1px] text-muted">
                  {t("labor.payments.unassigned")}
                </Text>
                {unassignedLabor.map((invoice) => (
                  <Pressable
                    key={invoice.id}
                    testID={`unassigned-invoice-${invoice.id}`}
                    accessibilityRole="button"
                    onPress={() =>
                      router.push(`/projects/${id}/invoices/${invoice.id}`)
                    }
                    className="flex-row items-center justify-between rounded-[14px] border border-line bg-card px-3.5 py-3 active:opacity-70"
                  >
                    <View className="min-w-0 flex-1">
                      <Text
                        className="font-sans-medium text-[14px] text-ink"
                        numberOfLines={1}
                      >
                        {invoice.recipient_name}
                      </Text>
                      <Text className="font-sans text-[11.5px] text-muted">
                        {invoice.invoice_number}
                      </Text>
                    </View>
                    <Text className="font-mono text-[14px] text-ink">
                      {formatMoney(invoice.total_amount)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>

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
      <DayDetailsSheet
        ref={detailsSheet}
        projectId={id}
        date={selectedDay}
        entries={dayEntries}
        activities={(activities.data ?? []).filter(
          (a) => a.date === selectedDay,
        )}
        description={
          dayDescriptions.data?.find((d) => d.date === selectedDay)
            ?.description ?? ""
        }
        tags={tags.data ?? []}
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
                {
                  onSuccess: () => workerForm.current?.close(),
                },
              )
        }
      />
      <WorkerActionsSheet
        ref={actionsSheet}
        worker={actionWorker}
        onEdit={(worker) => {
          setEditingWorker(worker);
          setTimeout(() => workerForm.current?.open(), 0);
        }}
        onRates={(worker) => {
          setRateWorker(worker);
          setTimeout(() => rateSheet.current?.open(), 0);
        }}
        onDelete={(worker) => setDeletingWorker(worker)}
      />
      <RateChangesSheet ref={rateSheet} projectId={id} worker={rateWorker} />
      <PaymentSheet
        ref={paymentSheet}
        projectId={id}
        companyId={project.data?.company_id ?? null}
        month={month}
        rows={paymentRows}
        initial={paymentRow}
      />
      <LaborExportSheet
        ref={exportSheet}
        projectId={id}
        workers={workers.data ?? []}
        onExport={exportLabor}
      />

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
