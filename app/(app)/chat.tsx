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
import { EmptyState, ErrorState } from "@/components/ui/primitives";
import {
  useChatChannels,
  useChatEnabled,
  useFeatures,
  useChatMessages,
  useMarkChatRead,
  useSendChatMessage,
} from "@/features/chat/chat-api";
import { ChatComposer } from "@/features/chat/chat-composer";
import { ChatMessageList } from "@/features/chat/chat-message-list";
import type { PickedFile } from "@/lib/files/pick";
import type { SupportedLocale } from "@/i18n";
import { orderChannels } from "@/lib/chat/assistant";
import { seenByMessage } from "@/lib/chat/seen-by";
import { useTokens, workerColor } from "@/theme/tokens";

/**
 * Chat overlay (design 2a): header with the channel name, member count and stacked avatars,
 * channel chips (unread dot), message list anchored to the bottom, composer with image
 * picker / camera / microphone / send. Pushed over the tab shell; the back arrow closes it.
 */
export default function ChatScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const tokens = useTokens();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ channel?: string }>();
  const enabled = useChatEnabled();
  // `enabled` is false both while the flag is loading and when chat is off, so the
  // features query is what says which — see the disabled branch below.
  const features = useFeatures();
  const channels = useChatChannels(enabled, 15_000);
  // The API already lists the assistant channel first; this only guarantees it, never
  // otherwise reorders what the server sent.
  const orderedChannels = useMemo(
    () => orderChannels(channels.data ?? []),
    [channels.data],
  );
  const [selected, setSelected] = useState<string | null>(
    params.channel ?? null,
  );
  const channelKey =
    selected && orderedChannels.some((c) => c.key === selected)
      ? selected
      : (orderedChannels[0]?.key ?? null);
  const messages = useChatMessages(channelKey);
  const markRead = useMarkChatRead();
  const send = useSendChatMessage(channelKey ?? "");
  const scrollRef = useRef<ScrollView>(null);

  const channel = useMemo(
    () => orderedChannels.find((c) => c.key === channelKey) ?? null,
    [orderedChannels, channelKey],
  );
  const isAssistantChannel = channel?.kind === "assistant";
  const members = messages.data?.members ?? [];
  const items = messages.data?.items ?? [];
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
  // `lang` goes only to the assistant channel: the backend keeps it there, and a server that
  // predates the assistant rejects unknown JSON fields on the other channels.
  async function submit(message: {
    body: string;
    file: PickedFile | null;
  }): Promise<void> {
    await send.mutateAsync({
      ...message,
      ...(isAssistantChannel ? { lang: i18n.language as SupportedLocale } : {}),
    });
    if (channelKey) markRead.mutate({ channelKey });
  }

  return (
    <View className="flex-1 bg-paper" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-2 border-b border-line px-3 py-2">
        <Pressable
          testID="chat-close"
          accessibilityRole="button"
          onPress={() =>
            router.canGoBack()
              ? router.back()
              : router.navigate("/(app)/(tabs)")
          }
          hitSlop={8}
          className="-ml-1.5 h-10 w-10 items-center justify-center active:opacity-70"
        >
          <Icon name="chevron-left" size={22} color={tokens.ink} />
        </Pressable>
        <View className="min-w-0 flex-1">
          <Text
            className="font-sans-semibold text-[15px] text-ink"
            numberOfLines={1}
            testID="chat-title"
          >
            {isAssistantChannel
              ? t("assistant.title")
              : (channel?.name ?? t("chat.title"))}
          </Text>
          <Text className="font-sans text-[11.5px] text-muted">
            {isAssistantChannel
              ? t("assistant.subtitle")
              : channel
                ? t("chat.membersCount", { count: channel.member_count })
                : ""}
          </Text>
        </View>
        {!isAssistantChannel ? (
          <View className="flex-row">
            {members.slice(0, 2).map((member, index) => (
              <View
                key={member.id}
                style={{ marginLeft: index === 0 ? 0 : -8 }}
                className="rounded-full border-2 border-paper"
              >
                <Avatar
                  name={member.name}
                  size={26}
                  color={workerColor(tokens, null, index === 0 ? 0 : 3)}
                />
              </View>
            ))}
            {members.length > 2 ? (
              <View className="-ml-2 h-[26px] min-w-[26px] items-center justify-center rounded-full border-2 border-paper bg-paper-2 px-1">
                <Text className="font-sans-semibold text-[11px] text-ink">
                  +{members.length - 2}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      {/* Hidden when there is nothing to pick: with no channels this still drew its
          padding and bottom rule, leaving an empty 53px bar under the header. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className={`max-h-[53px] border-b border-line ${orderedChannels.length === 0 ? "hidden" : ""}`}
        contentContainerClassName="flex-row items-center gap-1.5 px-4 py-2.5"
      >
        {orderedChannels.map((item) => {
          const active = item.key === channelKey;
          const isAssistant = item.kind === "assistant";
          return (
            <Pressable
              key={item.key}
              testID={`chat-channel-${item.key}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setSelected(item.key)}
              className={`h-8 flex-row items-center gap-1.5 rounded-full border px-3 active:opacity-70 ${active ? "border-ink bg-ink" : "border-line bg-card"}`}
            >
              {isAssistant ? (
                <Icon
                  name="cpu"
                  size={13}
                  color={active ? tokens.onInk : tokens.ink}
                />
              ) : null}
              <Text
                className={`font-sans-medium text-[12.5px] ${active ? "text-on-ink" : "text-ink"}`}
                numberOfLines={1}
              >
                {isAssistant ? t("assistant.title") : item.name}
              </Text>
              {item.unread_count > 0 && !active ? (
                <View className="h-1.5 w-1.5 rounded-full bg-accent" />
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Android renders edge-to-edge (no window resize on keyboard), so pad on both platforms. */}
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
          {messages.isPending && channelKey ? (
            <ActivityIndicator className="my-6" color={tokens.ink} />
          ) : null}
          {messages.isError ? (
            <ErrorState
              message={t("home.loadError")}
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
            <ChatMessageList messages={items} seen={seen} channel={channel} />
          ) : null}
        </ScrollView>

        <ChatComposer
          disabled={!channelKey}
          sending={send.isPending}
          onSend={submit}
          primaryCamera={isAssistantChannel}
        />
      </KeyboardAvoidingView>
    </View>
  );
}
