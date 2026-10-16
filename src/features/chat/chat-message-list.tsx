import { useTranslation } from "react-i18next";
import { useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

import { Avatar } from "@/components/ui/avatar";
import { AuthedImage } from "@/components/ui/authed-image";
import { Icon } from "@/components/ui/icon";
import type { ChatMember, ChatMessage } from "@/features/chat/chat-api";
import { bubbleRadii, useChatColors } from "@/features/chat/chat-colors";
import { ChatVoiceBubble } from "@/features/chat/chat-voice-note";
import { formatFileSize } from "@/lib/format/file-size";
import {
  dayDividerLabel,
  endsRun,
  groupMessagesByDay,
  showsSender,
  timeOf,
} from "@/lib/chat/group-messages-by-day";
import {
  REACTION_EMOJIS,
  isReactionEmoji,
  reactionCounts,
} from "@/lib/chat/reactions";
import type { ReactionEmoji } from "@/lib/chat/reactions";
import { chatPersonName } from "@/lib/chat/person-name";
import { isVoiceNote } from "@/lib/chat/voice-note";
import { useTokens, workerColor } from "@/theme/tokens";

/** Stable avatar color per sender, cycling the design palette; a message with no `sender_id`
 * (a legacy system/assistant row from the backend) gets a fixed accent color. */
function senderColor(
  senderId: string | null,
  tokens: ReturnType<typeof useTokens>,
): string {
  if (senderId === null) return tokens.accent;
  let hash = 0;
  for (const char of senderId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return workerColor(tokens, null, hash);
}

/** Tiny overlapping avatars of the members whose read marker stops at this message. */
function SeenBy({ members, mine }: { members: ChatMember[]; mine: boolean }) {
  const { t } = useTranslation();
  const tokens = useTokens();
  const shown = members.slice(0, 4);
  return (
    <View
      testID="chat-seen-by"
      accessibilityLabel={t("chat.seenBy", {
        names: members.map((m) => chatPersonName(m.name, m.state, t)).join(", "),
      })}
      className={`flex-row items-center px-1 ${mine ? "justify-end" : "justify-start"}`}
    >
      {shown.map((member, index) => (
        <View
          key={member.id}
          style={{ marginLeft: index === 0 ? 0 : 2 }}
          className="rounded-full border border-paper"
        >
          <Avatar
            name={member.name}
            size={16}
            color={senderColor(member.id, tokens)}
          />
        </View>
      ))}
      {members.length > shown.length ? (
        <Text className="ml-1 font-sans text-[10px] text-muted-2">
          +{members.length - shown.length}
        </Text>
      ) : null}
    </View>
  );
}

/** Emoji + count chips under a bubble; the viewer's own one is highlighted, a tap toggles it. */
function ReactionChips({
  message,
  viewerId,
  onReact,
}: {
  message: ChatMessage;
  viewerId: string | null | undefined;
  onReact: (messageId: string, emoji: ReactionEmoji) => void;
}) {
  const { t } = useTranslation();
  const counts = reactionCounts(message.reactions, viewerId);
  if (counts.length === 0) return null;
  return (
    <View
      className={`z-10 -mt-2 flex-row flex-wrap gap-1 px-2 ${message.mine ? "justify-end" : "justify-start"}`}
    >
      {counts.map(({ emoji, count, mine }) => {
        const known = isReactionEmoji(emoji);
        return (
          <Pressable
            key={emoji}
            testID={`chat-reaction-${message.id}-${(REACTION_EMOJIS as readonly string[]).indexOf(emoji)}`}
            onPress={known ? () => onReact(message.id, emoji) : undefined}
            disabled={!known}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={t("chat.details.chip", { emoji, count })}
            accessibilityState={{ selected: mine }}
            className={`h-6 flex-row items-center gap-1 rounded-full border px-2 active:opacity-70 ${mine ? "border-[#0084ff] bg-[#e5f1ff]" : "border-line bg-card"}`}
          >
            <Text className="text-[12px] leading-4">{emoji}</Text>
            <Text
              className={`font-sans-medium text-[11px] ${mine ? "text-[#0084ff]" : "text-muted"}`}
            >
              {count}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Full-screen view of a chat picture; tap anywhere or use the close button to dismiss. */
function ChatImageViewer({
  path,
  filename,
  visible,
  onClose,
}: {
  path: string;
  filename: string;
  visible: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  return (
    <Modal
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        testID="chat-image-viewer"
        onPress={onClose}
        className="flex-1 items-center justify-center bg-black"
      >
        <AuthedImage
          path={path}
          style={{ width, height }}
          resizeMode="contain"
          accessibilityLabel={filename}
        />
        <Pressable
          testID="chat-image-viewer-close"
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t("common.close")}
          className="absolute right-4 top-12 rounded-full bg-black/60 px-3 py-1"
        >
          <Text className="text-lg text-white">✕</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/**
 * One bubble row (Messenger look): mine = blue bubble on the right, incoming = grey bubble on
 * the left with the avatar beside the last bubble of a run and the name above the first.
 */
function MessageRow({
  message,
  showSender,
  lastOfRun,
  gapBefore,
  seenBy,
  viewerId,
  onReport,
  onBlock,
  onOpenDetails,
  onReact,
}: {
  message: ChatMessage;
  showSender: boolean;
  lastOfRun: boolean;
  gapBefore: boolean;
  seenBy: ChatMember[] | undefined;
  viewerId: string | null | undefined;
  onReport?: (messageId: string) => void;
  onBlock?: (userId: string) => void;
  onOpenDetails?: (messageId: string) => void;
  onReact?: (messageId: string, emoji: ReactionEmoji) => void;
}) {
  const { t } = useTranslation();
  const tokens = useTokens();
  const colors = useChatColors();
  const [viewing, setViewing] = useState(false);
  const mine = message.mine;
  // Someone else's message can be reported or its sender blocked (App Store 1.2).
  const senderId = message.sender_id;
  const senderName = chatPersonName(message.sender_name, message.sender_state, t);
  // An erased account can neither be reported nor blocked: nobody is behind it any more.
  const canModerate =
    !mine &&
    senderId !== null &&
    senderId !== undefined &&
    message.sender_state !== "deleted" &&
    onReport !== undefined &&
    onBlock !== undefined;
  // Only people's messages open the details sheet and carry reactions, not legacy bot rows.
  const openDetails =
    message.sender_type === "user" && onOpenDetails
      ? () => onOpenDetails(message.id)
      : undefined;
  const openMenu = () => {
    if (!canModerate) return;
    Alert.alert(senderName, undefined, [
      {
        text: t("chat.moderation.report"),
        onPress: () =>
          Alert.alert(
            t("chat.moderation.reportTitle"),
            t("chat.moderation.reportBody"),
            [
              { text: t("common.cancel"), style: "cancel" },
              {
                text: t("chat.moderation.report"),
                style: "destructive",
                onPress: () => onReport?.(message.id),
              },
            ],
          ),
      },
      {
        text: t("chat.moderation.block", { name: senderName }),
        style: "destructive",
        onPress: () =>
          Alert.alert(
            t("chat.moderation.blockTitle", { name: senderName }),
            t("chat.moderation.blockBody"),
            [
              { text: t("common.cancel"), style: "cancel" },
              {
                text: t("chat.moderation.blockConfirm"),
                style: "destructive",
                onPress: () => {
                  if (senderId) onBlock?.(senderId);
                },
              },
            ],
          ),
      },
      { text: t("common.cancel"), style: "cancel" },
    ]);
  };
  // Anything that is not a recording renders as the picture card, as it did before voice notes.
  const voiceNote =
    message.attachment !== null &&
    message.attachment !== undefined &&
    isVoiceNote(message.attachment.content_type);
  // Legacy backend rows (card/choice/job_status content, assistant sender) are no longer
  // rendered specially: whatever text they carry shows as a plain bubble.
  return (
    <View
      className={`flex-row items-end gap-2 ${gapBefore ? "mt-2" : ""} ${mine ? "justify-end" : "justify-start"}`}
    >
      {!mine ? (
        <View className="w-7">
          {lastOfRun ? (
            <Avatar
              name={senderName}
              size={28}
              color={senderColor(message.sender_id, tokens)}
            />
          ) : null}
        </View>
      ) : null}
      <View
        className={`max-w-[76%] gap-[2px] ${mine ? "items-end" : "items-start"}`}
      >
        {showSender ? (
          <Text className="pl-3 font-sans text-[11px] text-muted">
            {senderName}
          </Text>
        ) : null}
        {message.body ? (
          <Pressable
            testID={`chat-message-${message.id}`}
            onPress={openDetails}
            onLongPress={canModerate ? openMenu : undefined}
            delayLongPress={350}
            accessibilityRole={openDetails ? "button" : "text"}
            accessibilityHint={openDetails ? t("chat.details.open") : undefined}
            className="px-3.5 py-2"
            style={{
              backgroundColor: mine ? colors.blue : colors.bubble,
              ...bubbleRadii(mine, !showSender, !lastOfRun),
            }}
          >
            <Text
              className="font-sans text-[14.5px] leading-5"
              style={{ color: mine ? "#ffffff" : colors.bubbleText }}
            >
              {message.body}
            </Text>
          </Pressable>
        ) : null}
        {voiceNote && openDetails ? (
          // The play button keeps its own tap; the rest of the pill opens the details. Not an
          // accessibility element itself, or VoiceOver would swallow the play button inside it.
          <Pressable
            testID={`chat-voice-bubble-${message.id}`}
            onPress={openDetails}
            accessible={false}
          >
            <ChatVoiceBubble message={message} mine={mine} />
          </Pressable>
        ) : null}
        {voiceNote && !openDetails ? (
          <ChatVoiceBubble message={message} mine={mine} />
        ) : null}
        {message.attachment && !voiceNote ? (
          <Pressable
            testID="chat-attachment-image"
            onPress={() => setViewing(true)}
            // A tap opens the picture, so the details sheet is on a long press here.
            onLongPress={openDetails}
            delayLongPress={350}
            accessibilityRole="imagebutton"
            accessibilityLabel={message.attachment.filename}
            className="w-[200px] overflow-hidden rounded-[14px] border border-line bg-card"
          >
            <View className="h-[120px] items-center justify-center bg-paper-2">
              {/* Placeholder glyph sits under the image; it only shows until the bytes arrive. */}
              <Icon name="image" size={28} color={tokens.muted} />
              <AuthedImage
                path={message.attachment.url}
                style={{ position: "absolute", width: 200, height: 120 }}
                resizeMode="cover"
                accessibilityLabel={message.attachment.filename}
              />
            </View>
            <Text
              className="px-2.5 py-1.5 font-mono-regular text-[11px] text-muted"
              numberOfLines={1}
            >
              {message.attachment.filename} ·{" "}
              {formatFileSize(message.attachment.size_bytes)}
            </Text>
          </Pressable>
        ) : null}
        {message.attachment && !voiceNote ? (
          <ChatImageViewer
            path={message.attachment.url}
            filename={message.attachment.filename}
            visible={viewing}
            onClose={() => setViewing(false)}
          />
        ) : null}
        {message.sender_type === "user" && onReact ? (
          <ReactionChips
            message={message}
            viewerId={viewerId}
            onReact={onReact}
          />
        ) : null}
        <View
          className={`flex-row items-center gap-2 px-1 ${lastOfRun || canModerate ? "" : "hidden"}`}
        >
          {lastOfRun ? (
            <Text className="font-sans text-[10px] text-muted-2">
              {timeOf(message.created_at)}
            </Text>
          ) : null}
          {canModerate ? (
            <Pressable
              testID={`chat-message-menu-${message.id}`}
              onPress={openMenu}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t("chat.moderation.menu")}
            >
              <Text className="font-sans-semibold text-[13px] leading-[13px] text-muted">
                ⋯
              </Text>
            </Pressable>
          ) : null}
        </View>
        {seenBy && seenBy.length > 0 ? (
          <SeenBy members={seenBy} mine={mine} />
        ) : null}
      </View>
    </View>
  );
}

/**
 * Messages under day dividers, oldest first (the parent scrolls to the end).
 * `seen` maps a message id to the members whose read marker lands on it (see `seenByMessage`).
 */
export function ChatMessageList({
  messages,
  seen,
  viewerId,
  onReport,
  onBlock,
  onOpenDetails,
  onReact,
}: {
  messages: ChatMessage[];
  seen?: Map<string, ChatMember[]>;
  /** The signed-in user, whose own reaction chip is highlighted. */
  viewerId?: string | null;
  /** With both handlers, someone else's message gets a Report / Block menu (guideline 1.2). */
  onReport?: (messageId: string) => void;
  onBlock?: (userId: string) => void;
  /** Tap on a person's message bubble (long press on a picture): reactions and "seen by". */
  onOpenDetails?: (messageId: string) => void;
  /** Tap on a reaction chip: toggles the viewer's reaction to that emoji. */
  onReact?: (messageId: string, emoji: ReactionEmoji) => void;
}) {
  const { t } = useTranslation();
  const groups = groupMessagesByDay(messages);
  return (
    <View className="gap-2" testID="chat-message-list">
      {groups.map((group) => {
        const label = dayDividerLabel(group.dayKey);
        return (
          <View key={group.dayKey} className="gap-[3px]">
            <Text className="my-2 text-center font-sans-medium text-[11px] text-muted">
              {/* Today / Yesterday carry the date beside them; an older divider is already the date. */}
              {"token" in label
                ? `${t(`chat.${label.token}`)} · ${group.dayKey.slice(8, 10)}/${group.dayKey.slice(5, 7)}`
                : label.date}
            </Text>
            {group.messages.map((message, index) => (
              <MessageRow
                key={message.id}
                message={message}
                showSender={showsSender(group.messages, index)}
                lastOfRun={endsRun(group.messages, index)}
                gapBefore={index > 0 && endsRun(group.messages, index - 1)}
                seenBy={seen?.get(message.id)}
                viewerId={viewerId}
                onReport={onReport}
                onBlock={onBlock}
                onOpenDetails={onOpenDetails}
                onReact={onReact}
              />
            ))}
          </View>
        );
      })}
    </View>
  );
}
