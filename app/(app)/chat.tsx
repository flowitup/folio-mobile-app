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
  useChatMessages,
  useMarkChatRead,
  useSendChatMessage,
} from "@/features/chat/chat-api";
import { ChatComposer } from "@/features/chat/chat-composer";
import { ChatMessageList } from "@/features/chat/chat-message-list";
import type { PickedFile } from "@/lib/files/pick";
import { seenByMessage } from "@/lib/chat/seen-by";
import { useTokens, workerColor } from "@/theme/tokens";

/**
 * Chat overlay (design 2a): header with the channel name, member count and stacked avatars,
 * channel chips (unread dot), message list anchored to the bottom, composer with image
 * picker / camera / microphone / send. Pushed over the tab shell; the back arrow closes it.
 */
export default function ChatScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const tokens = useTokens();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ channel?: string }>();
  const enabled = useChatEnabled();
  const channels = useChatChannels(enabled, 15_000);
  const [selected, setSelected] = useState<string | null>(
    params.channel ?? null,
  );
  const channelKey =
    selected && (channels.data ?? []).some((c) => c.key === selected)
      ? selected
      : (channels.data?.[0]?.key ?? null);
  const messages = useChatMessages(channelKey);
  const markRead = useMarkChatRead();
  const send = useSendChatMessage(channelKey ?? "");
  const scrollRef = useRef<ScrollView>(null);

  const channel = useMemo(
    () => (channels.data ?? []).find((c) => c.key === channelKey) ?? null,
    [channels.data, channelKey],
  );
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
  async function submit(message: {
    body: string;
    file: PickedFile | null;
  }): Promise<void> {
    await send.mutateAsync(message);
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
            {channel?.name ?? t("chat.title")}
          </Text>
          <Text className="font-sans text-[11.5px] text-muted">
            {channel
              ? t("chat.membersCount", { count: channel.member_count })
              : ""}
          </Text>
        </View>
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
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="max-h-[53px] border-b border-line"
        contentContainerClassName="flex-row items-center gap-1.5 px-4 py-2.5"
      >
        {(channels.data ?? []).map((item) => {
          const active = item.key === channelKey;
          return (
            <Pressable
              key={item.key}
              testID={`chat-channel-${item.key}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setSelected(item.key)}
              className={`h-8 flex-row items-center gap-1.5 rounded-full border px-3 active:opacity-70 ${active ? "border-ink bg-ink" : "border-line bg-card"}`}
            >
              <Text
                className={`font-sans-medium text-[12.5px] ${active ? "text-on-ink" : "text-ink"}`}
                numberOfLines={1}
              >
                {item.name}
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
          {!enabled && channels.isFetched ? (
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
            <ChatMessageList messages={items} seen={seen} />
          ) : null}
        </ScrollView>

        <ChatComposer
          disabled={!channelKey}
          sending={send.isPending}
          onSend={submit}
        />
      </KeyboardAvoidingView>
    </View>
  );
}
