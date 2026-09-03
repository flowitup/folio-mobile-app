import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/primitives";
import { Select } from "@/components/ui/select";
import { useProjects } from "@/features/projects/projects-api";
import { computeBillingTotals } from "@/lib/billing/billing-totals";
import { parseIsoDate, toIsoDate } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";

import {
  BillingItemsEditor,
  emptyItem,
  itemsFromResponse,
  itemsToPayload,
  validateItems,
} from "./billing-items-editor";
import type { ItemDraft } from "./billing-items-editor";
import { IMPORT_STATUSES } from "./billing-types";
import type {
  BillingDocument,
  BillingDocumentKind,
  CreateBillingDocumentPayload,
  ImportBillingDocumentPayload,
  UpdateBillingDocumentPayload,
} from "./billing-types";
import { CompanyPicker } from "./company-picker";

export type DocumentDraft = {
  company_id: string | null;
  project_id: string | null;
  recipient_name: string;
  recipient_address: string;
  recipient_email: string;
  recipient_siret: string;
  issue_date: string;
  validity_until: string | null;
  payment_due_date: string | null;
  payment_terms: string;
  items: ItemDraft[];
  notes: string;
  terms: string;
  signature_block_text: string;
  document_number: string;
  import_status: ImportBillingDocumentPayload["status"];
};

export type FormMode = "create" | "edit" | "import";

/** Server dates may be ISO or RFC-1123; the form only holds `YYYY-MM-DD`. */
const isoDay = (value: string | null | undefined): string | null => {
  const date = parseIsoDate(value);
  return date ? toIsoDate(date) : null;
};

function addDays(iso: string, days: number): string {
  const date = parseIsoDate(iso) ?? new Date();
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

/** Builds the editable draft from a document (edit), a copied document / template (seed) or nothing. */
export function draftFromSeed(
  kind: BillingDocumentKind,
  seed?: Partial<BillingDocument> | null,
  options: { resetDates?: boolean } = {},
): DocumentDraft {
  const today = toIsoDate(new Date());
  const issue = options.resetDates
    ? today
    : (isoDay(seed?.issue_date) ?? today);
  return {
    company_id: seed?.company_id ?? null,
    project_id: seed?.project_id ?? null,
    recipient_name: seed?.recipient_name ?? "",
    recipient_address: seed?.recipient_address ?? "",
    recipient_email: seed?.recipient_email ?? "",
    recipient_siret: seed?.recipient_siret ?? "",
    issue_date: issue,
    validity_until:
      kind === "devis"
        ? options.resetDates
          ? addDays(issue, 30)
          : (isoDay(seed?.validity_until) ?? addDays(issue, 30))
        : null,
    payment_due_date:
      kind === "facture"
        ? options.resetDates
          ? addDays(issue, 30)
          : (isoDay(seed?.payment_due_date) ?? addDays(issue, 30))
        : null,
    payment_terms: seed?.payment_terms ?? "",
    items: seed?.items?.length ? itemsFromResponse(seed.items) : [emptyItem()],
    notes: seed?.notes ?? "",
    terms: seed?.terms ?? "",
    signature_block_text: seed?.signature_block_text ?? "",
    document_number: "",
    import_status: "paid",
  };
}

const orNull = (value: string) => value.trim() || null;

export function draftToCreatePayload(
  kind: BillingDocumentKind,
  draft: DocumentDraft,
): CreateBillingDocumentPayload {
  return {
    kind,
    company_id: draft.company_id ?? "",
    project_id: draft.project_id,
    recipient_name: draft.recipient_name.trim(),
    recipient_address: orNull(draft.recipient_address),
    recipient_email: orNull(draft.recipient_email),
    recipient_siret: orNull(draft.recipient_siret),
    items: itemsToPayload(draft.items),
    notes: orNull(draft.notes),
    terms: orNull(draft.terms),
    signature_block_text: orNull(draft.signature_block_text),
    issue_date: draft.issue_date,
    validity_until: kind === "devis" ? draft.validity_until : null,
    payment_due_date: kind === "facture" ? draft.payment_due_date : null,
    payment_terms: kind === "facture" ? orNull(draft.payment_terms) : null,
  };
}

/** Same fields minus the immutable ones (kind, company) the PUT schema rejects. */
export function draftToUpdatePayload(
  kind: BillingDocumentKind,
  draft: DocumentDraft,
): UpdateBillingDocumentPayload {
  const payload: Record<string, unknown> = {
    ...draftToCreatePayload(kind, draft),
  };
  delete payload.kind;
  delete payload.company_id;
  return payload as UpdateBillingDocumentPayload;
}

export function draftToImportPayload(
  kind: BillingDocumentKind,
  draft: DocumentDraft,
): ImportBillingDocumentPayload {
  return {
    ...draftToCreatePayload(kind, draft),
    document_number: draft.document_number.trim(),
    status: draft.import_status,
  };
}

export function validateDraft(
  t: TFunction,
  draft: DocumentDraft,
  mode: FormMode,
): { errors: Record<string, string>; itemErrors: Record<number, string> } {
  const errors: Record<string, string> = {};
  if (mode !== "edit" && !draft.company_id)
    errors.company_id = t("billing.form.errors.companyRequired");
  if (!draft.recipient_name.trim())
    errors.recipient_name = t("billing.form.errors.recipientRequired");
  if (draft.items.length === 0)
    errors.items = t("billing.form.errors.atLeastOneItem");
  if (mode === "import" && !draft.document_number.trim())
    errors.document_number = t("billing.form.errors.documentNumberRequired");
  return { errors, itemErrors: validateItems(t, draft.items) };
}

type Props = {
  kind: BillingDocumentKind;
  mode: FormMode;
  initial: DocumentDraft;
  documentNumber?: string;
  submitting: boolean;
  submitLabel: string;
  onSubmit: (draft: DocumentDraft) => void;
};

/** Devis / facture form: company, project, recipient, dates, lines with live totals, notes. */
export function BillingDocumentForm({
  kind,
  mode,
  initial,
  documentNumber,
  submitting,
  submitLabel,
  onSubmit,
}: Props) {
  const { t } = useTranslation();
  const projects = useProjects();
  const [draft, setDraft] = useState<DocumentDraft>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [itemErrors, setItemErrors] = useState<Record<number, string>>({});
  const set = <K extends keyof DocumentDraft>(
    key: K,
    value: DocumentDraft[K],
  ) => setDraft((d) => ({ ...d, [key]: value }));
  const totals = computeBillingTotals(draft.items);

  function submit() {
    const result = validateDraft(t, draft, mode);
    setErrors(result.errors);
    setItemErrors(result.itemErrors);
    if (
      Object.keys(result.errors).length > 0 ||
      Object.keys(result.itemErrors).length > 0
    )
      return;
    onSubmit(draft);
  }

  const projectOptions = [
    { value: "__none__", label: t("billing.form.projectNone") },
    ...(projects.data?.projects ?? []).map((p) => ({
      value: p.id,
      label: p.name,
    })),
  ];

  return (
    <View>
      {mode !== "edit" ? (
        <CompanyPicker
          kind={kind}
          value={draft.company_id}
          onChange={(company_id) => set("company_id", company_id)}
          error={errors.company_id}
        />
      ) : null}
      {mode === "import" ? (
        <>
          <Input
            testID="doc-number"
            label={t("billing.form.documentNumber")}
            value={draft.document_number}
            onChangeText={(v) => set("document_number", v)}
            autoCapitalize="characters"
            error={errors.document_number}
          />
          <Select
            testID="doc-import-status"
            label={t("billing.form.importStatus")}
            value={draft.import_status}
            options={IMPORT_STATUSES.map((value) => ({
              value,
              label: t(`billing.status.${value}`),
            }))}
            onChange={(v) => set("import_status", v)}
          />
        </>
      ) : null}
      {documentNumber ? (
        <Text className="mb-3 text-sm text-muted-foreground">
          {t("billing.form.documentNumber")}: {documentNumber}
        </Text>
      ) : null}
      <Select
        testID="doc-project"
        label={t("billing.form.project")}
        value={draft.project_id ?? "__none__"}
        options={projectOptions}
        onChange={(v) => set("project_id", v === "__none__" ? null : v)}
      />

      <Text className="mb-2 text-base font-semibold text-primary">
        {t("billing.form.recipient")}
      </Text>
      <Input
        testID="doc-recipient-name"
        label={t("billing.form.recipientName")}
        value={draft.recipient_name}
        onChangeText={(v) => set("recipient_name", v)}
        error={errors.recipient_name}
      />
      <Input
        testID="doc-recipient-address"
        label={t("billing.form.recipientAddress")}
        value={draft.recipient_address}
        onChangeText={(v) => set("recipient_address", v)}
        multiline
      />
      <Input
        testID="doc-recipient-email"
        label={t("billing.form.recipientEmail")}
        value={draft.recipient_email}
        onChangeText={(v) => set("recipient_email", v)}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <Input
        testID="doc-recipient-siret"
        label={t("billing.form.recipientSiret")}
        value={draft.recipient_siret}
        onChangeText={(v) => set("recipient_siret", v)}
        keyboardType="number-pad"
      />

      <Text className="mb-2 text-base font-semibold text-primary">
        {t("billing.form.details")}
      </Text>
      <DatePicker
        testID="doc-issue-date"
        label={t("billing.form.issueDate")}
        value={draft.issue_date}
        onChange={(iso) => iso && set("issue_date", iso)}
        doneLabel={t("common.ok")}
      />
      {kind === "devis" ? (
        <DatePicker
          testID="doc-validity"
          label={t("billing.form.validityUntil")}
          value={draft.validity_until}
          onChange={(iso) => set("validity_until", iso)}
          clearable
          doneLabel={t("common.ok")}
        />
      ) : (
        <>
          <DatePicker
            testID="doc-payment-due"
            label={t("billing.form.paymentDue")}
            value={draft.payment_due_date}
            onChange={(iso) => set("payment_due_date", iso)}
            clearable
            doneLabel={t("common.ok")}
          />
          <Input
            testID="doc-payment-terms"
            label={t("billing.form.paymentTerms")}
            value={draft.payment_terms}
            onChangeText={(v) => set("payment_terms", v)}
          />
        </>
      )}

      <Text className="mb-2 text-base font-semibold text-primary">
        {t("billing.form.items")}
      </Text>
      {errors.items ? (
        <Text className="mb-2 text-xs text-danger">{errors.items}</Text>
      ) : null}
      <BillingItemsEditor
        items={draft.items}
        onChange={(items) => set("items", items)}
        errors={itemErrors}
      />

      <Card className="my-4">
        <View className="flex-row justify-between">
          <Text className="text-sm text-muted-foreground">
            {t("billing.form.totalHt")}
          </Text>
          <Text className="text-sm text-primary">
            {formatMoney(totals.totalHt)}
          </Text>
        </View>
        {totals.vatLines.map((line) => (
          <View key={line.rate} className="flex-row justify-between">
            <Text className="text-sm text-muted-foreground">
              {t("billing.form.tva", { rate: line.rate })}
            </Text>
            <Text className="text-sm text-primary">
              {formatMoney(line.tvaAmount)}
            </Text>
          </View>
        ))}
        <View className="flex-row justify-between">
          <Text className="text-base font-semibold text-primary">
            {t("billing.form.totalTtc")}
          </Text>
          <Text
            testID="doc-total-ttc"
            className="text-base font-semibold text-primary"
          >
            {formatMoney(totals.totalTtc)}
          </Text>
        </View>
      </Card>

      <Input
        testID="doc-notes"
        label={t("billing.form.notes")}
        value={draft.notes}
        onChangeText={(v) => set("notes", v)}
        multiline
      />
      <Input
        testID="doc-terms"
        label={t("billing.form.terms")}
        value={draft.terms}
        onChangeText={(v) => set("terms", v)}
        multiline
      />
      <Input
        testID="doc-signature"
        label={t("billing.form.signatureBlock")}
        value={draft.signature_block_text}
        onChangeText={(v) => set("signature_block_text", v)}
        multiline
      />
      <Button
        testID="doc-submit"
        label={submitLabel}
        loading={submitting}
        onPress={submit}
      />
    </View>
  );
}
