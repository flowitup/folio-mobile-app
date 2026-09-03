import { Modal, Pressable, Text, View } from "react-native";

import { Button } from "@/components/ui/button";

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Centered confirmation modal, the replacement for the web alert-dialog. */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable
        className="flex-1 items-center justify-center bg-black/40 px-6"
        onPress={onCancel}
      >
        <Pressable
          className="w-full rounded-xl bg-white p-5"
          onPress={() => undefined}
          testID="confirm-dialog"
        >
          <Text className="mb-2 text-lg font-semibold text-primary">
            {title}
          </Text>
          {message ? (
            <Text className="mb-4 text-sm text-muted-foreground">
              {message}
            </Text>
          ) : null}
          <View className="flex-row justify-end gap-2">
            <Button
              label={cancelLabel}
              variant="secondary"
              size="sm"
              onPress={onCancel}
              testID="confirm-cancel"
            />
            <Button
              label={confirmLabel}
              variant={destructive ? "danger" : "primary"}
              size="sm"
              loading={loading}
              onPress={onConfirm}
              testID="confirm-ok"
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
