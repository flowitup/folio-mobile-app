import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useLocalSearchParams } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { useAuth } from "@/auth/auth-context";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Badge, Card, EmptyState } from "@/components/ui/primitives";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import { showToast } from "@/components/ui/toast";
import {
  useCreateInvoice,
  useDeleteInvoice,
  useInvoices,
  usePaymentMethods,
} from "@/features/invoices/invoices-api";
import { useLaborMonthlySummary, useWorkers } from "@/features/labor/labor-api";
import { projectCan, useProject } from "@/features/projects/projects-api";
import { formatDate, formatMonth } from "@/lib/format/date";
import { formatMoney, parseMoneyInput } from "@/lib/format/money";
import {
  buildWorkerSalaryMonths,
  salaryTotals,
} from "@/lib/labor/worker-salary-months";
import type { SalaryMonth } from "@/lib/labor/worker-salary-months";
import { useRefetchOnFocus } from "@/lib/query/use-refetch-on-focus";

const STATUS_TONE = {
  paid: "success",
  partial: "warning",
  unpaid: "danger",
  overpaid: "warning",
  none: "neutral",
} as const;

/**
 * Salaries: one worker at a time, every month with work or a payment, earned vs paid, and
 * (admin / manager) mark a month paid — records a labor payment — or unpaid — removes them.
 */
export default function ProjectSalariesSection() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const project = useProject(id);
  const workers = useWorkers(id);
  const [workerId, setWorkerId] = useState<string | null>(null);
  const worker =
    (workers.data ?? []).find((w) => w.id === workerId) ??
    (workers.data ?? []).find((w) => w.is_active) ??
    workers.data?.[0];
  const monthly = useLaborMonthlySummary(id);
  const laborInvoices = useInvoices(id, {
    type: "labor",
    workerId: worker?.id ?? null,
  });
  const paymentMethods = usePaymentMethods(project.data?.company_id);
  const createInvoice = useCreateInvoice(id);
  const deleteInvoice = useDeleteInvoice(id);
  useRefetchOnFocus(monthly.refetch);
  useRefetchOnFocus(laborInvoices.refetch);
  const canManage = projectCan(
    project.data,
    "project:manage_invoices",
    user?.permissions,
  );

  const months = useMemo(
    () =>
      worker
        ? buildWorkerSalaryMonths(
            monthly.data?.rows ?? [],
            laborInvoices.data?.invoices ?? [],
            worker.id,
          )
        : [],
    [monthly.data, laborInvoices.data, worker],
  );
  const totals = salaryTotals(months);

  const paySheet = useRef<BottomSheetModal>(null);
  const [paying, setPaying] = useState<SalaryMonth | null>(null);
  const [amount, setAmount] = useState("");
  const [methodId, setMethodId] = useState<string | null>(null);
  const [unpaying, setUnpaying] = useState<SalaryMonth | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  function openPay(row: SalaryMonth) {
    setPaying(row);
    setAmount(String(Math.max(row.remaining, 0) || row.earned));
    paySheet.current?.present();
  }

  function markPaid() {
    const value = parseMoneyInput(amount);
    if (!paying || !worker || !value || value <= 0)
      return showToast(t("labor.payments.amountRequired"), "error");
    createInvoice.mutate(
      {
        type: "labor",
        issue_date: new Date().toISOString().slice(0, 10),
        recipient_name: worker.name,
        items: [
          {
            description: t("labor.payments.itemDescription", {
              month: formatMonth(paying.month),
            }),
            quantity: 1,
            unit_price: value,
            vat_rate: 0,
          },
        ],
        payment_method_id: methodId,
        service_month: `${paying.month}-01`,
        worker_id: worker.id,
      },
      {
        onSuccess: () => {
          paySheet.current?.dismiss();
          showToast(t("salaries.paidToast"), "success");
        },
      },
    );
  }

  async function markUnpaid(row: SalaryMonth) {
    const results = await Promise.allSettled(
      row.invoices.map((inv) =>
        deleteInvoice.mutateAsync({ invoiceId: inv.id }),
      ),
    );
    setUnpaying(null);
    if (results.every((r) => r.status === "fulfilled"))
      showToast(t("salaries.unpaidToast"), "success");
  }

  const loading =
    workers.isPending ||
    monthly.isPending ||
    (worker && laborInvoices.isPending);

  return (
    <View className="flex-1 bg-card">
      <ScrollView contentContainerClassName="p-4 pb-12">
        {workers.data && workers.data.length === 0 ? (
          <EmptyState message={t("salaries.noWorkers")} />
        ) : null}
        {(workers.data?.length ?? 0) > 0 ? (
          <Select
            testID="salaries-worker"
            label={t("salaries.worker")}
            value={worker?.id ?? null}
            options={(workers.data ?? []).map((w) => ({
              value: w.id,
              label: w.is_active
                ? w.name
                : `${w.name} (${t("labor.workers.inactive", { defaultValue: "inactive" })})`,
            }))}
            onChange={setWorkerId}
          />
        ) : null}
        {loading ? <ActivityIndicator className="mt-4" /> : null}
        {worker && !loading ? (
          <Card className="mb-3">
            <View className="flex-row justify-between">
              <Text className="text-sm text-muted-foreground">
                {t("salaries.totalEarned")}
              </Text>
              <Text className="text-sm text-primary">
                {formatMoney(totals.earned)}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-sm text-muted-foreground">
                {t("salaries.totalPaid")}
              </Text>
              <Text className="text-sm text-primary">
                {formatMoney(totals.paid)}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-base font-semibold text-primary">
                {t("salaries.outstanding")}
              </Text>
              <Text
                testID="salaries-outstanding"
                className={`text-base font-semibold ${totals.remaining > 0 ? "text-danger" : "text-primary"}`}
              >
                {formatMoney(totals.remaining)}
              </Text>
            </View>
            {!canManage ? (
              <Text className="mt-2 text-xs text-muted-foreground">
                {t("salaries.readOnly")}
              </Text>
            ) : null}
          </Card>
        ) : null}
        {worker && !loading && months.length === 0 ? (
          <EmptyState message={t("salaries.noMonths")} />
        ) : null}
        {months.map((row) => (
          <Card key={row.month} className="mb-2">
            <Pressable
              testID={`salary-month-${row.month}`}
              onPress={() =>
                setExpanded(expanded === row.month ? null : row.month)
              }
            >
              <View className="flex-row items-center justify-between">
                <Text className="text-base font-semibold capitalize text-primary">
                  {formatMonth(row.month)}
                </Text>
                <Badge
                  label={t(`salaries.status.${row.status}`)}
                  tone={STATUS_TONE[row.status]}
                />
              </View>
              <Text className="text-xs text-muted-foreground">
                {t("salaries.days", { count: row.days })} ·{" "}
                {t("salaries.earned")} {formatMoney(row.earned)} ·{" "}
                {t("salaries.paid")} {formatMoney(row.paid)}
                {row.remaining !== 0
                  ? ` · ${t("salaries.remaining")} ${formatMoney(row.remaining)}`
                  : ""}
              </Text>
            </Pressable>
            {expanded === row.month && row.invoices.length > 0 ? (
              <View className="mt-2 border-t border-border pt-2">
                <Text className="text-xs text-muted-foreground">
                  {t("salaries.payments")}
                </Text>
                {row.invoices.map((inv) => (
                  <Text key={inv.id} className="text-xs text-primary">
                    {inv.invoice_number} · {formatDate(inv.issue_date)} ·{" "}
                    {formatMoney(inv.total_amount)}
                  </Text>
                ))}
              </View>
            ) : null}
            {canManage ? (
              <View className="mt-2 flex-row gap-2">
                {row.status !== "paid" &&
                row.status !== "overpaid" &&
                row.earned > 0 ? (
                  <Button
                    testID={`salary-pay-${row.month}`}
                    label={t("salaries.markPaid")}
                    size="sm"
                    onPress={() => openPay(row)}
                  />
                ) : null}
                {row.paid > 0 ? (
                  <Button
                    testID={`salary-unpay-${row.month}`}
                    label={t("salaries.markUnpaid")}
                    size="sm"
                    variant="secondary"
                    onPress={() => setUnpaying(row)}
                  />
                ) : null}
              </View>
            ) : null}
          </Card>
        ))}
      </ScrollView>

      <Sheet
        ref={paySheet}
        title={
          paying
            ? t("salaries.markPaidTitle", { month: formatMonth(paying.month) })
            : ""
        }
        snapPoints={["55%"]}
      >
        <View className="p-4">
          <Input
            testID="salary-amount"
            label={t("salaries.amount")}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
          />
          <Select
            testID="salary-method"
            label={t("salaries.paymentMethod")}
            value={methodId ?? "__none__"}
            options={[
              { value: "__none__", label: t("salaries.noPaymentMethod") },
              ...(paymentMethods.data ?? [])
                .filter((m) => m.is_active)
                .map((m) => ({ value: m.id, label: m.label })),
            ]}
            onChange={(v) => setMethodId(v === "__none__" ? null : v)}
          />
          <Button
            testID="salary-pay-submit"
            label={t("salaries.markPaid")}
            loading={createInvoice.isPending}
            onPress={markPaid}
          />
        </View>
      </Sheet>
      <ConfirmDialog
        visible={unpaying !== null}
        title={t("salaries.unpaidConfirm", {
          count: unpaying?.invoices.length ?? 0,
          month: unpaying ? formatMonth(unpaying.month) : "",
        })}
        confirmLabel={t("salaries.markUnpaid")}
        cancelLabel={t("common.cancel")}
        destructive
        loading={deleteInvoice.isPending}
        onCancel={() => setUnpaying(null)}
        onConfirm={() => unpaying && void markUnpaid(unpaying)}
      />
    </View>
  );
}
