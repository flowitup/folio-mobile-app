import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/primitives";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import type { Tag } from "@/features/projects/tags-api";
import { formatDate, toIsoDate } from "@/lib/format/date";
import { formatMoney, parseMoneyInput } from "@/lib/format/money";

import {
  useCreateRateChange,
  useDeleteRateChange,
  useLaborRoles,
  useRateChanges,
} from "./labor-api";
import type {
  BulkLogEntry,
  CreateWorkerPayload,
  LaborEntry,
  ShiftType,
  UpdateAttendancePayload,
  UpdateWorkerPayload,
  Worker,
} from "./labor-types";

export type SheetHandle = { open: () => void; close: () => void };

export const SHIFT_TYPES: ShiftType[] = ["full", "half", "overtime"];

// ---- worker form -----------------------------------------------------------

type WorkerFormProps = {
  worker?: Worker;
  submitting: boolean;
  onSubmit: (values: CreateWorkerPayload | UpdateWorkerPayload) => void;
};

/** Add / edit worker — name, daily rate (create only; later via rate changes), phone, role. */
export const WorkerFormSheet = forwardRef<SheetHandle, WorkerFormProps>(
  function WorkerFormSheet({ worker, submitting, onSubmit }, ref) {
    const { t } = useTranslation();
    const sheet = useRef<BottomSheetModal>(null);
    const roles = useLaborRoles();
    const [name, setName] = useState(worker?.name ?? "");
    const [rate, setRate] = useState(worker ? String(worker.daily_rate) : "");
    const [phone, setPhone] = useState(worker?.phone ?? "");
    const [roleId, setRoleId] = useState<string | null>(
      worker?.role_id ?? null,
    );
    const [error, setError] = useState<string | null>(null);

    useImperativeHandle(ref, () => ({
      open: () => {
        setName(worker?.name ?? "");
        setRate(worker ? String(worker.daily_rate) : "");
        setPhone(worker?.phone ?? "");
        setRoleId(worker?.role_id ?? null);
        setError(null);
        sheet.current?.present();
      },
      close: () => sheet.current?.dismiss(),
    }));

    function submit() {
      if (!name.trim()) return setError(t("labor.workers.nameRequired"));
      if (worker)
        return onSubmit({
          name: name.trim(),
          phone: phone.trim() || undefined,
          role_id: roleId,
        });
      const dailyRate = parseMoneyInput(rate);
      if (!dailyRate || dailyRate <= 0)
        return setError(t("labor.workers.rateRequired"));
      onSubmit({
        name: name.trim(),
        daily_rate: dailyRate,
        phone: phone.trim() || undefined,
        role_id: roleId ?? undefined,
      });
    }

    return (
      <Sheet
        ref={sheet}
        title={worker ? t("labor.workers.edit") : t("labor.workers.add")}
        snapPoints={["70%"]}
      >
        <View className="p-4">
          <Input
            testID="worker-name"
            label={t("labor.workers.name")}
            value={name}
            onChangeText={setName}
            error={error}
            autoFocus
          />
          {!worker ? (
            <Input
              testID="worker-rate"
              label={t("labor.workers.dailyRate")}
              value={rate}
              onChangeText={setRate}
              keyboardType="decimal-pad"
            />
          ) : null}
          <Input
            testID="worker-phone"
            label={t("labor.workers.phone")}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
          <Select
            testID="worker-role"
            label={t("labor.workers.role")}
            placeholder={t("labor.workers.roleNone")}
            value={roleId}
            options={(roles.data?.roles ?? []).map((role) => ({
              value: role.id,
              label: role.name,
            }))}
            onChange={setRoleId}
          />
          <Button
            testID="worker-submit"
            label={t("common.save")}
            loading={submitting}
            onPress={submit}
          />
        </View>
      </Sheet>
    );
  },
);

// ---- rate changes ------------------------------------------------------------

/** Rate history for a worker + add a change effective from a date. */
export const RateChangesSheet = forwardRef<
  SheetHandle,
  { projectId: string; worker: Worker | null }
>(function RateChangesSheet({ projectId, worker }, ref) {
  const { t } = useTranslation();
  const sheet = useRef<BottomSheetModal>(null);
  const changes = useRateChanges(projectId, worker?.id ?? null);
  const create = useCreateRateChange(projectId);
  const remove = useDeleteRateChange(projectId);
  const [date, setDate] = useState<string | null>(toIsoDate(new Date()));
  const [rate, setRate] = useState("");

  useImperativeHandle(ref, () => ({
    open: () => sheet.current?.present(),
    close: () => sheet.current?.dismiss(),
  }));

  return (
    <Sheet
      ref={sheet}
      title={t("labor.rates.title", { name: worker?.name ?? "" })}
      snapPoints={["75%"]}
    >
      <View className="p-4">
        <Text className="mb-3 text-sm text-muted-foreground">
          {t("labor.rates.current", {
            rate: formatMoney(
              worker?.current_daily_rate ?? worker?.daily_rate ?? 0,
            ),
          })}
        </Text>
        {(changes.data ?? []).map((change) => (
          <Card
            key={change.id}
            className="mb-2 flex-row items-center justify-between"
          >
            <Text className="text-sm text-primary">
              {formatDate(change.effective_date)} →{" "}
              {formatMoney(change.daily_rate)}
            </Text>
            <Pressable
              testID={`rate-change-delete-${change.id}`}
              onPress={() =>
                worker &&
                remove.mutate({ workerId: worker.id, rateChangeId: change.id })
              }
            >
              <Text className="text-sm text-danger">{t("common.delete")}</Text>
            </Pressable>
          </Card>
        ))}
        <DatePicker
          testID="rate-change-date"
          label={t("labor.rates.effectiveDate")}
          value={date}
          onChange={setDate}
          doneLabel={t("common.ok")}
        />
        <Input
          testID="rate-change-rate"
          label={t("labor.workers.dailyRate")}
          value={rate}
          onChangeText={setRate}
          keyboardType="decimal-pad"
        />
        <Button
          testID="rate-change-submit"
          label={t("labor.rates.add")}
          loading={create.isPending}
          onPress={() => {
            const dailyRate = parseMoneyInput(rate);
            if (worker && date && dailyRate && dailyRate > 0)
              create.mutate(
                {
                  workerId: worker.id,
                  effective_date: date,
                  daily_rate: dailyRate,
                },
                { onSuccess: () => setRate("") },
              );
          }}
        />
      </View>
    </Sheet>
  );
});

// ---- log day (bulk) --------------------------------------------------------------

export type TileState = {
  checked: boolean;
  shift_type: ShiftType;
  supplement_hours: number;
};

/** Mirrors the web `buildBulkPayload`: checked tiles become bulk entries. */
export function buildBulkEntries(
  states: Record<string, TileState>,
  tagId: string | null,
): BulkLogEntry[] {
  return Object.entries(states)
    .filter(([, state]) => state.checked)
    .map(([workerId, state]) => ({
      worker_id: workerId,
      shift_type: state.shift_type,
      ...(state.supplement_hours > 0
        ? { supplement_hours: state.supplement_hours }
        : {}),
      ...(tagId ? { tag_id: tagId } : {}),
    }));
}

type LogDayProps = {
  date: string | null;
  workers: Worker[];
  loggedWorkerIds: Set<string>;
  lastDayEntries: LaborEntry[];
  tags: Tag[];
  submitting: boolean;
  onSubmit: (entries: BulkLogEntry[]) => void;
};

/** Worker tiles for one day: tap toggles, shift chip cycles full → half → overtime, supplement stepper. */
export const LogDaySheet = forwardRef<SheetHandle, LogDayProps>(
  function LogDaySheet(
    {
      date,
      workers,
      loggedWorkerIds,
      lastDayEntries,
      tags,
      submitting,
      onSubmit,
    },
    ref,
  ) {
    const { t } = useTranslation();
    const sheet = useRef<BottomSheetModal>(null);
    const [states, setStates] = useState<Record<string, TileState>>({});
    const [tagId, setTagId] = useState<string | null>(null);

    useEffect(() => {
      const next: Record<string, TileState> = {};
      for (const worker of workers)
        next[worker.id] = {
          checked: false,
          shift_type: "full",
          supplement_hours: 0,
        };
      setStates(next);
    }, [workers, date]);

    useImperativeHandle(ref, () => ({
      open: () => sheet.current?.present(),
      close: () => sheet.current?.dismiss(),
    }));

    const available = workers.filter(
      (worker) => worker.is_active && !loggedWorkerIds.has(worker.id),
    );
    const update = (id: string, patch: Partial<TileState>) =>
      setStates((current) => ({
        ...current,
        [id]: { ...current[id], ...patch },
      }));
    const cycleShift = (current: ShiftType): ShiftType =>
      SHIFT_TYPES[(SHIFT_TYPES.indexOf(current) + 1) % SHIFT_TYPES.length];

    function applyLastDay() {
      setStates((current) => {
        const next = { ...current };
        for (const entry of lastDayEntries)
          if (next[entry.worker_id] && !loggedWorkerIds.has(entry.worker_id))
            next[entry.worker_id] = {
              checked: true,
              shift_type: entry.shift_type ?? "full",
              supplement_hours: entry.supplement_hours,
            };
        return next;
      });
    }

    const selectedCount = Object.values(states).filter((s) => s.checked).length;

    return (
      <Sheet
        ref={sheet}
        title={t("labor.log.title", { date: date ? formatDate(date) : "" })}
        snapPoints={["85%"]}
      >
        <View className="p-4">
          {lastDayEntries.length > 0 ? (
            <Button
              testID="log-day-same-as-last"
              label={t("labor.log.sameAsLastDay")}
              variant="secondary"
              size="sm"
              className="mb-3"
              onPress={applyLastDay}
            />
          ) : null}
          {available.length === 0 ? (
            <Text className="text-muted-foreground">
              {t("labor.log.noWorkers")}
            </Text>
          ) : null}
          {available.map((worker) => {
            const state = states[worker.id] ?? {
              checked: false,
              shift_type: "full" as ShiftType,
              supplement_hours: 0,
            };
            return (
              <Card
                key={worker.id}
                className={`mb-2 ${state.checked ? "border-primary bg-paper-2" : ""}`}
              >
                <View className="flex-row items-center">
                  <Pressable
                    testID={`log-tile-${worker.id}`}
                    onPress={() =>
                      update(worker.id, { checked: !state.checked })
                    }
                    className="flex-1 flex-row items-center"
                  >
                    <View
                      className={`mr-3 h-5 w-5 items-center justify-center rounded border ${state.checked ? "border-primary bg-primary" : "border-border"}`}
                    >
                      {state.checked ? (
                        <Text className="text-xs text-primary-foreground">
                          ✓
                        </Text>
                      ) : null}
                    </View>
                    <View
                      className="mr-2 h-3 w-3 rounded-full"
                      style={{
                        backgroundColor: worker.role_color ?? "#a3a3a3",
                      }}
                    />
                    <Text className="flex-1 text-base text-primary">
                      {worker.name}
                    </Text>
                  </Pressable>
                  {state.checked ? (
                    <Pressable
                      testID={`log-shift-${worker.id}`}
                      onPress={() =>
                        update(worker.id, {
                          shift_type: cycleShift(state.shift_type),
                        })
                      }
                      className="rounded-full border border-border px-3 py-1"
                    >
                      <Text className="text-xs text-primary">
                        {t(`labor.shift.${state.shift_type}`)}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
                {state.checked ? (
                  <View className="mt-2 flex-row items-center">
                    <Text className="mr-2 text-xs text-muted-foreground">
                      {t("labor.log.supplement")}
                    </Text>
                    <Pressable
                      testID={`log-supp-minus-${worker.id}`}
                      onPress={() =>
                        update(worker.id, {
                          supplement_hours: Math.max(
                            0,
                            state.supplement_hours - 1,
                          ),
                        })
                      }
                      className="rounded border border-border px-3 py-1"
                    >
                      <Text>−</Text>
                    </Pressable>
                    <Text className="mx-3 text-sm text-primary">
                      {state.supplement_hours} h
                    </Text>
                    <Pressable
                      testID={`log-supp-plus-${worker.id}`}
                      onPress={() =>
                        update(worker.id, {
                          supplement_hours: Math.min(
                            12,
                            state.supplement_hours + 1,
                          ),
                        })
                      }
                      className="rounded border border-border px-3 py-1"
                    >
                      <Text>+</Text>
                    </Pressable>
                  </View>
                ) : null}
              </Card>
            );
          })}
          {tags.length > 0 ? (
            <Select
              testID="log-day-tag"
              label={t("invoices.form.tag")}
              placeholder={t("invoices.form.tagNone")}
              value={tagId}
              options={tags.map((tag) => ({ value: tag.id, label: tag.name }))}
              onChange={setTagId}
            />
          ) : null}
          <Button
            testID="log-day-submit"
            label={t("labor.log.submit", { count: selectedCount })}
            disabled={selectedCount === 0}
            loading={submitting}
            onPress={() => onSubmit(buildBulkEntries(states, tagId))}
          />
        </View>
      </Sheet>
    );
  },
);

// ---- edit entry ------------------------------------------------------------------

type EditEntryProps = {
  entry: LaborEntry | null;
  tags: Tag[];
  submitting: boolean;
  onSubmit: (values: UpdateAttendancePayload) => void;
  onDelete: () => void;
};

/** Edit one attendance row: shift, supplement, override, note, tag; delete. */
export const EditEntrySheet = forwardRef<SheetHandle, EditEntryProps>(
  function EditEntrySheet(
    { entry, tags, submitting, onSubmit, onDelete },
    ref,
  ) {
    const { t } = useTranslation();
    const sheet = useRef<BottomSheetModal>(null);
    const [shift, setShift] = useState<ShiftType | "none">("full");
    const [supplement, setSupplement] = useState("0");
    const [override, setOverride] = useState("");
    const [note, setNote] = useState("");
    const [tagId, setTagId] = useState<string | null>(null);

    useEffect(() => {
      setShift(entry?.shift_type ?? "none");
      setSupplement(String(entry?.supplement_hours ?? 0));
      setOverride(
        entry?.amount_override != null ? String(entry.amount_override) : "",
      );
      setNote(entry?.note ?? "");
      setTagId(entry?.tag_id ?? null);
    }, [entry]);

    useImperativeHandle(ref, () => ({
      open: () => sheet.current?.present(),
      close: () => sheet.current?.dismiss(),
    }));

    return (
      <Sheet
        ref={sheet}
        title={entry ? `${entry.worker_name} · ${formatDate(entry.date)}` : ""}
        snapPoints={["80%"]}
      >
        <ScrollView contentContainerClassName="p-4">
          <Select<ShiftType | "none">
            testID="entry-shift"
            label={t("labor.log.shiftType")}
            value={shift}
            options={[
              { value: "none", label: t("labor.shift.none") },
              ...SHIFT_TYPES.map((value) => ({
                value,
                label: t(`labor.shift.${value}`),
              })),
            ]}
            onChange={setShift}
          />
          <Input
            testID="entry-supplement"
            label={t("labor.log.supplement")}
            value={supplement}
            onChangeText={setSupplement}
            keyboardType="number-pad"
          />
          <Input
            testID="entry-override"
            label={t("labor.log.amountOverride")}
            value={override}
            onChangeText={setOverride}
            keyboardType="decimal-pad"
            hint={t("labor.log.amountOverrideHint")}
          />
          <Input
            testID="entry-note"
            label={t("labor.log.note")}
            value={note}
            onChangeText={setNote}
            multiline
          />
          {tags.length > 0 ? (
            <Select
              testID="entry-tag"
              label={t("invoices.form.tag")}
              placeholder={t("invoices.form.tagNone")}
              value={tagId}
              options={tags.map((tag) => ({ value: tag.id, label: tag.name }))}
              onChange={setTagId}
            />
          ) : null}
          <Text className="mb-3 text-sm text-muted-foreground">
            {t("labor.log.effectiveCost", {
              amount: formatMoney(entry?.effective_cost ?? 0),
            })}
          </Text>
          <Button
            testID="entry-save"
            label={t("common.save")}
            loading={submitting}
            className="mb-3"
            onPress={() =>
              onSubmit({
                shift_type: shift === "none" ? null : shift,
                supplement_hours: Math.max(
                  0,
                  Math.min(12, Number(supplement) || 0),
                ),
                amount_override: override.trim()
                  ? parseMoneyInput(override)
                  : null,
                note: note.trim() || null,
                tag_id: tagId,
              })
            }
          />
          <Button
            testID="entry-delete"
            label={t("common.delete")}
            variant="danger"
            onPress={onDelete}
          />
        </ScrollView>
      </Sheet>
    );
  },
);
