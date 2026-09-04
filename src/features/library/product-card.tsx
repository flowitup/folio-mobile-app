import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { AuthedImage } from "@/components/ui/authed-image";
import { Badge } from "@/components/ui/primitives";
import { formatDate } from "@/lib/format/date";

import { productImagePath } from "./library-api";
import { localizeCategory } from "./library-helpers";
import type { LibraryProduct } from "./library-types";

type Props = {
  product: LibraryProduct;
  supplierName?: string;
  selected?: boolean;
  compareMode?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
};

/** Grid card: 16:9 photo (or placeholder), name, description, supplier / category / size badges, purchase stats. */
export function ProductCard({
  product,
  supplierName,
  selected,
  compareMode,
  onPress,
  onLongPress,
}: Props) {
  const { t } = useTranslation();
  return (
    <Pressable
      testID={`product-${product.id}`}
      onPress={onPress}
      onLongPress={onLongPress}
      className={`mb-3 flex-1 rounded-lg border bg-card p-2 ${selected ? "border-primary" : "border-border"}`}
    >
      <View className="aspect-video w-full items-center justify-center overflow-hidden rounded bg-paper-2">
        {product.has_image ? (
          <AuthedImage
            path={productImagePath(product.id)}
            style={{ width: "100%", height: "100%" }}
            resizeMode="cover"
          />
        ) : (
          <Text className="text-2xl text-muted-foreground">▣</Text>
        )}
        {compareMode ? (
          <View className="absolute right-1 top-1">
            <Badge
              label={selected ? "✓" : "○"}
              tone={selected ? "success" : "neutral"}
            />
          </View>
        ) : null}
      </View>
      <Text className="mt-2 text-sm font-medium text-primary" numberOfLines={2}>
        {product.name}
      </Text>
      {product.description ? (
        <Text className="text-xs text-muted-foreground" numberOfLines={1}>
          {product.description}
        </Text>
      ) : null}
      <View className="mt-1 flex-row flex-wrap gap-1">
        {supplierName ? <Badge label={supplierName} /> : null}
        <Badge
          label={localizeCategory(t, product.category)}
          tone={product.category ? "success" : "neutral"}
        />
        {product.size ? <Badge label={product.size} tone="warning" /> : null}
      </View>
      <Text className="mt-1 text-xs text-muted-foreground">
        {t("library.purchasedTimes", { count: product.purchase_count })}
        {product.last_purchased_at
          ? ` · ${formatDate(product.last_purchased_at)}`
          : ""}
      </Text>
    </Pressable>
  );
}
