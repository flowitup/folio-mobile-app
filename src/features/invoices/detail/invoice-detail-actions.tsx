import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import type { IconName } from "@/components/ui/icon";
import { useTokens } from "@/theme/tokens";

type ActionTone = "paper" | "ink" | "danger";

function RoundAction({
  icon,
  label,
  tone,
  loading = false,
  onPress,
  testID,
}: {
  icon: IconName;
  label: string;
  tone: ActionTone;
  loading?: boolean;
  onPress: () => void;
  testID: string;
}) {
  const tokens = useTokens();
  const iconColor =
    tone === "ink"
      ? tokens.onInk
      : tone === "danger"
        ? tokens.negative
        : tokens.ink;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={loading}
      className="flex-1 items-center gap-1.5 active:opacity-70"
    >
      <View
        className={`h-[52px] w-[52px] items-center justify-center rounded-full ${tone === "ink" ? "bg-ink" : "border border-line bg-card"}`}
      >
        {loading ? (
          <ActivityIndicator color={iconColor} />
        ) : (
          <Icon name={icon} size={20} color={iconColor} />
        )}
      </View>
      <Text
        className={`font-sans-medium text-[11px] ${tone === "ink" ? "text-ink" : tone === "danger" ? "text-negative" : "text-muted"}`}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** 1b action row of the invoice sheet: PDF · Đính kèm · Sửa (ink) · Xoá (negative), 52px circles. */
export function InvoiceDetailActions({
  printing,
  canManage,
  onPrint,
  onAttach,
  onEdit,
  onDelete,
}: {
  printing: boolean;
  /** `project:manage_invoices` — without it only the PDF export stays (the backend refuses writes). */
  canManage: boolean;
  onPrint: () => void;
  onAttach: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View className="flex-row gap-2" testID="invoice-actions">
      <RoundAction
        testID="invoice-print"
        icon="printer"
        label={t("invoices.detail.pdf")}
        tone="paper"
        loading={printing}
        onPress={onPrint}
      />
      {canManage ? (
        <>
          <RoundAction
            testID="attachment-add"
            icon="paperclip"
            label={t("invoices.detail.attach")}
            tone="paper"
            onPress={onAttach}
          />
          <RoundAction
            testID="invoice-edit"
            icon="edit-3"
            label={t("common.edit")}
            tone="ink"
            onPress={onEdit}
          />
          <RoundAction
            testID="invoice-delete"
            icon="trash-2"
            label={t("common.delete")}
            tone="danger"
            onPress={onDelete}
          />
        </>
      ) : null}
    </View>
  );
}

/** Warning-tint prompt (r16): a question and an ink pill — "Công ty đã chuyển tiền hoàn? · Đã hoàn". */
export function RefundPromptBanner({
  question,
  action,
  loading,
  onPress,
  testID,
}: {
  question: string;
  action: string;
  loading: boolean;
  onPress: () => void;
  testID: string;
}) {
  const tokens = useTokens();
  return (
    <View className="flex-row items-center gap-2.5 rounded-2xl bg-warning-tint px-3.5 py-3">
      <Text className="min-w-0 flex-1 font-sans text-[13px] leading-[18px] text-ink">
        {question}
      </Text>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        onPress={onPress}
        disabled={loading}
        className="h-8 min-w-[64px] items-center justify-center rounded-full bg-ink px-3 active:opacity-70"
      >
        {loading ? (
          <ActivityIndicator color={tokens.onInk} />
        ) : (
          <Text className="font-sans-semibold text-xs text-on-ink">
            {action}
          </Text>
        )}
      </Pressable>
    </View>
  );
}
