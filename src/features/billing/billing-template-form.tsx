import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/primitives";
import { Select } from "@/components/ui/select";

import {
  BillingItemsEditor,
  itemsFromResponse,
  itemsToPayload,
  validateItems,
} from "./billing-items-editor";
import type { ItemDraft } from "./billing-items-editor";
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
  const [itemErrors, setItemErrors] = useState<Record<number, string>>({});

  function submit() {
    const trimmed = name.trim();
    setNameError(trimmed ? null : t("billing.templates.nameRequired"));
    const errors = validateItems(t, items);
    setItemErrors(errors);
    if (!trimmed || Object.keys(errors).length > 0) return;
    onSubmit({
      kind,
      name: trimmed,
      items: itemsToPayload(items),
      notes: notes.trim() || null,
      terms: terms.trim() || null,
      default_vat_rate: vat.trim() ? vat.trim().replace(",", ".") : null,
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
      />
      <View className="mb-4 flex-row flex-wrap gap-1">
        {VAT_PRESETS.map((preset) => (
          <Pressable key={preset} onPress={() => setVat(preset)}>
            <Badge
              label={`${preset} %`}
              tone={vat === preset ? "success" : "neutral"}
            />
          </Pressable>
        ))}
      </View>
      <Text className="mb-2 text-base font-semibold text-primary">
        {t("billing.form.items")}
      </Text>
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
      />
      <Input
        testID="template-terms"
        label={t("billing.form.terms")}
        value={terms}
        onChangeText={setTerms}
        multiline
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
