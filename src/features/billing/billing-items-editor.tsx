import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Pressable, Text, TextInput, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge, Card, EmptyState } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { lineTotalHt } from "@/lib/billing/billing-totals";
import { formatMoney } from "@/lib/format/money";

import { useActivitySuggestions } from "./billing-documents-api";
import { VAT_PRESETS } from "./billing-types";
import type { ActivitySuggestion, BillingDocumentItem } from "./billing-types";

export type ItemDraft = {
  description: string;
  quantity: string;
  unit_price: string;
  vat_rate: string;
  category: string;
};

export const emptyItem = (vatRate = "20"): ItemDraft => ({
  description: "",
  quantity: "1",
  unit_price: "",
  vat_rate: vatRate,
  category: "",
});

export function itemsFromResponse(items: BillingDocumentItem[]): ItemDraft[] {
  return items.map((item) => ({
    description: item.description,
    quantity: String(item.quantity),
    unit_price: String(item.unit_price),
    vat_rate: String(item.vat_rate),
    category: item.category ?? "",
  }));
}

const decimal = (value: string) => value.trim().replace(",", ".");

/** Decimal strings go to the API untouched except for the comma → dot normalisation. */
export function itemsToPayload(items: ItemDraft[]): BillingDocumentItem[] {
  return items.map((item) => ({
    description: item.description.trim(),
    quantity: decimal(item.quantity),
    unit_price: decimal(item.unit_price),
    vat_rate: decimal(item.vat_rate),
    category: item.category.trim() || null,
  }));
}

/** Same rules as the web editor: description, quantity > 0, unit price ≥ 0, VAT in [0, 100]. */
export function validateItems(
  t: TFunction,
  items: ItemDraft[],
): Record<number, string> {
  const errors: Record<number, string> = {};
  items.forEach((item, index) => {
    const quantity = Number(decimal(item.quantity));
    const price = Number(decimal(item.unit_price));
    const vat = Number(decimal(item.vat_rate));
    if (!item.description.trim())
      errors[index] = t("billing.form.errors.itemDescriptionRequired");
    else if (!(quantity > 0))
      errors[index] = t("billing.form.errors.itemQuantityPositive");
    else if (!(price >= 0))
      errors[index] = t("billing.form.errors.itemUnitPricePositive");
    else if (!(vat >= 0 && vat <= 100))
      errors[index] = t("billing.form.errors.itemVatRatePositive");
  });
  return errors;
}

type Props = {
  items: ItemDraft[];
  onChange: (items: ItemDraft[]) => void;
  errors?: Record<number, string>;
  defaultVatRate?: string;
};

/** Line-item editor with activity suggestions (past descriptions prefill price and VAT). */
export function BillingItemsEditor({
  items,
  onChange,
  errors = {},
  defaultVatRate = "20",
}: Props) {
  const { t } = useTranslation();
  const sheet = useRef<BottomSheetModal>(null);
  const [active, setActive] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const activeItem = active === null ? undefined : items[active];
  const suggestions = useActivitySuggestions(
    activeItem?.category.trim() || null,
    query.trim(),
    active !== null,
  );

  const patch = (index: number, changes: Partial<ItemDraft>) =>
    onChange(
      items.map((item, i) => (i === index ? { ...item, ...changes } : item)),
    );

  function apply(suggestion: ActivitySuggestion) {
    if (active === null) return;
    patch(active, {
      description: suggestion.description,
      unit_price: suggestion.last_unit_price,
      vat_rate: suggestion.last_vat_rate,
      category: suggestion.category ?? items[active].category,
    });
    sheet.current?.dismiss();
  }

  return (
    <View>
      {items.length === 0 ? (
        <EmptyState message={t("billing.form.errors.atLeastOneItem")} />
      ) : null}
      {items.map((item, index) => (
        <Card key={index} className="mb-3">
          <Input
            testID={`item-category-${index}`}
            label={t("billing.form.category")}
            value={item.category}
            onChangeText={(category) => patch(index, { category })}
          />
          <Input
            testID={`item-description-${index}`}
            label={t("billing.form.description")}
            value={item.description}
            onChangeText={(description) => patch(index, { description })}
            multiline
            error={errors[index]}
          />
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Input
                testID={`item-quantity-${index}`}
                label={t("billing.form.quantity")}
                value={item.quantity}
                onChangeText={(quantity) => patch(index, { quantity })}
                keyboardType="decimal-pad"
              />
            </View>
            <View className="flex-1">
              <Input
                testID={`item-unit-price-${index}`}
                label={t("billing.form.unitPrice")}
                value={item.unit_price}
                onChangeText={(unit_price) => patch(index, { unit_price })}
                keyboardType="decimal-pad"
              />
            </View>
            <View className="flex-1">
              <Input
                testID={`item-vat-${index}`}
                label={t("billing.form.vatRate")}
                value={item.vat_rate}
                onChangeText={(vat_rate) => patch(index, { vat_rate })}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
          <View className="mb-2 flex-row flex-wrap gap-1">
            {VAT_PRESETS.map((preset) => (
              <Pressable
                key={preset}
                onPress={() => patch(index, { vat_rate: preset })}
              >
                <Badge
                  label={`${preset} %`}
                  tone={item.vat_rate === preset ? "success" : "neutral"}
                />
              </Pressable>
            ))}
          </View>
          <View className="flex-row items-center justify-between">
            <View className="flex-row gap-4">
              <Pressable
                testID={`item-suggest-${index}`}
                onPress={() => {
                  setActive(index);
                  setQuery("");
                  sheet.current?.present();
                }}
              >
                <Text className="text-sm text-primary">
                  {t("billing.form.suggestions")}
                </Text>
              </Pressable>
              <Pressable
                testID={`item-remove-${index}`}
                onPress={() => onChange(items.filter((_, i) => i !== index))}
              >
                <Text className="text-sm text-danger">
                  {t("billing.form.removeLine")}
                </Text>
              </Pressable>
            </View>
            <Text className="text-sm font-medium text-primary">
              {t("billing.form.lineHt")} {formatMoney(lineTotalHt(item))}
            </Text>
          </View>
        </Card>
      ))}
      <Button
        testID="item-add"
        label={t("billing.form.addLine")}
        variant="secondary"
        size="sm"
        onPress={() => onChange([...items, emptyItem(defaultVatRate)])}
      />

      <Sheet
        ref={sheet}
        title={t("billing.form.suggestions")}
        snapPoints={["70%"]}
      >
        <View className="p-4">
          <TextInput
            testID="suggestions-search"
            className="mb-3 rounded-lg border border-border px-4 py-2 text-base text-primary"
            placeholder={t("billing.form.description")}
            placeholderTextColor="#a3a3a3"
            value={query}
            onChangeText={setQuery}
          />
          <View className="mb-3 flex-row flex-wrap gap-1">
            {(suggestions.data?.categories ?? []).map((category) => (
              <Pressable
                key={category.name}
                onPress={() =>
                  active !== null && patch(active, { category: category.name })
                }
              >
                <Badge
                  label={category.name}
                  tone={
                    activeItem?.category === category.name
                      ? "success"
                      : "neutral"
                  }
                />
              </Pressable>
            ))}
          </View>
          {suggestions.data && suggestions.data.suggestions.length === 0 ? (
            <Text className="text-sm text-muted-foreground">
              {t("billing.form.noSuggestions")}
            </Text>
          ) : null}
          {(suggestions.data?.suggestions ?? []).map((suggestion) => (
            <Pressable
              key={`${suggestion.category ?? ""}|${suggestion.description}`}
              onPress={() => apply(suggestion)}
              className="border-b border-border py-2"
            >
              <Text className="text-base text-primary">
                {suggestion.description}
              </Text>
              <Text className="text-xs text-muted-foreground">
                {suggestion.category ? `${suggestion.category} · ` : ""}
                {formatMoney(suggestion.last_unit_price)} HT ·{" "}
                {suggestion.last_vat_rate} % · ×{suggestion.frequency}
              </Text>
            </Pressable>
          ))}
        </View>
      </Sheet>
    </View>
  );
}
