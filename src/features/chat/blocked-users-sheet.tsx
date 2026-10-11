import { useTranslation } from "react-i18next";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";

import { useBlockedUsers, useUnblockChatUser } from "@/features/chat/chat-api";

/** Lists the people blocked in chat with an Unblock button each (App Store guideline 1.2). */
export function BlockedUsersSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const blocked = useBlockedUsers(visible);
  const unblock = useUnblockChatUser();
  const items = blocked.data ?? [];
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable
        testID="blocked-users-backdrop"
        onPress={onClose}
        className="flex-1 justify-end bg-black/40"
      >
        <Pressable className="max-h-[70%] rounded-t-2xl bg-paper px-4 pb-8 pt-4">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="font-sans-semibold text-[16px] text-ink">
              {t("chat.moderation.blockedTitle")}
            </Text>
            <Pressable
              testID="blocked-users-close"
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t("common.close")}
              hitSlop={8}
            >
              <Text className="text-lg text-ink">✕</Text>
            </Pressable>
          </View>
          <ScrollView>
            {items.length === 0 ? (
              <Text className="py-6 text-center font-sans text-[13px] text-muted">
                {t("chat.moderation.none")}
              </Text>
            ) : null}
            {items.map((user) => (
              <View
                key={user.id}
                className="flex-row items-center justify-between border-b border-line py-3"
              >
                <Text
                  className="mr-3 min-w-0 flex-1 font-sans text-[14px] text-ink"
                  numberOfLines={1}
                >
                  {user.name}
                </Text>
                <Pressable
                  testID={`unblock-${user.id}`}
                  onPress={() => unblock.mutate({ userId: user.id })}
                  accessibilityRole="button"
                  className="rounded-full border border-line px-3 py-1.5 active:opacity-70"
                >
                  <Text className="font-sans-medium text-[12.5px] text-ink">
                    {t("chat.moderation.unblock")}
                  </Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
