import { useTranslation } from "react-i18next";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";

import type { ChatMember, ChatMessage } from "@/features/chat/chat-api";
import { REACTION_EMOJIS, ownReaction, whoReacted } from "@/lib/chat/reactions";
import type { ReactionEmoji } from "@/lib/chat/reactions";
import { chatPersonName } from "@/lib/chat/person-name";
import { readersOfMessage } from "@/lib/chat/seen-by";

/**
 * One message's details, opened by tapping its bubble: the emoji picker on top (tapping the
 * viewer's own emoji again removes it), who reacted with what, then who has read up to it.
 * Visible while `message` is set; it follows the live message, so polls and the optimistic
 * reaction update show here at once.
 */
export function MessageDetailsSheet({
  message,
  members,
  viewerId,
  onReact,
  onClose,
}: {
  message: ChatMessage | null;
  members: ChatMember[];
  viewerId: string | null | undefined;
  onReact: (messageId: string, emoji: ReactionEmoji) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const reactions = message?.reactions ?? [];
  const mine = ownReaction(reactions, viewerId);
  const reacted = whoReacted(reactions, members);
  // A reactor still in the channel by their member name; someone who left by the name the
  // server sends with the reaction, marked as a former member; else a neutral label.
  const memberById = new Map(members.map((m) => [m.id, m]));
  const reactorName = (userId: string, memberName: string | null): string => {
    const member = memberById.get(userId);
    if (member && memberName !== null)
      return chatPersonName(member.name, member.state, t);
    const userName = reactions.find((r) => r.user_id === userId)?.user_name;
    if (userName)
      return t("chat.details.formerMember", { name: userName });
    return t("chat.details.unknownMember");
  };
  const readers = message
    ? readersOfMessage(message, members, viewerId)
    : [];
  return (
    <Modal
      visible={message !== null}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable
        testID="message-details-backdrop"
        onPress={onClose}
        className="flex-1 justify-end bg-black/40"
      >
        <Pressable
          testID="message-details-sheet"
          className="max-h-[75%] rounded-t-2xl bg-paper px-4 pb-8 pt-4"
        >
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="font-sans-semibold text-[16px] text-ink">
              {t("chat.details.title")}
            </Text>
            <Pressable
              testID="message-details-close"
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t("common.close")}
              hitSlop={8}
            >
              <Text className="text-lg text-ink">✕</Text>
            </Pressable>
          </View>
          <View className="mb-2 flex-row justify-between">
            {REACTION_EMOJIS.map((emoji, index) => {
              const selected = emoji === mine;
              return (
                <Pressable
                  key={emoji}
                  testID={`message-details-react-${index}`}
                  onPress={() => {
                    if (message) onReact(message.id, emoji);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t("chat.details.react", { emoji })}
                  accessibilityState={{ selected }}
                  className={`h-12 w-12 items-center justify-center rounded-full border active:opacity-70 ${selected ? "border-positive bg-positive-tint" : "border-transparent"}`}
                >
                  <Text className="text-[28px] leading-[34px]">{emoji}</Text>
                </Pressable>
              );
            })}
          </View>
          <ScrollView>
            {reacted.length > 0 ? (
              <View className="mt-2">
                <Text className="mb-1 font-sans-semibold text-[12px] uppercase text-muted">
                  {t("chat.details.reactions")}
                </Text>
                {reacted.map((entry) => (
                  <View
                    key={entry.userId}
                    testID={`message-details-reacted-${entry.userId}`}
                    className="flex-row items-center justify-between border-b border-line py-2.5"
                  >
                    <Text
                      className="mr-3 min-w-0 flex-1 font-sans text-[14px] text-ink"
                      numberOfLines={1}
                    >
                      {reactorName(entry.userId, entry.name)}
                    </Text>
                    <Text className="text-[18px]">{entry.emoji}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            <View className="mt-4">
              <Text className="mb-1 font-sans-semibold text-[12px] uppercase text-muted">
                {t("chat.details.seenBy")}
              </Text>
              {readers.length === 0 ? (
                <Text
                  testID="message-details-seen-empty"
                  className="py-4 text-center font-sans text-[13px] text-muted"
                >
                  {t("chat.details.nobodySeen")}
                </Text>
              ) : null}
              {/* Names only: a read marker says how far someone has read, not when they saw
                  this message. */}
              {readers.map(({ member }) => (
                <View
                  key={member.id}
                  testID={`message-details-seen-${member.id}`}
                  className="border-b border-line py-2.5"
                >
                  <Text
                    className="font-sans text-[14px] text-ink"
                    numberOfLines={1}
                  >
                    {chatPersonName(member.name, member.state, t)}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
