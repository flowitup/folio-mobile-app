import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Badge,
  Card,
  Checkbox,
  EmptyState,
  ErrorState,
} from "@/components/ui/primitives";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import { showToast } from "@/components/ui/toast";
import {
  useRefundableCandidates,
  useRefundableExpenses,
  useSetRefundable,
} from "@/features/billing/refundable-api";
import {
  useBillingAccess,
  useMyCompanies,
} from "@/features/companies/companies-api";
import type {
  RefundableExpense,
  RefundableStatus,
  RefundedBy,
} from "@/features/invoices/invoice-types";
import { formatDate } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";
import { useRefetchOnFocus } from "@/lib/query/use-refetch-on-focus";

const STATUSES: RefundableStatus[] = [
  "refundable",
  "refund_pending",
  "refunded",
];
const REFUNDED_BY: RefundedBy[] = ["company", "bank", "both"];
/** Keeps the focus hook's dependency stable while the caller has no access to the list. */
const NOOP_REFETCH = () => {};

const STATUS_TONE = {
  refundable: "warning",
  refund_pending: "neutral",
  refunded: "success",
} as const;

/** Company-wide materials & services expenses tracked for reimbursement (web refundable-invoices page). */
export default function RefundableExpensesScreen() {
  const { t } = useTranslation();
  // The whole screen rides the company-scoped billing API, which only a company admin may
  // call: without the gate a refused caller just watched a spinner turn into a blank page.
  const access = useBillingAccess();
  const companies = useMyCompanies();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const expenses = useRefundableExpenses(companyId, access.allowed);
  // `refetch()` runs even a disabled query, so the focus hook has to respect the gate too.
  useRefetchOnFocus(access.allowed ? expenses.refetch : NOOP_REFETCH);
  const setRefundable = useSetRefundable();
  // The bulk "add" loop reports once for the batch, so its writes stay quiet.
  const bulkSetRefundable = useSetRefundable(true);
  const [pendingRefunded, setPendingRefunded] =
    useState<RefundableExpense | null>(null);
  const [removing, setRemoving] = useState<RefundableExpense | null>(null);

  const refundedBySheet = useRef<BottomSheetModal>(null);
  const addSheet = useRef<BottomSheetModal>(null);
  const [addOpen, setAddOpen] = useState(false);
  const candidates = useRefundableCandidates(
    companyId,
    addOpen && access.allowed,
  );
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);

  const filteredCandidates = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const all = candidates.data?.items ?? [];
    return needle
      ? all.filter((x) =>
          [x.project_name, x.invoice_number, x.recipient_name]
            .join(" ")
            .toLowerCase()
            .includes(needle),
        )
      : all;
  }, [candidates.data, search]);

  function changeStatus(expense: RefundableExpense, status: RefundableStatus) {
    if (status === expense.refundable_status) return;
    if (status === "refunded") {
      setPendingRefunded(expense);
      refundedBySheet.current?.present();
      return;
    }
    setRefundable.mutate({ invoiceId: expense.id, status });
  }

  /**
   * One toast for the batch, not one per expense, and the sheet always ends up in a state
   * that matches what happened: it stays open with the selection intact when nothing was
   * added, so the user can retry, and closes once at least one went through.
   */
  async function addSelected() {
    setAdding(true);
    const results = await Promise.allSettled(
      [...selected].map((id) =>
        bulkSetRefundable.mutateAsync({ invoiceId: id, status: "refundable" }),
      ),
    );
    setAdding(false);
    const added = results.filter((r) => r.status === "fulfilled").length;
    if (added === 0)
      return showToast(t("billing.refundable.dialog.addFailed"), "error");
    if (added < results.length)
      showToast(t("billing.refundable.dialog.partial"), "error");
    else
      showToast(
        t("billing.refundable.dialog.added", { count: added }),
        "success",
      );
    setSelected(new Set());
    addSheet.current?.dismiss();
  }

  const summary = expenses.data?.summary;

  if (access.loading)
    return (
      <View className="flex-1 bg-paper">
        <ScreenHeader title={t("billing.refundable.title")} back />
        <ActivityIndicator className="mt-8" />
      </View>
    );
  if (!access.allowed)
    return (
      <View className="flex-1 bg-paper">
        <ScreenHeader title={t("billing.refundable.title")} back />
        <EmptyState message={t("billing.accessDenied")} />
      </View>
    );

  return (
    <View className="flex-1 bg-paper">
      <ScreenHeader
        title={t("billing.refundable.title")}
        back
        right={
          <Button
            testID="refundable-add"
            label={`＋ ${t("billing.refundable.add")}`}
            size="sm"
            onPress={() => {
              setAddOpen(true);
              addSheet.current?.present();
            }}
          />
        }
      />
      <ScrollView contentContainerClassName="p-4 pb-12">
        {(companies.data?.length ?? 0) > 1 ? (
          <Select
            testID="refundable-company"
            value={companyId ?? "__all__"}
            options={[
              { value: "__all__", label: t("billing.refundable.allCompanies") },
              ...(companies.data ?? []).map((c) => ({
                value: c.id,
                label: c.legal_name,
              })),
            ]}
            onChange={(v) => setCompanyId(v === "__all__" ? null : v)}
          />
        ) : null}
        {summary ? (
          <View className="mb-3 flex-row flex-wrap gap-2">
            {(
              [
                ["refundedTotal", summary.refunded_total],
                ["refundedByCompany", summary.refunded_by_company],
                ["refundedByBank", summary.refunded_by_bank],
                ["toRefund", summary.refundable_amount],
              ] as const
            ).map(([key, value]) => (
              <Card key={key} className="min-w-[45%] flex-1">
                <Text className="text-xs text-muted-foreground">
                  {t(`billing.refundable.summary.${key}`)}
                </Text>
                <Text
                  testID={`summary-${key}`}
                  className="text-base font-semibold text-primary"
                >
                  {formatMoney(value)}
                </Text>
              </Card>
            ))}
          </View>
        ) : null}
        {expenses.isPending ? <ActivityIndicator className="mt-8" /> : null}
        {expenses.isError && !expenses.data ? (
          <ErrorState
            message={t("home.loadError")}
            retryLabel={t("common.retry")}
            onRetry={() => void expenses.refetch()}
          />
        ) : null}
        {expenses.data && expenses.data.items.length === 0 ? (
          <EmptyState message={t("billing.refundable.none")} />
        ) : null}
        {(expenses.data?.items ?? []).map((expense) => (
          <Card key={expense.id} className="mb-2">
            <View className="flex-row items-center justify-between">
              <Text
                className="flex-1 pr-2 text-base font-medium text-primary"
                numberOfLines={1}
              >
                {expense.invoice_number} · {expense.recipient_name}
              </Text>
              {expense.refundable_status ? (
                <Badge
                  label={t(
                    `billing.refundable.status.${expense.refundable_status}`,
                  )}
                  tone={STATUS_TONE[expense.refundable_status]}
                />
              ) : null}
            </View>
            <Text className="text-xs text-muted-foreground">
              {expense.project_name} · {formatDate(expense.issue_date)} ·{" "}
              {formatMoney(expense.total_amount)}
              {expense.refunded_by
                ? ` · ${t(`billing.refundable.refundedBy.${expense.refunded_by}`)}`
                : ""}
              {expense.funds_release_number
                ? ` · ${t("billing.refundable.fundsRelease", { number: expense.funds_release_number })}`
                : ""}
              {" · "}
              {expense.attachments.length > 0
                ? t("billing.refundable.attachments", {
                    count: expense.attachments.length,
                  })
                : t("billing.refundable.noAttachments")}
            </Text>
            <View className="mt-2 flex-row items-end gap-3">
              <View className="flex-1">
                <Select<RefundableStatus>
                  testID={`refundable-status-${expense.id}`}
                  value={expense.refundable_status}
                  options={STATUSES.map((value) => ({
                    value,
                    label: t(`billing.refundable.status.${value}`),
                  }))}
                  onChange={(status) => changeStatus(expense, status)}
                />
              </View>
              <Button
                testID={`refundable-remove-${expense.id}`}
                label={t("billing.refundable.remove")}
                size="sm"
                variant="secondary"
                className="mb-4"
                onPress={() => setRemoving(expense)}
              />
            </View>
          </Card>
        ))}
      </ScrollView>

      <Sheet
        ref={addSheet}
        title={t("billing.refundable.dialog.title")}
        snapPoints={["85%"]}
      >
        <View className="p-4">
          <TextInput
            testID="refundable-search"
            className="mb-3 rounded-lg border border-border px-4 py-2 text-base text-primary"
            placeholder={t("billing.refundable.dialog.search")}
            placeholderTextColor="#a3a3a3"
            value={search}
            onChangeText={setSearch}
          />
          {candidates.isPending && addOpen ? <ActivityIndicator /> : null}
          {candidates.data && filteredCandidates.length === 0 ? (
            <EmptyState message={t("billing.refundable.dialog.none")} />
          ) : null}
          {filteredCandidates.map((expense) => (
            <Checkbox
              key={expense.id}
              testID={`candidate-${expense.id}`}
              label={`${expense.invoice_number} · ${expense.recipient_name} · ${formatMoney(expense.total_amount)} · ${expense.project_name}`}
              value={selected.has(expense.id)}
              onChange={(next) =>
                setSelected((prev) => {
                  const copy = new Set(prev);
                  if (next) copy.add(expense.id);
                  else copy.delete(expense.id);
                  return copy;
                })
              }
            />
          ))}
          <Button
            testID="refundable-confirm"
            label={t("billing.refundable.dialog.confirm", {
              count: selected.size,
            })}
            disabled={selected.size === 0}
            loading={adding}
            onPress={() => void addSelected()}
          />
        </View>
      </Sheet>

      <Sheet
        ref={refundedBySheet}
        title={t("billing.refundable.refundedByTitle")}
        snapPoints={["40%"]}
      >
        <View className="gap-2 p-4">
          {REFUNDED_BY.map((by) => (
            <Button
              key={by}
              testID={`refunded-by-${by}`}
              label={t(`billing.refundable.refundedBy.${by}`)}
              variant={by === "company" ? "primary" : "secondary"}
              loading={setRefundable.isPending}
              onPress={() =>
                pendingRefunded &&
                setRefundable.mutate(
                  {
                    invoiceId: pendingRefunded.id,
                    status: "refunded",
                    refundedBy: by,
                  },
                  {
                    onSettled: () => {
                      setPendingRefunded(null);
                      refundedBySheet.current?.dismiss();
                    },
                  },
                )
              }
            />
          ))}
        </View>
      </Sheet>
      <ConfirmDialog
        visible={removing !== null}
        title={t("billing.refundable.removeConfirm", {
          number: removing?.invoice_number ?? "",
        })}
        confirmLabel={t("billing.refundable.remove")}
        cancelLabel={t("common.cancel")}
        destructive
        loading={setRefundable.isPending}
        onCancel={() => setRemoving(null)}
        onConfirm={() =>
          removing &&
          setRefundable.mutate(
            { invoiceId: removing.id, status: null },
            { onSettled: () => setRemoving(null) },
          )
        }
      />
    </View>
  );
}
