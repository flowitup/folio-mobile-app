import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { Badge } from "@/components/ui/primitives";
import { RowChevron } from "@/components/ui/typography";

import { isInventoryCategorySlug } from "./inventory-types";
import type { InventoryItem } from "./inventory-types";

/** Known slug → i18n label; null → "uncategorised"; unknown legacy value → raw. */
export function localizeInventoryCategory(
  t: (key: string) => string,
  value: string | null | undefined,
): string {
  if (!value) return t("inventory.uncategorized");
  if (isInventoryCategorySlug(value)) return t(`inventory.categories.${value}`);
  return value;
}

type Props = {
  item: InventoryItem;
  onPress?: () => void;
  last?: boolean;
};

/**
 * One inventory row inside a location group: quantity in mono on the left, name and reference,
 * then the condition chip — green when usable, red when broken — so a damaged tool is spotted
 * without reading.
 */
export function InventoryItemRow({ item, onPress, last = false }: Props) {
  const { t } = useTranslation();
  const damaged = item.condition === "damaged";
  return (
    <Pressable
      testID={`inventory-item-${item.id}`}
      accessibilityRole={onPress ? "button" : undefined}
      onPress={onPress}
      disabled={!onPress}
      className={`flex-row items-center gap-3 px-3.5 py-3 ${last ? "" : "border-b border-line"} ${onPress ? "active:opacity-70" : ""}`}
    >
      <View className="min-w-[44px] items-center justify-center rounded-[10px] bg-paper-2 px-2 py-1.5">
        <Text
          testID={`inventory-item-${item.id}-quantity`}
          className="font-mono text-[15px] text-ink"
        >
          {item.quantity}
        </Text>
      </View>
      <View className="min-w-0 flex-1">
        <Text
          className="font-sans-medium text-[14px] text-ink"
          numberOfLines={1}
        >
          {item.name}
        </Text>
        <Text className="font-sans text-[11.5px] text-muted" numberOfLines={1}>
          {localizeInventoryCategory(t, item.category)}
          {item.reference ? ` · ${item.reference}` : ""}
        </Text>
      </View>
      <Badge
        testID={`inventory-item-${item.id}-condition`}
        label={t(`inventory.condition.${item.condition}`)}
        tone={damaged ? "danger" : "success"}
      />
      {onPress ? <RowChevron /> : null}
    </Pressable>
  );
}
