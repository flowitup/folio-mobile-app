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
  disabled = false,
  disabledReason,
}: {
  value: HighlightColor | null | undefined;
  onChange: (color: HighlightColor | null) => void;
  /** Read-only (no `project:manage_invoices`): the current colour shows, taps do nothing. */
  disabled?: boolean;
  /** Why the row is read-only, printed under the dimmed dots so a tap that does nothing is explained. */
  disabledReason?: string;
}) {
  const { t } = useTranslation();
  const tokens = useTokens();
  // Read-only with no colour set: the row would only offer dots that ignore taps.
  if (disabled && !value) return null;
  // Read-only dots are dimmed (the current one keeps its ring) so they do not look tappable.
  const dim = (selected: boolean) => (disabled && !selected ? 0.35 : 1);
  return (
    <View testID="detail-highlight-row">
      <View className="flex-row items-center gap-2 px-1">
        <Eyebrow className="mr-1">{t("invoices.form.highlight")}</Eyebrow>
        <Pressable
          testID="detail-highlight-none"
          accessibilityRole="button"
          accessibilityLabel={t("invoices.detail.noHighlight")}
          accessibilityState={{ selected: !value, disabled }}
          disabled={disabled}
          onPress={() => onChange(null)}
          className="h-[26px] w-[26px] items-center justify-center rounded-full bg-card"
          style={{
            borderWidth: value ? 1 : 2,
            borderColor: value ? tokens.line2 : tokens.ink,
            opacity: dim(!value),
          }}
        >
          <Text className="font-sans text-[11px] text-muted">✕</Text>
        </Pressable>
        {(Object.keys(HIGHLIGHT_COLORS) as HighlightColor[]).map((color) => (
          <Pressable
            key={color}
            testID={`detail-highlight-${color}`}
            accessibilityRole="button"
            accessibilityLabel={t(`invoices.highlightColors.${color}`)}
            accessibilityState={{ selected: value === color, disabled }}
            disabled={disabled}
            onPress={() => onChange(color)}
            className="h-[26px] w-[26px] rounded-full"
            style={{
              backgroundColor: HIGHLIGHT_COLORS[color],
              borderWidth: value === color ? 2 : 0,
              borderColor: tokens.ink,
              opacity: dim(value === color),
            }}
          />
        ))}
      </View>
      {disabled && disabledReason ? (
        <Text
          testID="detail-highlight-locked"
          className="mt-1.5 px-1 font-sans text-[12px] text-muted"
        >
          {disabledReason}
        </Text>
      ) : null}
    </View>
  );
}
