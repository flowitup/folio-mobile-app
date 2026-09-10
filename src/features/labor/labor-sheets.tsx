import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";

import { useAuth } from "@/auth/auth-context";
import { isCompanyAdminOrManager } from "@/auth/permissions";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/primitives";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import { useCompanyPersons } from "@/features/companies/company-members-api";
import { useMembers } from "@/features/projects/members-api";
import { formatDate, toIsoDate } from "@/lib/format/date";
import { formatMoney, parseMoneyInput } from "@/lib/format/money";
import {
  NEW_PERSON,
  directoryCandidates,
  prefillFromDirectory,
} from "@/lib/labor/company-directory-candidates";
import { laborRoleLabel } from "@/lib/labor/labor-role-label";
import { countRepricedDays } from "@/lib/labor/rate-change-impact";
import { currentDailyRate } from "@/lib/labor/rate-history";

import {
  useCreateRateChange,
  useDeleteRateChange,
  useLaborEntries,
  useLaborRoles,
  useRateChanges,
  useWorkers,
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
  /** When set, the sheet offers to link a project member's app account (worker mode / self-log). */
  projectId?: string;
  /**
   * Owning company. Unlocks the person directory so someone who already works for the
   * company is added to this project as the SAME person instead of a fresh duplicate.
   */
  companyId?: string | null;
};

const NO_ACCOUNT = "__none__";

/** Add / edit worker — name, daily rate (create only; later via rate changes), phone, role, linked account. */
export const WorkerFormSheet = forwardRef<SheetHandle, WorkerFormProps>(
  function WorkerFormSheet(
    { worker, submitting, onSubmit, projectId, companyId },
    ref,
  ) {
    const { t } = useTranslation();
    const { user } = useAuth();
    const sheet = useRef<BottomSheetModal>(null);
    const roles = useLaborRoles();
    const members = useMembers(projectId ?? "");
    // The backend reserves the directory for a company admin or manager: anyone else
    // must never issue the request, not even once (it would 403).
    const mayReadDirectory =
      !worker && isCompanyAdminOrManager(user, companyId);
    const directory = useCompanyPersons(
      mayReadDirectory ? (companyId ?? undefined) : undefined,
    );
    const projectWorkers = useWorkers(projectId ?? "");
    const candidates = useMemo(
      () => directoryCandidates(directory.data, projectWorkers.data),
      [directory.data, projectWorkers.data],
    );
    // Both answers are needed before offering anyone: until the project's workers are
    // known, the "already works here" filter cannot run and the picker would offer a
    // duplicate. The options fill in when they settle; the picker itself is mounted
    // from the start (see below) and offers only "someone new" until then.
    const offered =
      directory.isFetched && projectWorkers.isFetched ? candidates : [];
    const [personId, setPersonId] = useState<string>(NEW_PERSON);
    const [userId, setUserId] = useState<string | null>(
      worker?.user_id ?? null,
    );
    const [name, setName] = useState(worker?.name ?? "");
    const [rate, setRate] = useState(worker ? String(worker.daily_rate) : "");
    const [phone, setPhone] = useState(worker?.phone ?? "");
    const [roleId, setRoleId] = useState<string | null>(
      worker?.role_id ?? null,
    );
    const [error, setError] = useState<string | null>(null);

    const picked =
      personId === NEW_PERSON
        ? null
        : (offered.find((entry) => entry.person_id === personId) ?? null);

    useImperativeHandle(ref, () => ({
      open: () => {
        setPersonId(NEW_PERSON);
        setName(worker?.name ?? "");
        setRate(worker ? String(worker.daily_rate) : "");
        setPhone(worker?.phone ?? "");
        setRoleId(worker?.role_id ?? null);
        setUserId(worker?.user_id ?? null);
        setError(null);
        sheet.current?.present();
      },
      close: () => sheet.current?.dismiss(),
    }));

    /** Company profile supplies identity, rate, role and account — each still editable below. */
    function pickPerson(value: string) {
      setPersonId(value);
      setError(null);
      if (value === NEW_PERSON) {
        setName("");
        setPhone("");
        setRate("");
        setRoleId(null);
        setUserId(null);
        return;
      }
      const entry = offered.find((item) => item.person_id === value);
      if (!entry) return;
      const prefill = prefillFromDirectory(entry);
      setRate(prefill.rate);
      setRoleId(prefill.roleId);
      setUserId(prefill.userId);
    }

    function submit() {
      if (worker) {
        if (!name.trim()) return setError(t("labor.workers.nameRequired"));
        return onSubmit({
          name: name.trim(),
          phone: phone.trim() || undefined,
          role_id: roleId,
          user_id: userId,
        });
      }
      // Identity comes from the picked Person; only the legacy manual path needs a name.
      if (!picked && !name.trim())
        return setError(t("labor.workers.nameRequired"));
      const dailyRate = parseMoneyInput(rate);
      if (!dailyRate || dailyRate <= 0)
        return setError(t("labor.workers.rateRequired"));
      onSubmit({
        // Sent alone, without name/phone: the server resolves both from the Person,
        // which stays the single source of truth for who this worker is.
        ...(picked
          ? { person_id: picked.person_id }
          : { name: name.trim(), phone: phone.trim() || undefined }),
        daily_rate: dailyRate,
        role_id: roleId ?? undefined,
        user_id: userId ?? undefined,
      });
    }

    return (
      <Sheet
        ref={sheet}
        title={worker ? t("labor.workers.edit") : t("labor.workers.add")}
        snapPoints={["70%"]}
      >
        <View className="p-4">
          {/* Mounted for the whole life of the sheet, never gated on the directory query.
              A nested bottom sheet that appears while its parent is already open corrupts
              gorhom's sheet stack: the next dismiss closes both and the form stops
              re-opening. `mayReadDirectory` only reads the caller's company role, which
              cannot change while the sheet is up. */}
          {mayReadDirectory ? (
            <Select
              testID="worker-person"
              label={t("labor.workers.fromCompany")}
              placeholder={t("labor.workers.fromCompanyNew")}
              value={personId}
              options={[
                ...offered.map((entry) => ({
                  value: entry.person_id,
                  label: entry.phone
                    ? `${entry.name} · ${entry.phone}`
                    : entry.name,
                })),
                { value: NEW_PERSON, label: t("labor.workers.fromCompanyNew") },
              ]}
              onChange={pickPerson}
            />
          ) : null}
          {picked ? (
            <Card className="mb-4 p-3">
              <Text
                testID="worker-person-name"
                className="font-sans text-base text-ink"
              >
                {picked.name}
              </Text>
              <Text className="mt-0.5 font-sans text-[13px] text-muted">
                {picked.phone
                  ? `${picked.phone} · ${t("labor.workers.fromCompanyHint")}`
                  : t("labor.workers.fromCompanyHint")}
              </Text>
            </Card>
          ) : (
            <Input
              testID="worker-name"
              label={t("labor.workers.name")}
              value={name}
              onChangeText={setName}
              error={error}
              autoFocus
            />
          )}
          {!worker ? (
            <Input
              testID="worker-rate"
              label={t("labor.workers.dailyRate")}
              value={rate}
              onChangeText={setRate}
              keyboardType="decimal-pad"
              error={picked ? error : undefined}
            />
          ) : null}
          {!picked ? (
            <Input
              testID="worker-phone"
              label={t("labor.workers.phone")}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          ) : null}
          <Select
            testID="worker-role"
            label={t("labor.workers.role")}
            placeholder={t("labor.workers.roleNone")}
            value={roleId}
            options={(roles.data?.roles ?? []).map((role) => ({
              value: role.id,
              label: laborRoleLabel(role, t),
            }))}
            onChange={setRoleId}
          />
          {projectId ? (
            <Select
              testID="worker-account"
              label={t("labor.workers.account")}
              placeholder={t("labor.workers.accountNone")}
              value={userId ?? NO_ACCOUNT}
              options={[
                { value: NO_ACCOUNT, label: t("labor.workers.accountNone") },
                ...(members.data ?? []).map((member) => ({
                  value: member.user_id,
                  label: member.display_name
                    ? `${member.display_name} · ${member.email}`
                    : member.email,
                })),
              ]}
              onChange={(value) =>
                setUserId(value === NO_ACCOUNT ? null : value)
              }
            />
          ) : null}
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
  // Days already logged from the picked date onward: the backend re-prices them
  // on read, so show the admin how far back this change reaches before saving.
  // The `worker` prop is captured when the actions sheet opens, so its
  // current_daily_rate is stale the moment a change is saved. The mutation
  // invalidates the workers query, so read the rate off that fresh row.
  const workers = useWorkers(projectId);
  const fresh =
    workers.data?.find((candidate) => candidate.id === worker?.id) ?? worker;
  const today = useMemo(() => toIsoDate(new Date()), []);
  const logged = useLaborEntries(
    projectId,
    date ?? undefined,
    undefined,
    Boolean(worker && date),
  );
  const repricedDays = countRepricedDays(
    logged.data ?? [],
    worker?.id ?? "",
    date ?? "",
  );

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
              fresh ? currentDailyRate(fresh, changes.data ?? [], today) : 0,
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
        {date && !logged.isPending ? (
          <Text
            testID="rate-change-impact"
            className="mb-2 text-xs text-muted-foreground"
          >
            {t("labor.rates.impact", {
              count: repricedDays,
              date: formatDate(date),
            })}
          </Text>
        ) : null}
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
): BulkLogEntry[] {
  return Object.entries(states)
    .filter(([, state]) => state.checked)
    .map(([workerId, state]) => ({
      worker_id: workerId,
      shift_type: state.shift_type,
      ...(state.supplement_hours > 0
        ? { supplement_hours: state.supplement_hours }
        : {}),
    }));
}

type LogDayProps = {
  date: string | null;
  workers: Worker[];
  loggedWorkerIds: Set<string>;
  lastDayEntries: LaborEntry[];
  submitting: boolean;
  onSubmit: (entries: BulkLogEntry[]) => void;
};

/** Worker tiles for one day: tap toggles, shift chip cycles full → half → overtime, supplement stepper. */
export const LogDaySheet = forwardRef<SheetHandle, LogDayProps>(
  function LogDaySheet(
    { date, workers, loggedWorkerIds, lastDayEntries, submitting, onSubmit },
    ref,
  ) {
    const { t } = useTranslation();
    const sheet = useRef<BottomSheetModal>(null);
    const [states, setStates] = useState<Record<string, TileState>>({});

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
          <Button
            testID="log-day-submit"
            label={t("labor.log.submit", { count: selectedCount })}
            disabled={selectedCount === 0}
            loading={submitting}
            onPress={() => onSubmit(buildBulkEntries(states))}
          />
        </View>
      </Sheet>
    );
  },
);

// ---- edit entry ------------------------------------------------------------------

type EditEntryProps = {
  entry: LaborEntry | null;
  submitting: boolean;
  onSubmit: (values: UpdateAttendancePayload) => void;
  onDelete: () => void;
};

/** Edit one attendance row: shift, supplement, override, note; delete. */
export const EditEntrySheet = forwardRef<SheetHandle, EditEntryProps>(
  function EditEntrySheet({ entry, submitting, onSubmit, onDelete }, ref) {
    const { t } = useTranslation();
    const sheet = useRef<BottomSheetModal>(null);
    const [shift, setShift] = useState<ShiftType | "none">("full");
    const [supplement, setSupplement] = useState("0");
    const [override, setOverride] = useState("");
    const [note, setNote] = useState("");

    useEffect(() => {
      setShift(entry?.shift_type ?? "none");
      setSupplement(String(entry?.supplement_hours ?? 0));
      setOverride(
        entry?.amount_override != null ? String(entry.amount_override) : "",
      );
      setNote(entry?.note ?? "");
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
