import { useTranslation } from "react-i18next";
import { ActivityIndicator, Text, View } from "react-native";

import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
} from "@/components/ui/primitives";
import type { RosterRow } from "@/features/labor/roster-api";
import { formatMoney } from "@/lib/format/money";

const STATUS_TONE: Record<
  RosterRow["status"],
  "success" | "warning" | "neutral"
> = {
  present: "success",
  pending: "warning",
  absent: "neutral",
};

type Props = {
  rows: RosterRow[] | undefined;
  loading: boolean;
  /** True when the roster query failed (403/404/network) — distinct from a genuinely empty day. */
  error?: boolean;
  /** Required alongside `error` so the inline error state can offer a retry. */
  onRetry?: () => void;
  /**
   * Worker id → today's cost, shown only when the caller has `project:view_pay` — never sourced
   * from the roster endpoint itself, which never returns rate/cost/amount (D3 whitelist).
   */
  payByWorkerId?: Record<string, number>;
};

/**
 * Day roster (D3): every project member sees names, presence, hours and day type for the whole
 * team — never money, unless the caller separately carries `project:view_pay` (`payByWorkerId`).
 */
export function DayRoster({
  rows,
  loading,
  error,
  onRetry,
  payByWorkerId,
}: Props) {
  const { t } = useTranslation();

  if (loading)
    return <ActivityIndicator className="my-4" testID="roster-loading" />;
  // A query error (403/404/network) is not the same state as "no one scheduled" — surface it
  // separately with a retry instead of the silent empty-day message.
  if (error)
    return (
      <ErrorState
        message={t("worker.roster.loadError")}
        retryLabel={t("common.retry")}
        onRetry={() => onRetry?.()}
      />
    );
  if (!rows || rows.length === 0)
    return <EmptyState message={t("worker.roster.empty")} />;

  return (
    <View className="gap-2" testID="day-roster">
      {rows.map((row) => (
        <Card
          key={row.worker_id}
          radius={12}
          testID={`roster-row-${row.worker_id}`}
        >
          <View className="flex-row items-center justify-between">
            <Text
              className="min-w-0 flex-1 pr-2 font-sans-medium text-[14px] text-ink"
              numberOfLines={1}
            >
              {row.name}
            </Text>
            <Badge
              label={t(`worker.status.${statusKey(row.status)}`)}
              tone={STATUS_TONE[row.status]}
            />
          </View>
          <View className="mt-1 flex-row items-center justify-between">
            <Text className="font-sans text-[12px] text-muted">
              {row.day_type
                ? t(`labor.shift.${row.day_type}`)
                : t("labor.shift.none")}
              {row.hours > 0 ? ` · ${row.hours} h` : ""}
            </Text>
            {payByWorkerId && payByWorkerId[row.worker_id] !== undefined ? (
              <Text
                testID={`roster-pay-${row.worker_id}`}
                className="font-mono text-[12px] text-ink"
              >
                {formatMoney(payByWorkerId[row.worker_id])}
              </Text>
            ) : null}
          </View>
        </Card>
      ))}
    </View>
  );
}

/** The roster's `pending` status reuses the worker-attendance vocabulary (`validated` vs it). */
function statusKey(
  status: RosterRow["status"],
): "validated" | "pending" | "absent" {
  return status === "present" ? "validated" : status;
}
