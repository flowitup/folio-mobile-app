import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Avatar } from "@/components/ui/avatar";
import { AuthedImage } from "@/components/ui/authed-image";
import { Icon } from "@/components/ui/icon";
import type { ChatMessage } from "@/features/chat/chat-api";
import {
  dayDividerLabel,
  groupMessagesByDay,
  showsSender,
  timeOf,
} from "@/lib/chat/group-messages-by-day";
import { useTokens, workerColor } from "@/theme/tokens";

/** Stable avatar color per sender, cycling the design palette. */
function senderColor(
  senderId: string,
  tokens: ReturnType<typeof useTokens>,
): string {
  let hash = 0;
  for (const char of senderId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return workerColor(tokens, null, hash);
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** One bubble row: incoming = avatar + name + card bubble; mine = positive bubble on the right. */
function MessageRow({
  message,
  showSender,
}: {
  message: ChatMessage;
  showSender: boolean;
}) {
  const tokens = useTokens();
  const mine = message.mine;
  return (
    <View
      className={`flex-row items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}
    >
      {!mine ? (
        <View className="w-7">
          {showSender ? (
            <Avatar
              name={message.sender_name}
              size={28}
              color={senderColor(message.sender_id, tokens)}
            />
          ) : null}
        </View>
      ) : null}
      <View
        className={`max-w-[76%] gap-[3px] ${mine ? "items-end" : "items-start"}`}
      >
        {showSender ? (
          <Text className="pl-1 font-sans text-[11px] text-muted">
            {message.sender_name}
          </Text>
        ) : null}
        {message.body ? (
          <View
            className={`px-3 py-[9px] ${mine ? "bg-positive" : "border border-line bg-card"}`}
            style={{
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              borderBottomLeftRadius: mine ? 16 : 4,
              borderBottomRightRadius: mine ? 4 : 16,
            }}
          >
            <Text
              className={`font-sans text-[14px] leading-5 ${mine ? "text-white" : "text-ink"}`}
            >
              {message.body}
            </Text>
          </View>
        ) : null}
        {message.attachment ? (
          <View className="w-[200px] overflow-hidden rounded-[14px] border border-line bg-card">
            <View className="h-[120px] items-center justify-center bg-paper-2">
              <AuthedImage
                path={message.attachment.url}
                style={{ width: 200, height: 120 }}
                resizeMode="cover"
                accessibilityLabel={message.attachment.filename}
              />
              <View className="absolute" pointerEvents="none">
                <Icon name="image" size={28} color={tokens.muted} />
              </View>
            </View>
            <Text
              className="px-2.5 py-1.5 font-mono-regular text-[11px] text-muted"
              numberOfLines={1}
            >
              {message.attachment.filename} ·{" "}
              {formatSize(message.attachment.size_bytes)}
            </Text>
          </View>
        ) : null}
        <Text className="px-1 font-sans text-[10px] text-muted-2">
          {timeOf(message.created_at)}
        </Text>
      </View>
    </View>
  );
}

/** Messages under day dividers, oldest first (the parent scrolls to the end). */
export function ChatMessageList({ messages }: { messages: ChatMessage[] }) {
  const { t } = useTranslation();
  const groups = groupMessagesByDay(messages);
  return (
    <View className="gap-2.5" testID="chat-message-list">
      {groups.map((group) => {
        const label = dayDividerLabel(group.dayKey);
        return (
          <View key={group.dayKey} className="gap-2.5">
            <Text className="mb-1 text-center font-sans text-[11px] text-muted">
              {"token" in label ? t(`chat.${label.token}`) : label.date}
              {" · "}
              {`${group.dayKey.slice(8, 10)}/${group.dayKey.slice(5, 7)}`}
            </Text>
            {group.messages.map((message, index) => (
              <MessageRow
                key={message.id}
                message={message}
                showSender={showsSender(group.messages, index)}
              />
            ))}
          </View>
        );
      })}
    </View>
  );
}
