import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { forwardRef, useEffect, useState } from "react";
import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { MonthPicker } from "@/components/ui/month-picker";
import { Card } from "@/components/ui/primitives";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import { showToast } from "@/components/ui/toast";
import { Eyebrow } from "@/components/ui/typography";
import type { InvoiceExportFormat } from "@/features/invoices/invoice-types";
import {
  useCreateInvoice,
  usePaymentMethods,
} from "@/features/invoices/invoices-api";
import {
  useCreateActivity,
  useDeleteActivity,
  useSetDayDescription,
  useSetDayTag,
} from "@/features/labor/labor-api";
import type { PaymentRow } from "@/features/labor/labor-panels";
import type {
  LaborActivity,
  LaborEntry,
  Worker,
} from "@/features/labor/labor-types";
import type { Tag } from "@/features/projects/tags-api";
import { currentMonth, formatMonth } from "@/lib/format/date";
import { formatMoney, parseMoneyInput } from "@/lib/format/money";
import { useTokens } from "@/theme/tokens";

type ModalRef = RefObject<BottomSheetModal | null>;

/** Worker card tap: Sửa · Đơn giá · Gỡ. */
export const WorkerActionsSheet = forwardRef<
  BottomSheetModal,
  {
    worker: Worker | null;
    onEdit: (worker: Worker) => void;
    onRates: (worker: Worker) => void;
    onDelete: (worker: Worker) => void;
  }
>(function WorkerActionsSheet({ worker, onEdit, onRates, onDelete }, ref) {
  const { t } = useTranslation();
  const tokens = useTokens();
  const close = () => (ref as ModalRef).current?.dismiss();
  const rows: {
    key: string;
    label: string;
    icon: "edit-3" | "sliders" | "trash-2";
    danger?: boolean;
    run: (w: Worker) => void;
  }[] = [
    { key: "edit", label: t("common.edit"), icon: "edit-3", run: onEdit },
    {
      key: "rates",
      label: t("labor.rates.link"),
      icon: "sliders",
      run: onRates,
    },
    {
      key: "delete",
      label: t("common.delete"),
      icon: "trash-2",
      danger: true,
      run: onDelete,
    },
  ];
  return (
    <Sheet ref={ref} title={worker?.name} snapPoints={["35%"]}>
      {rows.map((row) => (
        <Pressable
          key={row.key}
          testID={`worker-${row.key}-${worker?.id ?? ""}`}
          accessibilityRole="button"
          onPress={() => {
            close();
            if (worker) row.run(worker);
          }}
          className="flex-row items-center gap-3 border-b border-line px-4 py-3.5 active:opacity-70"
        >
          <Icon
            name={row.icon}
            size={18}
            color={row.danger ? tokens.negative : tokens.ink}
          />
          <Text
            className={`font-sans text-base ${row.danger ? "text-negative" : "text-ink"}`}
          >
            {row.label}
          </Text>
        </Pressable>
      ))}
    </Sheet>
  );
});

/** Day details behind the day card: activities, day description, day tag (the former day sheet). */
export const DayDetailsSheet = forwardRef<
  BottomSheetModal,
  {
    projectId: string;
    date: string;
    entries: LaborEntry[];
    activities: LaborActivity[];
    description: string;
    tags: Tag[];
  }
>(function DayDetailsSheet(
  { projectId, date, entries, activities, description, tags },
  ref,
) {
  const { t } = useTranslation();
  const createActivity = useCreateActivity(projectId);
  const deleteActivity = useDeleteActivity(projectId);
  const setDayDescription = useSetDayDescription(projectId);
  const setDayTag = useSetDayTag(projectId);
  const [activityTitle, setActivityTitle] = useState("");
  const [draft, setDraft] = useState(description);
  // A new day (or a fresh server value) resets the description draft.
  useEffect(() => {
    setDraft(description);
    setActivityTitle("");
  }, [description, date]);

  const addActivity = () =>
    activityTitle.trim() &&
    createActivity.mutate(
      { date, title: activityTitle.trim() },
      { onSuccess: () => setActivityTitle("") },
    );

  return (
    <Sheet ref={ref} title={t("labor.calendar.details")} snapPoints={["75%"]}>
      <View className="p-4">
        {entries.length > 0 && tags.length > 0 ? (
          <Select
            testID="day-tag"
            label={t("labor.log.dayTag")}
            placeholder={t("invoices.form.tagNone")}
            value={entries[0]?.tag_id ?? null}
            options={tags.map((tag) => ({ value: tag.id, label: tag.name }))}
            onChange={(tagId) => setDayTag.mutate({ date, tagId })}
          />
        ) : null}
        <Eyebrow className="mb-1.5">{t("labor.activities.title")}</Eyebrow>
        {activities.map((activity) => (
          <Card
            key={activity.id}
            className="mb-2 flex-row items-center justify-between px-3.5 py-2.5"
          >
            <Text className="flex-1 font-sans text-sm text-ink">
              {activity.title}
            </Text>
            <Pressable
              testID={`activity-delete-${activity.id}`}
              onPress={() => deleteActivity.mutate({ activityId: activity.id })}
              hitSlop={8}
            >
              <Text className="font-sans text-sm text-negative">
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
          onSubmitEditing={addActivity}
        />
        <Button
          testID="activity-add"
          label={t("labor.activities.add")}
          variant="secondary"
          size="sm"
          className="mb-4"
          disabled={!activityTitle.trim()}
          onPress={addActivity}
        />
        <Input
          testID="day-description"
          label={t("labor.description.title")}
          value={draft}
          onChangeText={setDraft}
          multiline
        />
        <Button
          testID="day-description-save"
          label={t("common.save")}
          variant="secondary"
          size="sm"
          loading={setDayDescription.isPending}
          disabled={draft === description}
          onPress={() =>
            setDayDescription.mutate({ date, description: draft.trim() })
          }
        />
      </View>
    </Sheet>
  );
});

/** "Ghi thanh toán": worker (pre-selected), amount pre-filled with the balance, payment method. */
export const PaymentSheet = forwardRef<
  BottomSheetModal,
  {
    projectId: string;
    companyId: string | null;
    month: string;
    rows: PaymentRow[];
    initial: PaymentRow | null;
  }
>(function PaymentSheet({ projectId, companyId, month, rows, initial }, ref) {
  const { t } = useTranslation();
  const paymentMethods = usePaymentMethods(companyId ?? undefined);
  const createInvoice = useCreateInvoice(projectId);
  const [workerId, setWorkerId] = useState<string | null>(
    initial?.worker.id ?? null,
  );
  const [amount, setAmount] = useState("");
  const [methodId, setMethodId] = useState<string | null>(null);
  useEffect(() => {
    setWorkerId(initial?.worker.id ?? null);
    setAmount(initial ? String(Math.max(0, initial.owed - initial.paid)) : "");
  }, [initial]);
  const row = rows.find((r) => r.worker.id === workerId) ?? null;

  function record() {
    const value = parseMoneyInput(amount);
    if (!row || !value || value <= 0)
      return showToast(t("labor.payments.amountRequired"), "error");
    createInvoice.mutate(
      {
        type: "labor",
        issue_date: new Date().toISOString().slice(0, 10),
        recipient_name: row.worker.name,
        items: [
          {
            description: t("labor.payments.itemDescription", {
              month: formatMonth(month),
            }),
            quantity: 1,
            unit_price: value,
            vat_rate: 0,
          },
        ],
        payment_method_id: methodId,
        service_month: `${month}-01`,
        worker_id: row.worker.id,
      },
      {
        onSuccess: () => {
          (ref as ModalRef).current?.dismiss();
          setAmount("");
        },
      },
    );
  }

  return (
    <Sheet
      ref={ref}
      title={t("labor.payments.recordTitle", { name: row?.worker.name ?? "" })}
      snapPoints={["60%"]}
    >
      <View className="p-4">
        <Select
          testID="payment-worker"
          label={t("labor.export.worker")}
          value={workerId}
          options={rows.map((r) => ({
            value: r.worker.id,
            label: r.worker.name,
            description: `${t("labor.payments.dueShort")} ${formatMoney(Math.max(0, r.owed - r.paid))}`,
          }))}
          onChange={(next) => {
            setWorkerId(next);
            const target = rows.find((r) => r.worker.id === next);
            if (target)
              setAmount(String(Math.max(0, target.owed - target.paid)));
          }}
        />
        <Input
          testID="payment-amount"
          label={t("labor.payments.amount")}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
        />
        {companyId ? (
          <Select
            testID="payment-method"
            label={t("invoices.form.paymentMethod")}
            placeholder={t("invoices.form.paymentMethodNone")}
            value={methodId}
            options={(paymentMethods.data ?? [])
              .filter((m) => m.is_active)
              .map((m) => ({ value: m.id, label: m.label }))}
            onChange={setMethodId}
          />
        ) : null}
        <Button
          testID="payment-submit"
          label={t("labor.payments.record")}
          loading={createInvoice.isPending}
          onPress={record}
        />
      </View>
    </Sheet>
  );
});

/** Labor export: format, month range, worker filter. */
export const LaborExportSheet = forwardRef<
  BottomSheetModal,
  {
    projectId: string;
    workers: Worker[];
    onExport: (
      projectId: string,
      format: InvoiceExportFormat,
      from: string,
      to: string,
      workerId: string | null,
    ) => Promise<unknown>;
  }
>(function LaborExportSheet({ projectId, workers, onExport }, ref) {
  const { t } = useTranslation();
  const [format, setFormat] = useState<InvoiceExportFormat>("xlsx");
  const [from, setFrom] = useState(currentMonth());
  const [to, setTo] = useState(currentMonth());
  const [workerId, setWorkerId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  async function run() {
    setExporting(true);
    try {
      await onExport(projectId, format, from, to, workerId);
      (ref as ModalRef).current?.dismiss();
    } catch (caught) {
      showToast((caught as Error).message, "error");
    } finally {
      setExporting(false);
    }
  }

  return (
    <Sheet ref={ref} title={t("labor.export.title")} snapPoints={["75%"]}>
      <View className="p-4">
        <Select<InvoiceExportFormat>
          testID="labor-export-format"
          label={t("invoices.export.format")}
          value={format}
          options={[
            { value: "xlsx", label: "Excel (.xlsx)" },
            { value: "pdf", label: "PDF" },
          ]}
          onChange={setFormat}
        />
        <Eyebrow className="mb-1.5">{t("invoices.export.from")}</Eyebrow>
        <MonthPicker
          testID="labor-export-from"
          value={from}
          onChange={setFrom}
        />
        <Eyebrow className="mb-1.5">{t("invoices.export.to")}</Eyebrow>
        <MonthPicker testID="labor-export-to" value={to} onChange={setTo} />
        <Select
          testID="labor-export-worker"
          label={t("labor.export.worker")}
          value={workerId ?? "__all__"}
          options={[
            { value: "__all__", label: t("labor.export.allWorkers") },
            ...workers.map((w) => ({ value: w.id, label: w.name })),
          ]}
          onChange={(value) => setWorkerId(value === "__all__" ? null : value)}
        />
        <Button
          testID="labor-export-run"
          label={t("invoices.export.run")}
          loading={exporting}
          onPress={() => void run()}
        />
      </View>
    </Sheet>
  );
});
