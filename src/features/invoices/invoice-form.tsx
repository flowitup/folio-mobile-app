import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { MonthPicker } from "@/components/ui/month-picker";
import { Card } from "@/components/ui/primitives";
import { Select } from "@/components/ui/select";
import { currentMonth, localeTag, toIsoDate } from "@/lib/format/date";
import { MAX_BUSINESS_DATE, MIN_BUSINESS_DATE } from "@/lib/format/date-bounds";
import {
  formatMoney,
  formatNumberInput,
  parseMoneyInput,
  parseMoneyInputDetailed,
  type ParseMoneyInputOptions,
} from "@/lib/format/money";
import {
  MAX_LINE_QUANTITY,
  MAX_LINE_UNIT_PRICE,
} from "@/lib/format/numeric-bounds";
import { HIGHLIGHT_COLORS, invoiceTotals } from "@/lib/invoices/invoice-totals";

import type {
  CreateInvoicePayload,
  HighlightColor,
  Invoice,
  InvoiceType,
  SettledVia,
} from "./invoice-types";
import { useProjectCan } from "@/features/projects/use-project-can";

import { useInvoices, usePaymentMethods, useWorkers } from "./invoices-api";
import { workerRoleLabel } from "@/lib/labor/labor-role-label";

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

// Same precision as the API: 4 decimals on a quantity or a unit price, 2 on a VAT rate.
// A quantity of "2,375" m³ is a decimal; a price of "1.500" is refused as ambiguous.
const QUANTITY_INPUT: ParseMoneyInputOptions = {
  maxDecimals: 4,
  allowNegative: false,
  ambiguousGrouping: "decimal",
};
const VAT_INPUT: ParseMoneyInputOptions = {
  maxDecimals: 2,
  allowNegative: false,
};

function toLineDrafts(invoice?: Invoice): LineDraft[] {
  if (!invoice || invoice.items.length === 0) return [emptyLine()];
  // In the reader's notation ("8,45", "5,5" in French), never "8.45".
  return invoice.items.map((item) => ({
    description: item.description,
    quantity: formatNumberInput(item.quantity, { padAmbiguous: false }),
    unit_price: formatNumberInput(item.unit_price, { minDecimals: 2 }),
    vat_rate: formatNumberInput(item.vat_rate ?? 0, { maxDecimals: 2 }),
  }));
}

/** Field keys of the inline errors, in screen order (the first one is scrolled to). */
type FieldKey =
  "issueDate" | "serviceMonth" | "recipient" | "items" | `items.${number}`;

type Props = {
  projectId: string;
  companyId: string | null | undefined;
  initial?: Invoice;
  /** Type preselected on a new invoice (the overview's "Giải ngân" quick action). */
  initialType?: InvoiceType;
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
  initialType,
  submitting,
  onSubmit,
}: Props) {
  const { t } = useTranslation();
  const editing = Boolean(initial);
  // Recording a release is the financing side of the project: the backend
  // refuses it without `project:view_budget`, so the type is dropped from the
  // picker and a `?type=released_funds` deep link falls back to an expense.
  const canRecordReleases = useProjectCan(projectId, "project:view_budget");
  const requestedType = initial?.type ?? initialType;

  const [type, setType] = useState<InvoiceType>(
    requestedType && (canRecordReleases || requestedType !== "released_funds")
      ? requestedType
      : "materials_services",
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
  // A new labor payment starts on the current month; an edit keeps what the row has, so an
  // older payment saved without a month is not silently moved onto this month on save.
  const [serviceMonth, setServiceMonth] = useState<string | null>(
    initial ? (initial.service_month?.slice(0, 7) ?? null) : currentMonth(),
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
  const [isCashAdvance, setIsCashAdvance] = useState(
    initial?.is_cash_advance ?? false,
  );
  const [error, setError] = useState<string | null>(null);
  // Errors next to their field, and where each field sits, to scroll to the first one.
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const scrollRef = useRef<ScrollView>(null);
  // Plain mutable map (layout positions are not rendered, so they need no state updates).
  const [fieldY] = useState<Record<string, number>>(() => ({}));
  const trackY =
    (key: FieldKey) => (e: { nativeEvent: { layout: { y: number } } }) => {
      fieldY[key] = e.nativeEvent.layout.y;
    };
  const clearFieldError = (key: string) =>
    setFieldErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });

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
        quantity: parseMoneyInput(line.quantity, QUANTITY_INPUT) ?? 0,
        unit_price: parseMoneyInput(line.unit_price) ?? 0,
        vat_rate: parseMoneyInput(line.vat_rate) ?? 0,
      })),
    [lines],
  );
  const totals = invoiceTotals(numericLines);

  /**
   * Active methods plus, when editing, the one this invoice was written with. A method
   * deactivated since then is gone from the list, and dropping it would leave the field on
   * its placeholder while `payment_method_id` stayed in the payload — a save that fails with
   * nothing on screen to explain it. It stays selected, and any active one may replace it.
   */
  const paymentMethodOptions = useMemo(() => {
    const options = (paymentMethods.data ?? [])
      .filter((method) => method.is_active)
      .map((method) => ({ value: method.id, label: method.label }));
    const own = initial?.payment_method_id;
    if (own && !options.some((option) => option.value === own))
      options.push({
        value: own,
        label:
          initial?.payment_method_label ?? t("invoices.form.paymentMethodNone"),
      });
    return options;
  }, [paymentMethods.data, initial, t]);

  const selectedWorker = workers.data?.find((worker) => worker.id === workerId);
  const laborWithWorker = type === "labor" && Boolean(workerId);
  /** Types whose line items may be negative — the web form's `MIXED_SIGN_TYPES`. */
  const allowsNegativePrice =
    type === "return" || type === "materials_services";

  function updateLine(index: number, patch: Partial<LineDraft>) {
    setLines((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
    for (const field of Object.keys(patch))
      clearFieldError(`items.${index}.${field}`);
    clearFieldError("items");
  }

  /** Why a typed figure cannot be saved, in words, or null when it reads. */
  function figureError(
    text: string,
    options: ParseMoneyInputOptions,
  ): string | null {
    const parsed = parseMoneyInputDetailed(text, options);
    switch (parsed.error) {
      case null:
        return null;
      case "ambiguous":
        return t("invoices.form.amountAmbiguous", {
          typed: text.trim(),
          grouped: String(parsed.suggestion ?? ""),
        });
      case "tooManyDecimals":
        return t("invoices.form.tooManyDecimals", {
          max: options.maxDecimals ?? 2,
        });
      case "negative":
        return t("invoices.form.negative");
      default:
        return t("invoices.form.amountInvalid");
    }
  }

  function submit() {
    const errors: Record<string, string> = {};
    if (!issueDate) errors.issueDate = t("invoices.form.issueDateRequired");
    if (type === "labor" && !editing && !serviceMonth)
      errors.serviceMonth = t("invoices.form.serviceMonthRequired");
    const recipient =
      laborWithWorker && !recipientName.trim()
        ? (selectedWorker?.name ?? "")
        : recipientName.trim();
    if (!recipient) errors.recipient = t("invoices.form.recipientRequired");

    // Each described line, checked field by field with the same limits as the backend: a
    // price below zero only on mixed-sign types, no amount past the API caps.
    const priceInput: ParseMoneyInputOptions = {
      maxDecimals: 4,
      allowNegative: allowsNegativePrice,
    };
    lines.forEach((line, index) => {
      if (!line.description.trim()) return;
      const at = (field: string) => `items.${index}.${field}`;
      const quantity = numericLines[index].quantity;
      const quantityError = figureError(line.quantity, QUANTITY_INPUT);
      if (quantityError) errors[at("quantity")] = quantityError;
      else if (!(quantity > 0))
        errors[at("quantity")] = t("invoices.form.quantityPositive");
      else if (quantity > MAX_LINE_QUANTITY)
        errors[at("quantity")] = t("invoices.form.lineTooLarge", {
          quantity: MAX_LINE_QUANTITY.toLocaleString(localeTag()),
          price: formatMoney(MAX_LINE_UNIT_PRICE),
        });
      const priceError =
        line.unit_price.trim() === ""
          ? t("invoices.form.amountInvalid")
          : figureError(line.unit_price, priceInput);
      if (priceError)
        errors[at("unit_price")] =
          priceError === t("invoices.form.negative")
            ? t("invoices.form.pricePositive")
            : priceError;
      else if (Math.abs(numericLines[index].unit_price) > MAX_LINE_UNIT_PRICE)
        errors[at("unit_price")] = t("invoices.form.lineTooLarge", {
          quantity: MAX_LINE_QUANTITY.toLocaleString(localeTag()),
          price: formatMoney(MAX_LINE_UNIT_PRICE),
        });
      // "0150" reads as 150: out of range, said next to the field.
      const vatError =
        line.vat_rate.trim() === ""
          ? null
          : figureError(line.vat_rate, VAT_INPUT);
      const vat = numericLines[index].vat_rate;
      if (vatError || !(vat >= 0 && vat <= 100))
        errors[at("vat_rate")] = t("invoices.form.vatRange");
    });
    const items = numericLines.filter((line) => line.description);
    if (items.length === 0) errors.items = t("invoices.form.itemsRequired");

    const keys = Object.keys(errors);
    setFieldErrors(errors);
    if (keys.length > 0) {
      setError(t("invoices.form.fixFields", { count: keys.length }));
      // Scroll to the first field in screen order (a line error scrolls to its line).
      const order: string[] = [
        "issueDate",
        "serviceMonth",
        "recipient",
        "items",
      ];
      const first =
        order.find((key) => key in errors) ??
        keys
          .filter((key) => key.startsWith("items."))
          .map((key) => key.split(".").slice(0, 2).join("."))
          .sort((a, b) => Number(a.split(".")[1]) - Number(b.split(".")[1]))[0];
      const firstY = first ? fieldY[first] : undefined;
      if (firstY !== undefined)
        scrollRef.current?.scrollTo({
          y: Math.max(firstY - 16, 0),
          animated: true,
        });
      return;
    }
    setError(null);
    if (!issueDate) return; // reported above; narrows the type

    const payload: CreateInvoicePayload = {
      type,
      issue_date: issueDate,
      recipient_name: recipient,
      // On edit an emptied field goes as "" so the API clears it (a missing key means "keep").
      recipient_address: recipientAddress.trim() || (editing ? "" : undefined),
      notes: notes.trim() || (editing ? "" : undefined),
      items,
      payment_method_id: paymentMethodId,
      highlight_color: highlight,
      // Only a release can be a cash advance (the API refuses the flag elsewhere).
      ...(type === "released_funds" ? { is_cash_advance: isCashAdvance } : {}),
      ...(type === "return"
        ? {
            refunds_invoice_id: refundsInvoiceId,
            settled_via: settledVia,
            applied_to_invoice_id:
              settledVia === "avoir" ? appliedToInvoiceId : null,
          }
        : {}),
      ...(type === "labor"
        ? {
            worker_id: workerId,
            service_month: serviceMonth ? `${serviceMonth}-01` : null,
          }
        : {}),
    };
    onSubmit(payload);
  }

  const typeOptions = INVOICE_TYPES.filter(
    (value) => canRecordReleases || value !== "released_funds",
  ).map((value) => ({
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
      ref={scrollRef}
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
      {type === "released_funds" ? (
        <View className="mb-4 flex-row items-center gap-3">
          <View className="flex-1">
            <Text className="text-sm font-medium text-ink">
              {t("invoices.form.cashAdvance")}
            </Text>
            <Text className="mt-0.5 text-xs text-muted-foreground">
              {t("invoices.form.cashAdvanceHint")}
            </Text>
          </View>
          <Switch
            testID="invoice-cash-advance"
            accessibilityLabel={t("invoices.form.cashAdvance")}
            value={isCashAdvance}
            onValueChange={setIsCashAdvance}
          />
        </View>
      ) : null}
      <View onLayout={trackY("issueDate")}>
        <DatePicker
          testID="invoice-issue-date"
          label={t("invoices.form.issueDate")}
          value={issueDate}
          onChange={(value) => {
            setIssueDate(value);
            clearFieldError("issueDate");
          }}
          doneLabel={t("common.ok")}
          minimumDate={MIN_BUSINESS_DATE}
          maximumDate={MAX_BUSINESS_DATE}
        />
        {fieldErrors.issueDate ? (
          <Text
            className="-mt-2 mb-3 text-xs text-negative"
            testID="invoice-issue-date-error"
          >
            {fieldErrors.issueDate}
          </Text>
        ) : null}
      </View>

      {type === "labor" ? (
        <>
          <Select
            testID="invoice-worker"
            clearable
            label={t("invoices.form.worker")}
            placeholder={t("invoices.form.workerNone")}
            value={workerId}
            options={(workers.data ?? []).map((worker) => ({
              value: worker.id,
              label: worker.name,
              description: workerRoleLabel(worker, t) ?? undefined,
            }))}
            onChange={setWorkerId}
          />
          <Text
            className="mb-1 text-sm text-muted-foreground"
            onLayout={trackY("serviceMonth")}
          >
            {t("invoices.form.serviceMonth")}
          </Text>
          {fieldErrors.serviceMonth ? (
            <Text
              className="mb-1 text-xs text-negative"
              testID="invoice-service-month-error"
            >
              {fieldErrors.serviceMonth}
            </Text>
          ) : null}
          {serviceMonth ? (
            <>
              <MonthPicker
                testID="invoice-service-month"
                value={serviceMonth}
                onChange={setServiceMonth}
              />
              {editing ? (
                <Pressable
                  testID="invoice-service-month-clear"
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => setServiceMonth(null)}
                  className="-mt-1 mb-3 self-start"
                >
                  <Text className="text-sm text-muted-foreground underline">
                    {t("invoices.form.serviceMonthClear")}
                  </Text>
                </Pressable>
              ) : null}
            </>
          ) : (
            <View className="mb-3 flex-row items-center justify-between rounded-full border border-line bg-card py-1 pl-4 pr-1">
              <Text
                className="text-[13px] text-muted-foreground"
                testID="invoice-service-month-none"
              >
                {t("invoices.form.serviceMonthNone")}
              </Text>
              <Button
                testID="invoice-service-month-set"
                label={t("invoices.form.serviceMonthSet")}
                variant="secondary"
                size="sm"
                onPress={() => {
                  setServiceMonth(currentMonth());
                  clearFieldError("serviceMonth");
                }}
              />
            </View>
          )}
        </>
      ) : null}

      <View onLayout={trackY("recipient")}>
        <Input
          testID="invoice-recipient"
          label={t("invoices.form.recipient")}
          value={recipientName}
          onChangeText={(value) => {
            setRecipientName(value);
            clearFieldError("recipient");
          }}
          placeholder={laborWithWorker ? selectedWorker?.name : undefined}
          error={fieldErrors.recipient}
          maxLength={255}
        />
      </View>
      <Input
        testID="invoice-recipient-address"
        label={t("invoices.form.recipientAddress")}
        value={recipientAddress}
        onChangeText={setRecipientAddress}
      />

      {companyId ? (
        <Select
          testID="invoice-payment-method"
          clearable
          label={t("invoices.form.paymentMethod")}
          placeholder={t("invoices.form.paymentMethodNone")}
          value={paymentMethodId}
          options={paymentMethodOptions}
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
            clearable
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
            clearable
            label={t("invoices.form.settledVia")}
            placeholder={t("invoices.form.settledViaNone")}
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
              clearable
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

      <Text
        className="mb-2 text-sm font-medium text-muted-foreground"
        onLayout={trackY("items")}
      >
        {t("invoices.form.items")}
      </Text>
      {fieldErrors.items ? (
        <Text
          className="mb-2 text-xs text-negative"
          testID="invoice-items-error"
        >
          {fieldErrors.items}
        </Text>
      ) : null}
      {lines.map((line, index) => (
        <View key={index} onLayout={trackY(`items.${index}`)}>
          <Card className="mb-3">
            <Input
              testID={`invoice-item-${index}-description`}
              label={t("invoices.form.description")}
              value={line.description}
              onChangeText={(v) => updateLine(index, { description: v })}
              maxLength={500}
            />
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Input
                  testID={`invoice-item-${index}-quantity`}
                  label={t("invoices.form.quantity")}
                  value={line.quantity}
                  keyboardType="decimal-pad"
                  onChangeText={(v) => updateLine(index, { quantity: v })}
                  error={fieldErrors[`items.${index}.quantity`]}
                />
              </View>
              <View className="flex-1">
                <Input
                  testID={`invoice-item-${index}-price`}
                  label={t("invoices.form.unitPrice")}
                  value={line.unit_price}
                  // A return nets spend back down, so its lines carry a NEGATIVE unit price
                  // (same mixed-sign rule as the web form). `decimal-pad` has no minus key,
                  // which left an avoir recorded as extra spend; this keyboard has one.
                  keyboardType={
                    allowsNegativePrice
                      ? "numbers-and-punctuation"
                      : "decimal-pad"
                  }
                  onChangeText={(v) => updateLine(index, { unit_price: v })}
                  error={fieldErrors[`items.${index}.unit_price`]}
                />
              </View>
              <View className="w-20">
                <Input
                  testID={`invoice-item-${index}-vat`}
                  label={t("invoices.form.vatRate")}
                  value={line.vat_rate}
                  keyboardType="decimal-pad"
                  onChangeText={(v) => updateLine(index, { vat_rate: v })}
                  error={fieldErrors[`items.${index}.vat_rate`]}
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
        </View>
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
          accessibilityRole="button"
          accessibilityLabel={t("invoices.detail.noHighlight")}
          accessibilityState={{ selected: highlight === null }}
          onPress={() => setHighlight(null)}
          className={`mb-2 mr-2 h-9 w-9 items-center justify-center rounded-full border ${highlight === null ? "border-4 border-primary" : "border-border"}`}
        >
          <Text className="text-muted-foreground">✕</Text>
        </Pressable>
        {(Object.keys(HIGHLIGHT_COLORS) as HighlightColor[]).map((color) => (
          <Pressable
            key={color}
            testID={`invoice-highlight-${color}`}
            accessibilityRole="button"
            accessibilityLabel={t(`invoices.highlightColors.${color}`)}
            accessibilityState={{ selected: highlight === color }}
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
