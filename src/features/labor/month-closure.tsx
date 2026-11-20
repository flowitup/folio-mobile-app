/**
 * Closed labor months ("Chốt tháng", owner decision QĐ-10) on the labor tab.
 *
 *  - `LaborMonthClosureContext`: the project's closed months and `confirmWrite`, which every
 *    save into a month (log day, edit / delete / validate a day, record a payment, rate change)
 *    awaits first: "Tháng X đã chốt. Vẫn lưu?". Outside a provider nothing is closed.
 *  - `MonthClosurePanel`: on the Summary's single-month view, "Chốt tháng X" for a manager
 *    (with a checklist of what is still loose), or "Đã chốt · bởi A, ngày D" with "Mở lại"
 *    and the list of changes made after closing.
 *  - `MonthClosedBadge`: a small marker on the attendance month.
 *
 * Closing locks nothing (owner: "vẫn sửa được nhưng hiện cảnh báo và ghi lại ai sửa, không
 * khóa cứng"): confirming saves as usual and the API records the change.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Icon } from "@/components/ui/icon";
import { Badge } from "@/components/ui/primitives";
import { showToast } from "@/components/ui/toast";
import type { LaborPaymentsSummary } from "@/features/invoices/invoices-api";
import {
  useCloseLaborMonth,
  useLaborEntries,
  useReopenLaborMonth,
} from "@/features/labor/labor-api";
import type {
  LaborMonthClosure,
  LaborMonthClosureEdit,
} from "@/features/labor/labor-types";
import {
  capitalizeFirst,
  formatDate,
  formatInstant,
  formatInstantDateTime,
  formatMonth,
} from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";
import {
  closeChecklist,
  closedMonthsFor,
  closureFor,
} from "@/lib/labor/month-closure";
import { monthRange } from "@/lib/labor/month-range";
import { useTokens } from "@/theme/tokens";

export type LaborMonthClosureApi = {
  closures: LaborMonthClosure[];
  /**
   * Resolves true when none of `daysOrMonths` (`YYYY-MM-DD` / `YYYY-MM`) is in a closed month,
   * or when the user chose "save anyway".
   */
  confirmWrite: (
    daysOrMonths: readonly (string | null | undefined)[],
  ) => Promise<boolean>;
};

const NOTHING_CLOSED: LaborMonthClosureApi = {
  closures: [],
  confirmWrite: async () => true,
};

export const LaborMonthClosureContext =
  createContext<LaborMonthClosureApi>(NOTHING_CLOSED);

export function useClosedMonths(): LaborMonthClosureApi {
  return useContext(LaborMonthClosureContext);
}

/**
 * State for the provider: `confirmWrite` plus the dialog that asks. Render `dialog` once, in
 * the screen; it is a modal, so it shows over an open sheet.
 */
export function useMonthClosureGuard(closures: LaborMonthClosure[]): {
  api: LaborMonthClosureApi;
  dialog: ReactNode;
} {
  const { t } = useTranslation();
  const [asking, setAsking] = useState<string[] | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const settle = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setAsking(null);
  }, []);

  const confirmWrite = useCallback(
    (daysOrMonths: readonly (string | null | undefined)[]) => {
      const months = closedMonthsFor(closures, daysOrMonths);
      if (months.length === 0) return Promise.resolve(true);
      // A question still open is answered "no" before a new one replaces it.
      resolver.current?.(false);
      return new Promise<boolean>((resolve) => {
        resolver.current = resolve;
        setAsking(months);
      });
    },
    [closures],
  );

  const api = useMemo(
    () => ({ closures, confirmWrite }),
    [closures, confirmWrite],
  );
  const dialog = (
    <ConfirmDialog
      visible={asking !== null}
      title={t("labor.closure.writeTitle", {
        months: capitalizeFirst((asking ?? []).map(formatMonth).join(", ")),
      })}
      message={t("labor.closure.writeMessage")}
      confirmLabel={t("labor.closure.writeConfirm")}
      cancelLabel={t("common.cancel")}
      onCancel={() => settle(false)}
      onConfirm={() => settle(true)}
    />
  );
  return { api, dialog };
}

/** "Đã chốt" marker for the month shown on the attendance tab; nothing when it is open. */
export function MonthClosedBadge({ month }: { month: string }) {
  const { t } = useTranslation();
  const { closures } = useClosedMonths();
  const closure = closureFor(closures, month);
  if (!closure) return null;
  return (
    <Badge
      testID="labor-month-closed-badge"
      tone={closure.edited_after_close > 0 ? "warning" : "success"}
      label={capitalizeFirst(
        t("labor.closure.closedBadge", { month: formatMonth(month) }),
      )}
    />
  );
}

const KNOWN_KINDS = new Set([
  "entry_created",
  "entry_updated",
  "entry_deleted",
  "entry_self_logged",
  "entry_self_edited",
  "entry_validated",
  "entry_rejected",
  "change_approved",
  "payment_created",
  "payment_updated",
  "payment_deleted",
  "rate_changed",
  "rate_change_deleted",
]);

/**
 * The Summary's single-month close / closed panel. `owed`: still owed to the month's workers
 * (positive balances only).
 */
export function MonthClosurePanel({
  projectId,
  month,
  canManage,
  owed,
  payments,
}: {
  projectId: string;
  month: string;
  canManage: boolean;
  owed: number;
  payments: LaborPaymentsSummary | null | undefined;
}) {
  const { t } = useTranslation();
  const tokens = useTokens();
  const { closures } = useClosedMonths();
  const closure = closureFor(closures, month);
  const label = formatMonth(month);
  const close = useCloseLaborMonth(projectId);
  const reopen = useReopenLaborMonth(projectId);
  const [confirmingClose, setConfirmingClose] = useState(false);
  const [confirmingReopen, setConfirmingReopen] = useState(false);
  const [showEdits, setShowEdits] = useState(false);
  // The month's days, for "waiting for validation"; fetched once the checklist opens.
  const range = monthRange(month);
  const entries = useLaborEntries(
    projectId,
    range.from,
    range.to,
    confirmingClose,
  );

  if (!closure) {
    if (!canManage) return null;
    const checklist = closeChecklist({
      month,
      entries: entries.data ?? [],
      payments,
      owed,
    });
    const lines = [
      ...(checklist.pendingDays > 0
        ? [
            t("labor.closure.checkPending", {
              count: checklist.pendingDays,
            }),
          ]
        : []),
      ...(checklist.unsettledPayments > 0
        ? [
            t("labor.closure.checkUnassigned", {
              count: checklist.unsettledPayments,
            }),
          ]
        : []),
      ...(checklist.owed > 0.005
        ? [
            t("labor.closure.checkOwed", {
              amount: formatMoney(checklist.owed),
            }),
          ]
        : []),
    ];
    const message = [
      t("labor.closure.closeIntro"),
      entries.isPending
        ? t("common.loading")
        : checklist.loose
          ? [
              ...lines.map((line) => `• ${line}`),
              t("labor.closure.checkWarning"),
            ].join("\n")
          : t("labor.closure.checkAllClear"),
    ].join("\n\n");
    return (
      <>
        <Button
          testID="labor-month-close"
          variant="secondary"
          size="sm"
          label={capitalizeFirst(
            t("labor.closure.closeButton", { month: label }),
          )}
          onPress={() => setConfirmingClose(true)}
        />
        <ConfirmDialog
          visible={confirmingClose}
          title={capitalizeFirst(
            t("labor.closure.closeTitle", { month: label }),
          )}
          message={message}
          confirmLabel={t("labor.closure.closeConfirm")}
          cancelLabel={t("common.cancel")}
          loading={close.isPending}
          onCancel={() => setConfirmingClose(false)}
          onConfirm={() =>
            close.mutate(
              { month },
              {
                onSuccess: () => {
                  setConfirmingClose(false);
                  showToast(
                    capitalizeFirst(
                      t("labor.closure.closedToast", { month: label }),
                    ),
                    "success",
                  );
                },
              },
            )
          }
        />
      </>
    );
  }

  const edited = closure.edited_after_close;
  const kindLabel = (edit: LaborMonthClosureEdit) =>
    t(
      `labor.closure.kinds.${KNOWN_KINDS.has(edit.kind) ? edit.kind : "other"}`,
    );
  return (
    <View className="gap-2" testID="labor-month-closed-panel">
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <View className="min-w-0 flex-1 flex-row items-center gap-1.5">
          <Icon name="lock" size={14} color={tokens.positive} />
          <Text
            testID="labor-month-closed"
            className="min-w-0 flex-1 font-sans-medium text-[12.5px] text-positive"
          >
            {capitalizeFirst(t("labor.closure.closedBadge", { month: label }))}
            {" · "}
            {t("labor.closure.closedBy", {
              name: closure.closed_by_name ?? t("labor.closure.unknownUser"),
              date: formatInstant(closure.closed_at),
            })}
          </Text>
        </View>
        {canManage ? (
          <Button
            testID="labor-month-reopen"
            variant="ghost"
            size="sm"
            label={t("labor.closure.reopen")}
            onPress={() => setConfirmingReopen(true)}
          />
        ) : null}
      </View>
      {edited > 0 ? (
        <View
          testID="labor-month-edited"
          className="gap-1.5 rounded-[12px] bg-warning-tint p-3"
        >
          <View className="flex-row items-start gap-2">
            <Icon name="alert-triangle" size={14} color={tokens.warning} />
            <Text className="min-w-0 flex-1 font-sans-medium text-[12.5px] leading-[17px] text-ink">
              {t("labor.closure.editedAfterClose", {
                count: edited,
                name:
                  closure.last_edited_by_name ?? t("labor.closure.unknownUser"),
                time: formatInstantDateTime(closure.last_edited_at),
              })}
            </Text>
          </View>
          <Pressable
            testID="labor-month-edits-toggle"
            accessibilityRole="button"
            accessibilityState={{ expanded: showEdits }}
            onPress={() => setShowEdits((v) => !v)}
            className="min-h-[32px] justify-center self-start active:opacity-70"
          >
            <Text className="font-sans-semibold text-[12.5px] text-accent-ink">
              {showEdits
                ? t("labor.closure.hideEdits")
                : t("labor.closure.showEdits")}
            </Text>
          </Pressable>
          {showEdits ? (
            <View testID="labor-month-edits" className="gap-1.5">
              {closure.edits.map((edit, i) => (
                <View key={`${edit.edited_at}-${i}`}>
                  <Text className="font-sans text-[12.5px] text-ink">
                    {[
                      kindLabel(edit),
                      edit.worker_name,
                      edit.entry_date ? formatDate(edit.entry_date) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                  <Text className="font-sans text-[11.5px] text-muted">
                    {edit.user_name ?? t("labor.closure.unknownUser")}
                    {edit.edited_at
                      ? `, ${formatInstantDateTime(edit.edited_at)}`
                      : ""}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
      <ConfirmDialog
        visible={confirmingReopen}
        title={capitalizeFirst(
          t("labor.closure.reopenTitle", { month: label }),
        )}
        message={t("labor.closure.reopenMessage")}
        confirmLabel={t("labor.closure.reopen")}
        cancelLabel={t("common.cancel")}
        loading={reopen.isPending}
        onCancel={() => setConfirmingReopen(false)}
        onConfirm={() =>
          reopen.mutate(
            { month },
            {
              onSuccess: () => {
                setConfirmingReopen(false);
                showToast(
                  capitalizeFirst(
                    t("labor.closure.reopenedToast", { month: label }),
                  ),
                  "success",
                );
              },
            },
          )
        }
      />
    </View>
  );
}
