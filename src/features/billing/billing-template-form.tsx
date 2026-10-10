import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/primitives";
import { Select } from "@/components/ui/select";
import { formatNumber, parseMoneyInput } from "@/lib/format/money";

import {
  BillingItemsEditor,
  hasItemErrors,
  itemsFromResponse,
  itemsToPayload,
  validateItems,
} from "./billing-items-editor";
import type { ItemDraft, ItemErrors } from "./billing-items-editor";
import { VAT_PRESETS } from "./billing-types";
import type {
  BillingDocumentKind,
  BillingDocumentTemplate,
  CreateBillingTemplatePayload,
} from "./billing-types";

type Props = {
  initial?: BillingDocumentTemplate;
  defaultKind?: BillingDocumentKind;
  submitting: boolean;
  onSubmit: (payload: CreateBillingTemplatePayload) => void;
};

/** Template form: kind (immutable once created), name, default VAT, lines, notes, terms. */
export function BillingTemplateForm({
  initial,
  defaultKind = "devis",
  submitting,
  onSubmit,
}: Props) {
  const { t } = useTranslation();
  const [kind, setKind] = useState<BillingDocumentKind>(
    initial?.kind ?? defaultKind,
  );
  const [name, setName] = useState(initial?.name ?? "");
  const [vat, setVat] = useState(initial?.default_vat_rate ?? "");
  const [items, setItems] = useState<ItemDraft[]>(
    initial ? itemsFromResponse(initial.items) : [],
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [terms, setTerms] = useState(initial?.terms ?? "");
  const [nameError, setNameError] = useState<string | null>(null);
  const [vatError, setVatError] = useState<string | null>(null);
  const [itemErrors, setItemErrors] = useState<Record<number, ItemErrors>>({});
  const [itemsError, setItemsError] = useState<string | null>(null);

  function submit() {
    const trimmed = name.trim();
    setNameError(trimmed ? null : t("billing.templates.nameRequired"));
    // Optional, but when typed it must read as a rate the API takes ("1 000,5" or 150 is not).
    const vatText = vat.trim();
    const vatRate = vatText ? parseMoneyInput(vatText) : null;
    const vatInvalid =
      vatText !== "" && (vatRate === null || vatRate < 0 || vatRate > 100);
    setVatError(
      vatInvalid ? t("billing.form.errors.itemVatRatePositive") : null,
    );
    const errors = validateItems(t, items);
    setItemErrors(errors);
    // validateItems only walks the lines it is given, so an empty template passed it and
    // saved with nothing to seed a document with — the very thing the empty state asks for.
    const missingItems = items.length === 0;
    setItemsError(
      missingItems ? t("billing.form.errors.atLeastOneItem") : null,
    );
    if (!trimmed || vatInvalid || missingItems || hasItemErrors(errors)) return;
    onSubmit({
      kind,
      name: trimmed,
      items: itemsToPayload(items),
      notes: notes.trim() || null,
      terms: terms.trim() || null,
      default_vat_rate: vatRate === null ? null : String(vatRate),
    });
  }

  return (
    <View>
      {initial ? (
        <Text className="mb-3 text-sm text-muted-foreground">
          {t("billing.templates.kind")}: {t(`billing.kind.${initial.kind}`)} ·{" "}
          {t("billing.templates.kindImmutable")}
        </Text>
      ) : (
        <Select<BillingDocumentKind>
          testID="template-kind"
          label={t("billing.templates.kind")}
          value={kind}
          options={(["devis", "facture"] as const).map((value) => ({
            value,
            label: t(`billing.kind.${value}`),
          }))}
          onChange={setKind}
        />
      )}
      <Input
        testID="template-name"
        label={t("billing.templates.name")}
        value={name}
        onChangeText={setName}
        error={nameError}
      />
      <Input
        testID="template-vat"
        label={t("billing.templates.defaultVatRate")}
        value={vat}
        onChangeText={setVat}
        keyboardType="decimal-pad"
        error={vatError}
      />
      <View className="mb-4 flex-row flex-wrap gap-1">
        {VAT_PRESETS.map((preset) => (
          <Pressable key={preset} onPress={() => setVat(preset)}>
            <Badge
              label={`${formatNumber(preset, 2)} %`}
              tone={vat === preset ? "success" : "neutral"}
            />
          </Pressable>
        ))}
      </View>
      <Text className="mb-2 text-base font-semibold text-primary">
        {t("billing.form.items")}
      </Text>
      {itemsError ? (
        <Text className="mb-2 text-xs text-danger">{itemsError}</Text>
      ) : null}
      <BillingItemsEditor
        items={items}
        onChange={setItems}
        errors={itemErrors}
        defaultVatRate={vat.trim() || "20"}
      />
      <View className="h-4" />
      <Input
        testID="template-notes"
        label={t("billing.form.notes")}
        value={notes}
        onChangeText={setNotes}
        multiline
        // Same cap as a document's notes: a template must make a savable document.
        maxLength={2000}
      />
      <Input
        testID="template-terms"
        label={t("billing.form.terms")}
        value={terms}
        onChangeText={setTerms}
        multiline
        maxLength={2000}
      />
      <Button
        testID="template-submit"
        label={t("common.save")}
        loading={submitting}
        onPress={submit}
      />
    </View>
  );
}
