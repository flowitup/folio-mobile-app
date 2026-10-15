import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/auth/auth-context";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { showToast } from "@/components/ui/toast";
import { EmptyState, ErrorState } from "@/components/ui/primitives";
import {
  useBlockChatUser,
  useBlockedUsers,
  useChatChannels,
  useChatEnabled,
  useFeatures,
  useChatMessages,
  useMarkChatRead,
  useReportChatMessage,
  useSendChatMessage,
  useToggleChatReaction,
} from "@/features/chat/chat-api";
import { BlockedUsersSheet } from "@/features/chat/blocked-users-sheet";
import { ChatComposer } from "@/features/chat/chat-composer";
import { ChatMessageList } from "@/features/chat/chat-message-list";
import { MessageDetailsSheet } from "@/features/chat/message-details-sheet";
import type { PickedFile } from "@/lib/files/pick";
import type { SupportedLocale } from "@/i18n";
import { seenByMessage } from "@/lib/chat/seen-by";
import { useChatColors } from "@/features/chat/chat-colors";
import { useTokens, workerColor } from "@/theme/tokens";

/** Stable avatar color per conversation, cycling the design palette. */
function channelColor(tokens: ReturnType<typeof useTokens>, key: string) {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return workerColor(tokens, null, hash);
}

/**
 * Chat overlay, Messenger style: a conversation list (avatar, name, unread) and a thread with
 * a header (avatar, name, members), message list anchored to the bottom and a composer with
 * image picker / camera / microphone / send. Pushed over the tab shell; in a thread the back
 * arrow returns to the list, on the list (or with a single channel) it closes the overlay.
 */
export default function ChatScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const tokens = useTokens();
  const colors = useChatColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ channel?: string }>();
  const enabled = useChatEnabled();
  // `enabled` is false both while the flag is loading and when chat is off, so the
  // features query is what says which — see the disabled branch below.
  const features = useFeatures();
  const channels = useChatChannels(enabled, 15_000);
  const channelList = useMemo(() => channels.data ?? [], [channels.data]);
  const [selected, setSelected] = useState<string | null>(
    params.channel ?? null,
  );
  // Opened without a deep link: start on the conversation list (skipped with a single channel).
  const [showList, setShowList] = useState(!params.channel);
  // A push or bell tap while the chat is already open only changes the route params; follow
  // them (adjusting state during render, keyed on the param), or the screen keeps showing the
  // conversation it was on.
  const [seenParam, setSeenParam] = useState(params.channel);
  if (params.channel !== seenParam) {
    setSeenParam(params.channel);
    if (params.channel) {
      setSelected(params.channel);
      setShowList(false);
    }
  }
  // The requested channel can be newer than the cached list (a project the user was just added
  // to). Wait for a fresh list instead of falling back to the first channel, which showed an
  // unrelated, often empty, conversation until the next poll.
  const selectedKnown = Boolean(
    selected && channelList.some((c) => c.key === selected),
  );
  const waitingForChannel =
    Boolean(selected) && !selectedKnown && channels.isFetching;
  const channelKey = selectedKnown
    ? selected
    : waitingForChannel
      ? null
      : (channelList[0]?.key ?? null);
  const listVisible = showList && channelList.length > 1;
  const canGoToList = channelList.length > 1;
  const blocked = useBlockedUsers(enabled);
  const report = useReportChatMessage();
  const block = useBlockChatUser();
  const [blockedOpen, setBlockedOpen] = useState(false);
  const messages = useChatMessages(channelKey);
  const markRead = useMarkChatRead();
  const send = useSendChatMessage(channelKey ?? "");
  const react = useToggleChatReaction(channelKey ?? "", user?.id);
  // The message whose details sheet is open; looked up in the live page so it tracks each poll.
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const channel = useMemo(
    () => channelList.find((c) => c.key === channelKey) ?? null,
    [channelList, channelKey],
  );
  const members = messages.data?.members ?? [];
  const items = messages.data?.items ?? [];
  const detailsMessage = detailsId
    ? (items.find((m) => m.id === detailsId) ?? null)
    : null;
  const lastMessageId = items[items.length - 1]?.id;
  const lastMessageMine = items[items.length - 1]?.mine ?? true;
  // Who has read up to which message ("seen" avatars); recomputed on every poll.
  const seen = useMemo(
    () =>
      seenByMessage(
        messages.data?.items ?? [],
        messages.data?.members ?? [],
        user?.id,
      ),
    [messages.data, user?.id],
  );

  // Opening (or switching to) a channel clears its unread marker.
  useEffect(() => {
    if (channelKey) markRead.mutate({ channelKey });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelKey]);
  // Keep the list anchored to the newest message; an incoming one is read since the screen is open,
  // so move the marker too (that is what shows this reader's avatar on the sender's side).
  useEffect(() => {
    if (lastMessageId) scrollRef.current?.scrollToEnd({ animated: false });
    if (lastMessageId && !lastMessageMine && channelKey)
      markRead.mutate({ channelKey });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMessageId]);

  // Sending implies having read the channel; the composer clears itself once this resolves.
  // `lang` (the reader's UI language) goes on every send.
  async function submit(message: {
    body: string;
    file: PickedFile | null;
  }): Promise<void> {
    await send.mutateAsync({
      ...message,
      lang: i18n.language as SupportedLocale,
    });
    if (channelKey) markRead.mutate({ channelKey });
  }

  return (
    <View className="flex-1 bg-card" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-2 border-b border-line px-3 py-2">
        <Pressable
          testID="chat-close"
          accessibilityRole="button"
          onPress={() => {
            if (!listVisible && canGoToList) {
              setShowList(true);
              return;
            }
            if (router.canGoBack()) router.back();
            else router.navigate("/(app)/(tabs)");
          }}
          hitSlop={8}
          className="-ml-1.5 h-10 w-10 items-center justify-center active:opacity-70"
        >
          <Icon name="chevron-left" size={24} color={colors.blue} />
        </Pressable>
        {listVisible ? (
          <Text
            className="flex-1 font-sans-semibold text-[22px] text-ink"
            testID="chat-title"
          >
            {t("chat.title")}
          </Text>
        ) : (
          <>
            {channel ? (
              <Avatar
                name={channel.name}
                size={38}
                color={channelColor(tokens, channel.key)}
              />
            ) : null}
            <View className="min-w-0 flex-1">
              <Text
                className="font-sans-semibold text-[15.5px] text-ink"
                numberOfLines={1}
                testID="chat-title"
              >
                {channel?.name ?? t("chat.title")}
              </Text>
              <Text
                className="font-sans text-[12px] text-muted"
                numberOfLines={1}
              >
                {channel
                  ? [
                      t("chat.membersCount", { count: channel.member_count }),
                      ...members.slice(0, 3).map((m) => m.name),
                    ].join(" · ")
                  : ""}
              </Text>
            </View>
            {(blocked.data?.length ?? 0) > 0 ? (
              <Pressable
                testID="chat-blocked-open"
                accessibilityRole="button"
                onPress={() => setBlockedOpen(true)}
                hitSlop={8}
                className="rounded-full border border-line px-2.5 py-1 active:opacity-70"
              >
                <Text className="font-sans-medium text-[11.5px] text-ink">
                  {t("chat.moderation.manage")} ({blocked.data?.length})
                </Text>
              </Pressable>
            ) : null}
          </>
        )}
      </View>

      {listVisible ? (
        <ScrollView testID="chat-list-screen" className="flex-1">
          <View className="gap-0.5 px-2 py-2">
            {channelList.map((item) => {
              const active = item.key === channelKey;
              const unread = item.unread_count > 0;
              return (
                <Pressable
                  key={item.key}
                  testID={`chat-channel-${item.key}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    setSelected(item.key);
                    setShowList(false);
                  }}
                  className="flex-row items-center gap-3 rounded-xl px-2.5 py-2 active:opacity-70"
                >
                  <Avatar
                    name={item.name}
                    size={48}
                    color={channelColor(tokens, item.key)}
                  />
                  <View className="min-w-0 flex-1">
                    <Text
                      className={`text-[15px] text-ink ${unread ? "font-sans-semibold" : "font-sans-medium"}`}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    <Text
                      className="font-sans text-[12.5px] text-muted"
                      numberOfLines={1}
                    >
                      {t(
                        item.kind === "company"
                          ? "chat.kindCompany"
                          : "chat.kindProject",
                      )}{" "}
                      · {t("chat.membersCount", { count: item.member_count })}
                    </Text>
                  </View>
                  {unread ? (
                    <View
                      testID={`chat-unread-${item.key}`}
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: colors.blue }}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      ) : null}

      {/* Android renders edge-to-edge (no window resize on keyboard), so pad on both platforms. */}
      {!listVisible ? (
        <KeyboardAvoidingView behavior="padding" className="flex-1">
          <ScrollView
            ref={scrollRef}
            className="flex-1"
            contentContainerClassName="flex-grow justify-end p-4"
            onContentSizeChange={() =>
              scrollRef.current?.scrollToEnd({ animated: false })
            }
          >
            {/* Gated on the FEATURES query, not the channels one. `useChatChannels` is
              passed `enabled`, so when chat is off the channels query never runs and
              `channels.isFetched` stays false forever — the old condition could never
              be true, and the screen sat blank instead of saying chat was disabled. */}
            {features.isPending ? (
              <ActivityIndicator className="my-6" color={tokens.ink} />
            ) : null}
            {!enabled && features.isFetched ? (
              <EmptyState message={t("chat.disabled")} />
            ) : null}
            {(messages.isPending && channelKey) || waitingForChannel ? (
              <ActivityIndicator className="my-6" color={tokens.ink} />
            ) : null}
            {messages.isError ? (
              <ErrorState
                message={t("common.loadError")}
                retryLabel={t("common.retry")}
                onRetry={() => void messages.refetch()}
              />
            ) : null}
            {messages.data && items.length === 0 ? (
              <Text className="my-6 text-center font-sans text-[13px] text-muted">
                {t("chat.empty")}
              </Text>
            ) : null}
            {items.length > 0 ? (
              <ChatMessageList
                messages={items}
                seen={seen}
                viewerId={user?.id}
                onOpenDetails={setDetailsId}
                onReact={(messageId, emoji) =>
                  react.mutate({ messageId, emoji })
                }
                onReport={(messageId) =>
                  report.mutate(
                    { messageId },
                    {
                      onSuccess: () =>
                        showToast(t("chat.moderation.reported"), "success"),
                    },
                  )
                }
                onBlock={(userId) =>
                  block.mutate(
                    { userId },
                    {
                      onSuccess: () =>
                        showToast(t("chat.moderation.blocked"), "success"),
                    },
                  )
                }
              />
            ) : null}
          </ScrollView>

          <ChatComposer
            disabled={!channelKey}
            sending={send.isPending}
            onSend={submit}
          />
        </KeyboardAvoidingView>
      ) : null}
      <MessageDetailsSheet
        message={detailsMessage}
        members={members}
        viewerId={user?.id}
        onReact={(messageId, emoji) => react.mutate({ messageId, emoji })}
        onClose={() => setDetailsId(null)}
      />
      <BlockedUsersSheet
        visible={blockedOpen}
        onClose={() => setBlockedOpen(false)}
      />
    </View>
  );
}
