import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";

import { useAuth } from "@/auth/auth-context";
import { ProjectTopBar } from "@/components/shell/project-top-bar";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { MonthPicker } from "@/components/ui/month-picker";
import { Badge, Card, EmptyState } from "@/components/ui/primitives";
import { ScreenTitle } from "@/components/ui/typography";
import { AttendanceCalendar } from "@/features/labor/attendance-calendar";
import {
  useEditOwnAttendance,
  useLaborEntries,
  useLaborSummary,
  useSelfLogAttendance,
  useWorkers,
} from "@/features/labor/labor-api";
import type { LaborEntry, ShiftType } from "@/features/labor/labor-types";
import { useSelectedProject } from "@/features/projects/selected-project";
import {
  currentMonth,
  formatDate,
  formatMonth,
  toIsoDate,
} from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";
import { monthRange } from "@/lib/labor/month-range";
import { useRefetchOnFocus } from "@/lib/query/use-refetch-on-focus";
import { useTokens } from "@/theme/tokens";

const SHIFTS: ShiftType[] = ["full", "half", "overtime"];

/**
 * Worker mode · Chấm công: the signed-in worker's own attendance on the selected project.
 * The backend already narrows every list to the worker linked to this account; this screen
 * adds a one-tap "log this day" card (pending until a manager validates), the month calendar,
 * the day list with pending / validated badges and three KPIs (days, earned, pending).
 */
export function WorkerAttendanceTab() {
  const { t } = useTranslation();
  const tokens = useTokens();
  const { user } = useAuth();
  const {
    projectId,
    project,
    isPending: projectPending,
  } = useSelectedProject();
  const [month, setMonth] = useState(currentMonth());
  const range = useMemo(() => monthRange(month), [month]);
  const today = useMemo(() => toIsoDate(new Date()), []);
  const [selectedDay, setSelectedDay] = useState(today);
  const [shift, setShift] = useState<ShiftType>("full");

  const workers = useWorkers(projectId);
  const entries = useLaborEntries(projectId, range.from, range.to);
  const summary = useLaborSummary(projectId, range.from, range.to);
  const selfLog = useSelfLogAttendance(projectId);
  const editOwn = useEditOwnAttendance(projectId);
  // Inline "edit this day" form for the selected, already-logged day.
  const [editing, setEditing] = useState(false);
  const [editShift, setEditShift] = useState<ShiftType>("full");
  const [editHours, setEditHours] = useState("0");
  const [editNote, setEditNote] = useState("");
  useRefetchOnFocus(entries.refetch);
  useRefetchOnFocus(summary.refetch);

  const myWorker =
    (workers.data ?? []).find((w) => w.user_id === user?.id) ??
    workers.data?.[0];
  const monthEntries = useMemo(
    () => [...(entries.data ?? [])].sort((a, b) => (a.date < b.date ? 1 : -1)),
    [entries.data],
  );
  const pendingCount = monthEntries.filter(
    (e) => e.status === "pending",
  ).length;
  const selectedEntry = monthEntries.find((e) => e.date === selectedDay);
  const canLogSelected = selectedDay <= today && !selectedEntry;
  const colorOf = () => tokens.positive;

  function selectDay(iso: string) {
    setSelectedDay(iso);
    setEditing(false);
  }

  function startEdit(entry: LaborEntry) {
    setEditShift(entry.proposed_shift_type ?? entry.shift_type ?? "full");
    setEditHours(
      String(entry.proposed_supplement_hours ?? entry.supplement_hours ?? 0),
    );
    setEditNote(entry.proposed_note ?? entry.note ?? "");
    setEditing(true);
  }

  function submitEdit(entry: LaborEntry) {
    const hours = Math.max(0, Math.min(12, Number(editHours) || 0));
    editOwn.mutate(
      {
        entryId: entry.id,
        shift_type: editShift,
        supplement_hours: hours,
        note: editNote.trim() || null,
      },
      { onSuccess: () => setEditing(false) },
    );
  }

  if (!projectPending && !project)
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
          <View className="min-w-0 flex-1">
            <ScreenTitle testID="worker-attendance-title">
              {t("worker.attendanceTitle")}
            </ScreenTitle>
            <Text
              className="mt-1 font-sans text-[12.5px] text-muted"
              numberOfLines={1}
            >
              {myWorker?.name ?? "…"} · {formatMonth(month)}
            </Text>
          </View>
          <MonthPicker
            testID="worker-month"
            value={month}
            onChange={setMonth}
            compact
          />
        </View>

        {workers.isFetched && !myWorker ? (
          <Card radius={14} testID="worker-not-linked">
            <Text className="font-sans text-[13px] text-muted">
              {t("worker.notLinked")}
            </Text>
          </Card>
        ) : null}

        {myWorker ? (
          <Card radius={14} elevated testID="worker-log-card">
            <Text className="font-sans-semibold text-[15px] text-ink">
              {selectedDay === today
                ? t("worker.logToday")
                : t("worker.logDay", { date: formatDate(selectedDay) })}
            </Text>
            {selectedEntry ? (
              <>
                <View className="mt-2 flex-row flex-wrap items-center gap-2">
                  <Badge
                    testID="worker-selected-status"
                    label={t(
                      `worker.status.${selectedEntry.status ?? "validated"}`,
                    )}
                    tone={
                      selectedEntry.status === "pending" ? "warning" : "success"
                    }
                  />
                  {selectedEntry.change_requested_at ? (
                    <Badge
                      testID="worker-selected-change"
                      label={t("worker.changeRequested")}
                      tone="warning"
                    />
                  ) : null}
                  <Text className="font-sans text-[12.5px] text-muted">
                    {shiftLabel(
                      t,
                      selectedEntry.shift_type,
                      selectedEntry.supplement_hours,
                    )}
                  </Text>
                </View>
                {selectedEntry.change_requested_at && !editing ? (
                  <Text className="mt-1 font-sans text-[12px] text-muted">
                    {t("worker.proposedLine", {
                      value: shiftLabel(
                        t,
                        selectedEntry.proposed_shift_type ?? null,
                        selectedEntry.proposed_supplement_hours ?? 0,
                      ),
                    })}
                  </Text>
                ) : null}
                {editing ? (
                  <View className="mt-3 gap-3">
                    <Segmented<ShiftType>
                      testID="worker-edit-shift"
                      value={editShift}
                      onChange={setEditShift}
                      options={SHIFTS.map((value) => ({
                        value,
                        label: t(`labor.shift.${value}`),
                      }))}
                    />
                    <Input
                      testID="worker-edit-hours"
                      label={t("worker.supplement")}
                      value={editHours}
                      onChangeText={setEditHours}
                      keyboardType="number-pad"
                    />
                    <Input
                      testID="worker-edit-note"
                      label={t("worker.note")}
                      value={editNote}
                      onChangeText={setEditNote}
                    />
                    <View className="flex-row gap-2">
                      <View className="flex-1">
                        <Button
                          testID="worker-edit-cancel"
                          label={t("common.cancel")}
                          variant="secondary"
                          onPress={() => setEditing(false)}
                        />
                      </View>
                      <View className="flex-1">
                        <Button
                          testID="worker-edit-submit"
                          label={
                            selectedEntry.status === "pending"
                              ? t("common.save")
                              : t("worker.editSubmit")
                          }
                          loading={editOwn.isPending}
                          onPress={() => submitEdit(selectedEntry)}
                        />
                      </View>
                    </View>
                  </View>
                ) : (
                  <View className="mt-3">
                    <Button
                      testID="worker-edit-open"
                      label={t("worker.edit")}
                      variant="secondary"
                      onPress={() => startEdit(selectedEntry)}
                    />
                  </View>
                )}
              </>
            ) : (
              <>
                <View className="mt-3">
                  <Segmented<ShiftType>
                    testID="worker-shift"
                    value={shift}
                    onChange={setShift}
                    options={SHIFTS.map((value) => ({
                      value,
                      label: t(`labor.shift.${value}`),
                    }))}
                  />
                </View>
                <View className="mt-3">
                  <Button
                    testID="worker-log-submit"
                    label={t("worker.submit")}
                    loading={selfLog.isPending}
                    disabled={!canLogSelected}
                    onPress={() =>
                      selfLog.mutate({ date: selectedDay, shift_type: shift })
                    }
                  />
                </View>
                {selectedDay > today ? (
                  <Text className="mt-2 font-sans text-[12px] text-muted">
                    {t("worker.futureDay")}
                  </Text>
                ) : null}
              </>
            )}
          </Card>
        ) : null}

        <View className="flex-row gap-2">
          <Kpi
            label={t("worker.kpi.days")}
            value={String(summary.data?.total_days ?? 0)}
            testID="worker-kpi-days"
          />
          <Kpi
            label={t("worker.kpi.earned")}
            value={formatMoney(summary.data?.total_cost ?? 0)}
            testID="worker-kpi-earned"
          />
          <Kpi
            label={t("worker.kpi.pending")}
            value={String(pendingCount)}
            testID="worker-kpi-pending"
            warning={pendingCount > 0}
          />
        </View>

        {entries.isPending ? (
          <ActivityIndicator className="my-6" color={tokens.ink} />
        ) : (
          <AttendanceCalendar
            month={month}
            entries={monthEntries}
            colorOf={colorOf}
            selected={selectedDay}
            onSelectDay={selectDay}
          />
        )}

        <View className="gap-2">
          <Text className="font-sans-medium text-[11px] uppercase tracking-[1.1px] text-muted">
            {t("worker.monthList")}
          </Text>
          {entries.isFetched && monthEntries.length === 0 ? (
            <EmptyState message={t("worker.empty")} />
          ) : null}
          {monthEntries.map((entry) => (
            <EntryRow key={entry.id} entry={entry} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

/** "Cả ngày · +2 h" style label for a shift + extra hours. */
function shiftLabel(
  t: (key: string) => string,
  shift: ShiftType | null | undefined,
  hours: number | null | undefined,
): string {
  const base = t(`labor.shift.${shift ?? "none"}`);
  return hours && hours > 0 ? `${base} · +${hours} h` : base;
}

function Kpi({
  label,
  value,
  testID,
  warning = false,
}: {
  label: string;
  value: string;
  testID: string;
  warning?: boolean;
}) {
  return (
    <Card radius={14} elevated className="flex-1 p-3">
      <Text className="font-sans text-[11.5px] text-muted">{label}</Text>
      <Text
        className={`mt-0.5 font-mono text-xl ${warning ? "text-accent-ink" : "text-ink"}`}
        testID={testID}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
    </Card>
  );
}

function EntryRow({ entry }: { entry: LaborEntry }) {
  const { t } = useTranslation();
  const pending = entry.status === "pending";
  return (
    <View
      testID={`worker-entry-${entry.id}`}
      className="flex-row items-center justify-between rounded-[14px] border border-line bg-card px-3.5 py-3"
    >
      <View className="min-w-0 flex-1">
        <Text className="font-sans-medium text-[14px] text-ink">
          {formatDate(entry.date)}
        </Text>
        <Text className="font-sans text-[11.5px] text-muted">
          {t(`labor.shift.${entry.shift_type ?? "none"}`)}
          {entry.supplement_hours > 0 ? ` · +${entry.supplement_hours} h` : ""}
          {pending ? "" : ` · ${formatMoney(entry.effective_cost)}`}
        </Text>
      </View>
      <Badge
        label={
          entry.change_requested_at
            ? t("worker.changeRequested")
            : t(`worker.status.${pending ? "pending" : "validated"}`)
        }
        tone={pending || entry.change_requested_at ? "warning" : "success"}
      />
    </View>
  );
}
