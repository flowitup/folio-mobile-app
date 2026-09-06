import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { MonthPicker } from "@/components/ui/month-picker";
import { Card } from "@/components/ui/primitives";
import { Select } from "@/components/ui/select";
import { currentMonth, toIsoDate } from "@/lib/format/date";
import { formatMoney, parseMoneyInput } from "@/lib/format/money";
import { HIGHLIGHT_COLORS, invoiceTotals } from "@/lib/invoices/invoice-totals";

import type {
  CreateInvoicePayload,
  HighlightColor,
  Invoice,
  InvoiceType,
  SettledVia,
} from "./invoice-types";
import { useInvoices, usePaymentMethods, useWorkers } from "./invoices-api";

export const INVOICE_TYPES: InvoiceType[] = [
  "released_funds",
  "labor",
  "materials_services",
  "others",
  "return",
];

type LineDraft = {
  description: string;
  quantity: string;
  unit_price: string;
  vat_rate: string;
};

const emptyLine = (): LineDraft => ({
  description: "",
  quantity: "1",
  unit_price: "",
  vat_rate: "0",
});

function toLineDrafts(invoice?: Invoice): LineDraft[] {
  if (!invoice || invoice.items.length === 0) return [emptyLine()];
  return invoice.items.map((item) => ({
    description: item.description,
    quantity: String(item.quantity),
    unit_price: String(item.unit_price),
    vat_rate: String(item.vat_rate ?? 0),
  }));
}

type Props = {
  projectId: string;
  companyId: string | null | undefined;
  initial?: Invoice;
  submitting: boolean;
  onSubmit: (payload: CreateInvoicePayload) => void;
};

/**
 * Create / edit invoice form — same fields and rules as the web `invoice-form.tsx`:
 * TTC totals, labor → worker + service month, return → linked M&S invoice, settled_via, applied-to (avoir).
 */
export function InvoiceForm({
  projectId,
  companyId,
  initial,
  submitting,
  onSubmit,
}: Props) {
  const { t } = useTranslation();
  const editing = Boolean(initial);

  const [type, setType] = useState<InvoiceType>(
    initial?.type ?? "materials_services",
  );
  const [issueDate, setIssueDate] = useState<string | null>(
    initial?.issue_date ?? toIsoDate(new Date()),
  );
  const [recipientName, setRecipientName] = useState(
    initial?.recipient_name ?? "",
  );
  const [recipientAddress, setRecipientAddress] = useState(
    initial?.recipient_address ?? "",
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(
    initial?.payment_method_id ?? null,
  );
  const [serviceMonth, setServiceMonth] = useState<string>(
    initial?.service_month?.slice(0, 7) ?? currentMonth(),
  );
  const [workerId, setWorkerId] = useState<string | null>(
    initial?.worker_id ?? null,
  );
  const [refundsInvoiceId, setRefundsInvoiceId] = useState<string | null>(
    initial?.refunds_invoice_id ?? null,
  );
  const [settledVia, setSettledVia] = useState<SettledVia | null>(
    initial?.settled_via ?? null,
  );
  const [appliedToInvoiceId, setAppliedToInvoiceId] = useState<string | null>(
    initial?.applied_to_invoice_id ?? null,
  );
  const [highlight, setHighlight] = useState<HighlightColor | null>(
    initial?.highlight_color ?? null,
  );
  const [lines, setLines] = useState<LineDraft[]>(() => toLineDrafts(initial));
  const [error, setError] = useState<string | null>(null);

  const paymentMethods = usePaymentMethods(companyId);
  const workers = useWorkers(projectId);
  // Return links: refunds an M&S invoice; an avoir can be applied to any non-return, non-release invoice.
  const materialsInvoices = useInvoices(projectId, {
    type: "materials_services",
  });
  const allInvoices = useInvoices(projectId);

  const numericLines = useMemo(
    () =>
      lines.map((line) => ({
        description: line.description.trim(),
        quantity: parseMoneyInput(line.quantity) ?? 0,
        unit_price: parseMoneyInput(line.unit_price) ?? 0,
        vat_rate: parseMoneyInput(line.vat_rate) ?? 0,
      })),
    [lines],
  );
  const totals = invoiceTotals(numericLines);

  const selectedWorker = workers.data?.find((worker) => worker.id === workerId);
  const laborWithWorker = type === "labor" && Boolean(workerId);

  function updateLine(index: number, patch: Partial<LineDraft>) {
    setLines((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  }

  function submit() {
    if (!issueDate) return setError(t("invoices.form.issueDateRequired"));
    const recipient =
      laborWithWorker && !recipientName.trim()
        ? (selectedWorker?.name ?? "")
        : recipientName.trim();
    if (!recipient) return setError(t("invoices.form.recipientRequired"));
    if (type === "labor" && !editing && !serviceMonth)
      return setError(t("invoices.form.serviceMonthRequired"));
    const items = numericLines.filter((line) => line.description);
    if (items.length === 0) return setError(t("invoices.form.itemsRequired"));
    setError(null);

    const payload: CreateInvoicePayload = {
      type,
      issue_date: issueDate,
      recipient_name: recipient,
      recipient_address: recipientAddress.trim() || undefined,
      notes: notes.trim() || undefined,
      items,
      payment_method_id: paymentMethodId,
      highlight_color: highlight,
      ...(type === "return"
        ? {
            refunds_invoice_id: refundsInvoiceId,
            settled_via: settledVia,
            applied_to_invoice_id:
              settledVia === "avoir" ? appliedToInvoiceId : null,
          }
        : {}),
      ...(type === "labor"
        ? { worker_id: workerId, service_month: `${serviceMonth}-01` }
        : {}),
    };
    onSubmit(payload);
  }

  const typeOptions = INVOICE_TYPES.map((value) => ({
    value,
    label: t(`invoices.types.${value}`),
  }));
  const invoiceOption = (invoice: Invoice) => ({
    value: invoice.id,
    label: `${invoice.invoice_number} · ${invoice.recipient_name}`,
    description: formatMoney(invoice.total_amount),
  });

  return (
    <ScrollView
      className="flex-1 bg-paper"
      contentContainerClassName="p-4 pb-12"
      keyboardShouldPersistTaps="handled"
    >
      <Select<InvoiceType>
        testID="invoice-type"
        label={t("invoices.form.type")}
        value={type}
        options={typeOptions}
        onChange={setType}
      />
      <DatePicker
        testID="invoice-issue-date"
        label={t("invoices.form.issueDate")}
        value={issueDate}
        onChange={setIssueDate}
        doneLabel={t("common.ok")}
      />

      {type === "labor" ? (
        <>
          <Select
            testID="invoice-worker"
            label={t("invoices.form.worker")}
            placeholder={t("invoices.form.workerNone")}
            value={workerId}
            options={(workers.data ?? []).map((worker) => ({
              value: worker.id,
              label: worker.name,
              description: worker.role_name ?? undefined,
            }))}
            onChange={setWorkerId}
          />
          <Text className="mb-1 text-sm text-muted-foreground">
            {t("invoices.form.serviceMonth")}
          </Text>
          <MonthPicker
            testID="invoice-service-month"
            value={serviceMonth}
            onChange={setServiceMonth}
          />
        </>
      ) : null}

      <Input
        testID="invoice-recipient"
        label={t("invoices.form.recipient")}
        value={recipientName}
        onChangeText={setRecipientName}
        placeholder={laborWithWorker ? selectedWorker?.name : undefined}
      />
      <Input
        testID="invoice-recipient-address"
        label={t("invoices.form.recipientAddress")}
        value={recipientAddress}
        onChangeText={setRecipientAddress}
      />

      {companyId ? (
        <Select
          testID="invoice-payment-method"
          label={t("invoices.form.paymentMethod")}
          placeholder={t("invoices.form.paymentMethodNone")}
          value={paymentMethodId}
          options={(paymentMethods.data ?? [])
            .filter((m) => m.is_active)
            .map((m) => ({ value: m.id, label: m.label }))}
          onChange={setPaymentMethodId}
        />
      ) : null}

      {type === "return" ? (
        <Card className="mb-4">
          <Text className="mb-2 text-xs text-muted-foreground">
            {t("invoices.form.refundHint")}
          </Text>
          <Select
            testID="invoice-refunds"
            label={t("invoices.form.refundsInvoice")}
            placeholder={t("invoices.form.refundsInvoiceNone")}
            value={refundsInvoiceId}
            options={(materialsInvoices.data?.invoices ?? []).map(
              invoiceOption,
            )}
            onChange={setRefundsInvoiceId}
          />
          <Select<SettledVia>
            testID="invoice-settled-via"
            label={t("invoices.form.settledVia")}
            placeholder={t("invoices.form.settledViaCash")}
            value={settledVia}
            options={[
              { value: "cash", label: t("invoices.form.settledViaCash") },
              { value: "avoir", label: t("invoices.form.settledViaAvoir") },
            ]}
            onChange={setSettledVia}
          />
          {settledVia === "avoir" ? (
            <Select
              testID="invoice-applied-to"
              label={t("invoices.form.appliedTo")}
              placeholder={t("invoices.form.appliedToNone")}
              value={appliedToInvoiceId}
              options={(allInvoices.data?.invoices ?? [])
                .filter(
                  (invoice) =>
                    invoice.type !== "return" &&
                    invoice.type !== "released_funds",
                )
                .map(invoiceOption)}
              onChange={setAppliedToInvoiceId}
            />
          ) : null}
        </Card>
      ) : null}

      <Text className="mb-2 text-sm font-medium text-muted-foreground">
        {t("invoices.form.items")}
      </Text>
      {lines.map((line, index) => (
        <Card key={index} className="mb-3">
          <Input
            testID={`invoice-item-${index}-description`}
            label={t("invoices.form.description")}
            value={line.description}
            onChangeText={(v) => updateLine(index, { description: v })}
          />
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Input
                testID={`invoice-item-${index}-quantity`}
                label={t("invoices.form.quantity")}
                value={line.quantity}
                keyboardType="decimal-pad"
                onChangeText={(v) => updateLine(index, { quantity: v })}
              />
            </View>
            <View className="flex-1">
              <Input
                testID={`invoice-item-${index}-price`}
                label={t("invoices.form.unitPrice")}
                value={line.unit_price}
                keyboardType="decimal-pad"
                onChangeText={(v) => updateLine(index, { unit_price: v })}
              />
            </View>
            <View className="w-20">
              <Input
                testID={`invoice-item-${index}-vat`}
                label={t("invoices.form.vatRate")}
                value={line.vat_rate}
                keyboardType="decimal-pad"
                onChangeText={(v) => updateLine(index, { vat_rate: v })}
              />
            </View>
          </View>
          <View className="flex-row items-center justify-between">
            <Text className="text-sm text-muted-foreground">
              {t("invoices.form.lineTotal")}:{" "}
              {formatMoney(
                (numericLines[index]?.quantity ?? 0) *
                  (numericLines[index]?.unit_price ?? 0) *
                  (1 + (numericLines[index]?.vat_rate ?? 0) / 100),
              )}
            </Text>
            {lines.length > 1 ? (
              <Pressable
                testID={`invoice-item-${index}-remove`}
                onPress={() =>
                  setLines((current) => current.filter((_, i) => i !== index))
                }
              >
                <Text className="text-sm text-danger">
                  {t("common.delete")}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </Card>
      ))}
      <Button
        testID="invoice-add-item"
        label={t("invoices.form.addItem")}
        variant="secondary"
        size="sm"
        className="mb-4"
        onPress={() => setLines((c) => [...c, emptyLine()])}
      />

      <Card className="mb-4">
        <View className="flex-row justify-between py-1">
          <Text className="text-muted-foreground">{t("invoices.totalHt")}</Text>
          <Text className="text-primary">{formatMoney(totals.ht)}</Text>
        </View>
        <View className="flex-row justify-between py-1">
          <Text className="text-muted-foreground">
            {t("invoices.totalTva")}
          </Text>
          <Text className="text-primary">{formatMoney(totals.tva)}</Text>
        </View>
        <View className="flex-row justify-between border-t border-border py-1">
          <Text className="font-semibold text-primary">
            {t("invoices.totalTtc")}
          </Text>
          <Text
            className="font-semibold text-primary"
            testID="invoice-total-ttc"
          >
            {formatMoney(totals.ttc)}
          </Text>
        </View>
      </Card>

      <Input
        testID="invoice-notes"
        label={t("invoices.form.notes")}
        value={notes}
        onChangeText={setNotes}
        multiline
      />

      <Text className="mb-2 text-sm text-muted-foreground">
        {t("invoices.form.highlight")}
      </Text>
      <View className="mb-4 flex-row flex-wrap">
        <Pressable
          testID="invoice-highlight-none"
          onPress={() => setHighlight(null)}
          className={`mb-2 mr-2 h-9 w-9 items-center justify-center rounded-full border ${highlight === null ? "border-4 border-primary" : "border-border"}`}
        >
          <Text className="text-muted-foreground">✕</Text>
        </Pressable>
        {(Object.keys(HIGHLIGHT_COLORS) as HighlightColor[]).map((color) => (
          <Pressable
            key={color}
            testID={`invoice-highlight-${color}`}
            onPress={() => setHighlight(color)}
            className={`mb-2 mr-2 h-9 w-9 rounded-full ${highlight === color ? "border-4 border-primary" : ""}`}
            style={{ backgroundColor: HIGHLIGHT_COLORS[color] }}
          />
        ))}
      </View>

      {error ? (
        <Text className="mb-3 text-sm text-danger" testID="invoice-form-error">
          {error}
        </Text>
      ) : null}
      <Button
        testID="invoice-submit"
        label={editing ? t("common.save") : t("invoices.form.create")}
        loading={submitting}
        onPress={submit}
      />
    </ScrollView>
  );
}
