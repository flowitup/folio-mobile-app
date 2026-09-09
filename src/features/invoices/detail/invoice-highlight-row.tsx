import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { Eyebrow } from "@/components/ui/typography";
import type { HighlightColor } from "@/features/invoices/invoice-types";
import { HIGHLIGHT_COLORS } from "@/lib/invoices/invoice-totals";
import { useTokens } from "@/theme/tokens";

/** 1b "Tô màu" row: eyebrow, a ✕ "none" dot and the six 26px palette dots; the current one gets an ink ring. */
export function InvoiceHighlightRow({
  value,
  onChange,
}: {
  value: HighlightColor | null | undefined;
  onChange: (color: HighlightColor | null) => void;
}) {
  const { t } = useTranslation();
  const tokens = useTokens();
  return (
    <View className="flex-row items-center gap-2 px-1">
      <Eyebrow className="mr-1">{t("invoices.form.highlight")}</Eyebrow>
      <Pressable
        testID="detail-highlight-none"
        accessibilityRole="button"
        accessibilityLabel={t("invoices.detail.noHighlight")}
        accessibilityState={{ selected: !value }}
        onPress={() => onChange(null)}
        className="h-[26px] w-[26px] items-center justify-center rounded-full bg-card"
        style={{
          borderWidth: value ? 1 : 2,
          borderColor: value ? tokens.line2 : tokens.ink,
        }}
      >
        <Text className="font-sans text-[11px] text-muted">✕</Text>
      </Pressable>
      {(Object.keys(HIGHLIGHT_COLORS) as HighlightColor[]).map((color) => (
        <Pressable
          key={color}
          testID={`detail-highlight-${color}`}
          accessibilityRole="button"
          accessibilityLabel={color}
          accessibilityState={{ selected: value === color }}
          onPress={() => onChange(color)}
          className="h-[26px] w-[26px] rounded-full"
          style={{
            backgroundColor: HIGHLIGHT_COLORS[color],
            borderWidth: value === color ? 2 : 0,
            borderColor: tokens.ink,
          }}
        />
      ))}
    </View>
  );
}
