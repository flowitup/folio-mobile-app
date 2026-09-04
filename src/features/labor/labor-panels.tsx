import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { Badge, Card, EmptyState } from "@/components/ui/primitives";
import type { LaborEntry, Worker } from "@/features/labor/labor-types";
import { formatMoney } from "@/lib/format/money";
import { useTokens } from "@/theme/tokens";

/** Colored worker used by every panel: the worker plus its avatar color. */
export type ColoredWorker = { worker: Worker; color: string };

/** "Thứ Năm 4/9" — locale weekday plus day/month, for the day card title. */
export function dayCardTitle(iso: string, localeTag: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const weekday = new Intl.DateTimeFormat(localeTag, {
    weekday: "long",
  }).format(new Date(y, m - 1, d));
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${d}/${m}`;
}

function shiftChip(entry: LaborEntry, t: (key: string) => string) {
  if (entry.shift_type === "full")
    return { label: t("labor.shift.full"), tone: "success" as const };
  if (entry.shift_type === "half")
    return { label: t("labor.shift.half"), tone: "warning" as const };
  if (entry.shift_type === "overtime")
    return { label: t("labor.shift.overtime"), tone: "accent" as const };
  return { label: `+${entry.supplement_hours} h`, tone: "accent" as const };
}

type KpiProps = { days: number; cost: number; unpaid: number };

/** Three KPI cards: Ngày công · Chi phí · Chưa trả (warning tint). */
export function LaborKpis({ days, cost, unpaid }: KpiProps) {
  const { t } = useTranslation();
  return (
    <View className="flex-row gap-2">
      <Card radius={14} elevated className="flex-1 p-3">
        <Text className="font-sans text-[11.5px] text-muted">
          {t("labor.summary.days")}
        </Text>
        <Text
          className="mt-0.5 font-mono text-xl text-ink"
          testID="labor-kpi-days"
        >
          {days}
        </Text>
      </Card>
      <Card radius={14} elevated className="flex-1 p-3">
        <Text className="font-sans text-[11.5px] text-muted">
          {t("labor.kpi.cost")}
        </Text>
        <Text
          className="mt-0.5 font-mono text-xl text-ink"
          testID="labor-kpi-cost"
        >
          {formatMoney(cost)}
        </Text>
      </Card>
      <View className="flex-1 rounded-[14px] border border-line bg-warning-tint p-3">
        <Text className="font-sans text-[11.5px] text-warning">
          {t("labor.kpi.unpaid")}
        </Text>
        <Text
          className="mt-0.5 font-mono text-xl text-warning"
          testID="labor-kpi-unpaid"
        >
          {formatMoney(unpaid)}
        </Text>
      </View>
    </View>
  );
}

type DayCardProps = {
  title: string;
  entries: LaborEntry[];
  colorOf: (workerId: string) => string;
  roleOf: (workerId: string) => string | null;
  onEntry: (entry: LaborEntry) => void;
  onLog: () => void;
  onDetails: () => void;
};

/** Selected-day card: title + mono total, worker rows with shift chips, "✓ Chấm công ngày này" CTA. */
export function LaborDayCard({
  title,
  entries,
  colorOf,
  roleOf,
  onEntry,
  onLog,
  onDetails,
}: DayCardProps) {
  const { t } = useTranslation();
  const tokens = useTokens();
  const total = entries.reduce((sum, entry) => sum + entry.effective_cost, 0);
  return (
    <Card radius={16} elevated testID="labor-day-card">
      <View className="flex-row items-center justify-between">
        <Text className="font-sans-semibold text-[15px] text-ink">{title}</Text>
        <Text
          className="font-mono text-[13px] text-muted"
          testID="labor-day-total"
        >
          {entries.length > 0 ? formatMoney(total) : t("labor.calendar.empty")}
        </Text>
      </View>
      <View className="mt-3 gap-2.5">
        {entries.map((entry) => {
          const chip = shiftChip(entry, t);
          return (
            <Pressable
              key={entry.id}
              testID={`day-entry-${entry.id}`}
              accessibilityRole="button"
              onPress={() => onEntry(entry)}
              className="flex-row items-center gap-3 active:opacity-70"
            >
              <Avatar
                name={entry.worker_name}
                size={36}
                color={colorOf(entry.worker_id)}
              />
              <View className="min-w-0 flex-1">
                <Text
                  className="font-sans-medium text-[14px] text-ink"
                  numberOfLines={1}
                >
                  {entry.worker_name}
                </Text>
                <Text
                  className="font-sans text-[11.5px] text-muted"
                  numberOfLines={1}
                >
                  {roleOf(entry.worker_id) ?? "—"} ·{" "}
                  <Text className="font-mono-regular">
                    {formatMoney(entry.effective_cost)}
                  </Text>
                </Text>
              </View>
              <Badge label={chip.label} tone={chip.tone} />
            </Pressable>
          );
        })}
      </View>
      <Pressable
        testID="day-log"
        accessibilityRole="button"
        onPress={onLog}
        className="mt-3.5 h-11 flex-row items-center justify-center gap-2 rounded-xl bg-ink active:opacity-70"
      >
        <Icon name="check" size={15} color={tokens.onInk} />
        <Text className="font-sans-semibold text-[14px] text-on-ink">
          {t("labor.calendar.logDay")}
        </Text>
      </Pressable>
      <Pressable
        testID="day-details"
        accessibilityRole="button"
        onPress={onDetails}
        className="mt-2.5 items-center active:opacity-70"
      >
        <Text className="font-sans text-xs text-accent-ink">
          {t("labor.calendar.details")} ›
        </Text>
      </Pressable>
    </Card>
  );
}

type WorkersPanelProps = {
  workers: ColoredWorker[];
  daysOf: (workerId: string) => number;
  onWorker: (worker: Worker) => void;
  onAdd: () => void;
};

/** Worker cards: 40px avatar, name, role · phone, mono daily rate + "mỗi ngày · N ngày"; dashed add card. */
export function WorkersPanel({
  workers,
  daysOf,
  onWorker,
  onAdd,
}: WorkersPanelProps) {
  const { t } = useTranslation();
  return (
    <View className="gap-2">
      {workers.length === 0 ? (
        <EmptyState message={t("labor.workers.none")} />
      ) : null}
      {workers.map(({ worker, color }) => (
        <Pressable
          key={worker.id}
          testID={`worker-card-${worker.id}`}
          accessibilityRole="button"
          onPress={() => onWorker(worker)}
          className="active:opacity-70"
        >
          <Card
            radius={14}
            elevated
            className="flex-row items-center gap-3 px-3.5 py-3"
          >
            <Avatar name={worker.name} size={40} color={color} />
            <View className="min-w-0 flex-1">
              <View className="flex-row items-center gap-2">
                <Text
                  className="font-sans-medium text-[15px] text-ink"
                  numberOfLines={1}
                >
                  {worker.name}
                </Text>
                {!worker.is_active ? (
                  <Badge label={t("labor.workers.inactive")} tone="warning" />
                ) : null}
              </View>
              <Text className="font-sans text-xs text-muted" numberOfLines={1}>
                {[worker.role_name ?? "—", worker.phone]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </View>
            <View className="items-end">
              <Text className="font-mono text-[14px] text-ink">
                {formatMoney(worker.current_daily_rate ?? worker.daily_rate)}
              </Text>
              <Text className="font-sans text-[10.5px] text-muted">
                {t("labor.workers.perDay", { count: daysOf(worker.id) })}
              </Text>
            </View>
          </Card>
        </Pressable>
      ))}
      <Pressable
        testID="worker-add"
        accessibilityRole="button"
        onPress={onAdd}
        className="h-[46px] items-center justify-center rounded-[14px] border-[1.5px] border-dashed border-line-2 active:opacity-70"
      >
        <Text className="font-sans-medium text-[14px] text-accent-ink">
          + {t("labor.workers.add")}
        </Text>
      </Pressable>
    </View>
  );
}

export type PaymentRow = {
  worker: Worker;
  color: string;
  owed: number;
  paid: number;
};

type PaymentsPanelProps = {
  rows: PaymentRow[];
  onRow: (row: PaymentRow) => void;
  onRecord: () => void;
  canRecord: boolean;
};

/** Payment cards per worker: state chip, positive paid bar, "Đã trả X · Còn Y"; ink CTA with the total due. */
export function PaymentsPanel({
  rows,
  onRow,
  onRecord,
  canRecord,
}: PaymentsPanelProps) {
  const { t } = useTranslation();
  const totalDue = rows.reduce(
    (sum, row) => sum + Math.max(0, row.owed - row.paid),
    0,
  );
  return (
    <View className="gap-2">
      {rows.length === 0 ? (
        <EmptyState message={t("labor.payments.none")} />
      ) : null}
      {rows.map((row) => {
        const due = Math.max(0, row.owed - row.paid);
        const pct =
          row.owed > 0
            ? Math.min(100, Math.round((row.paid / row.owed) * 100))
            : 100;
        return (
          <Pressable
            key={row.worker.id}
            testID={`payment-record-${row.worker.id}`}
            accessibilityRole="button"
            onPress={() => onRow(row)}
            disabled={!canRecord}
            className="active:opacity-70"
          >
            <Card radius={14} elevated className="p-3.5">
              <View className="flex-row items-center gap-2.5">
                <Avatar name={row.worker.name} size={32} color={row.color} />
                <Text
                  className="flex-1 font-sans-medium text-[15px] text-ink"
                  numberOfLines={1}
                >
                  {row.worker.name}
                </Text>
                <Badge
                  label={
                    due > 0
                      ? t("labor.payments.due")
                      : t("labor.payments.settled")
                  }
                  tone={due > 0 ? "warning" : "success"}
                />
              </View>
              <View className="mt-3 h-1.5 overflow-hidden rounded-[3px] bg-paper-2">
                <View
                  className="h-1.5 rounded-[3px] bg-positive"
                  style={{ width: `${pct}%` }}
                />
              </View>
              <View className="mt-1.5 flex-row justify-between">
                <Text className="font-mono-regular text-xs text-muted">
                  {t("labor.payments.paidShort")} {formatMoney(row.paid)}
                </Text>
                <Text className="font-mono-regular text-xs text-muted">
                  {t("labor.payments.dueShort")}{" "}
                  <Text
                    className={
                      due > 0
                        ? "font-mono-bold text-warning"
                        : "font-mono-bold text-muted"
                    }
                  >
                    {due > 0 ? formatMoney(due) : "—"}
                  </Text>
                </Text>
              </View>
            </Card>
          </Pressable>
        );
      })}
      {canRecord && rows.length > 0 ? (
        <Pressable
          testID="payment-record-all"
          accessibilityRole="button"
          onPress={onRecord}
          className="h-12 items-center justify-center rounded-[14px] bg-ink active:opacity-70"
        >
          <Text className="font-sans-semibold text-[15px] text-on-ink">
            {t("labor.payments.record")} · {formatMoney(totalDue)}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
