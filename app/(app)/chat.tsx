import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { EmptyState, ErrorState } from "@/components/ui/primitives";
import { showToast } from "@/components/ui/toast";
import {
  useChatChannels,
  useChatEnabled,
  useChatMessages,
  useMarkChatRead,
  useSendChatMessage,
} from "@/features/chat/chat-api";
import { ChatMessageList } from "@/features/chat/chat-message-list";
import { captureImage, pickImages } from "@/lib/files/pick";
import type { PickedFile } from "@/lib/files/pick";
import { useTokens, workerColor } from "@/theme/tokens";

/**
 * Chat overlay (design 2a): header with the channel name, member count and stacked avatars,
 * channel chips (unread dot), message list anchored to the bottom, composer with image
 * picker / camera / send. Pushed over the tab shell; the back arrow closes it.
 */
export default function ChatScreen() {
  const { t } = useTranslation();
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
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState<PickedFile | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const channel = useMemo(
    () => (channels.data ?? []).find((c) => c.key === channelKey) ?? null,
    [channels.data, channelKey],
  );
  const members = messages.data?.members ?? [];
  const items = messages.data?.items ?? [];
  const lastMessageId = items[items.length - 1]?.id;

  // Opening (or switching to) a channel clears its unread marker.
  useEffect(() => {
    if (channelKey) markRead.mutate({ channelKey });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelKey]);
  // Keep the list anchored to the newest message.
  useEffect(() => {
    if (lastMessageId) scrollRef.current?.scrollToEnd({ animated: false });
  }, [lastMessageId]);

  const canSend =
    Boolean(channelKey) &&
    (draft.trim().length > 0 || file !== null) &&
    !send.isPending;

  function submit() {
    if (!canSend) return;
    send.mutate(
      { body: draft, file },
      {
        onSuccess: () => {
          setDraft("");
          setFile(null);
          if (channelKey) markRead.mutate({ channelKey });
        },
      },
    );
  }

  async function attach(source: "camera" | "library") {
    const result =
      source === "camera" ? await captureImage() : await pickImages(false);
    if (result.status === "picked" && result.files[0]) setFile(result.files[0]);
    else if (result.status === "denied")
      showToast(t("chat.permissionDenied"), "error");
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

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
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
          {items.length > 0 ? <ChatMessageList messages={items} /> : null}
        </ScrollView>

        {file ? (
          <View className="flex-row items-center gap-2 border-t border-line bg-paper px-4 py-2">
            <Icon name="image" size={16} color={tokens.muted} />
            <Text
              className="flex-1 font-mono-regular text-[11px] text-muted"
              numberOfLines={1}
            >
              {file.name}
            </Text>
            <Pressable
              testID="chat-remove-file"
              onPress={() => setFile(null)}
              hitSlop={8}
            >
              <Icon name="x" size={16} color={tokens.muted} />
            </Pressable>
          </View>
        ) : null}
        <View
          className="flex-row items-center gap-2 border-t border-line bg-paper px-3 pt-2.5"
          style={{ paddingBottom: Math.max(insets.bottom, 12) }}
        >
          <Pressable
            testID="chat-attach"
            accessibilityRole="button"
            accessibilityLabel={t("chat.attachImage")}
            onPress={() => void attach("library")}
            className="h-10 w-10 items-center justify-center rounded-full active:opacity-70"
          >
            <Icon name="plus" size={22} color={tokens.ink} />
          </Pressable>
          <TextInput
            testID="chat-input"
            className="h-[42px] flex-1 rounded-full border border-line-2 bg-card px-3.5 font-sans text-[14px] text-ink"
            placeholder={t("chat.placeholder")}
            placeholderTextColor={tokens.muted}
            value={draft}
            onChangeText={setDraft}
            multiline={false}
            returnKeyType="send"
            onSubmitEditing={submit}
          />
          <Pressable
            testID="chat-camera"
            accessibilityRole="button"
            accessibilityLabel={t("chat.takePhoto")}
            onPress={() => void attach("camera")}
            className="h-10 w-10 items-center justify-center active:opacity-70"
          >
            <Icon name="camera" size={22} color={tokens.ink} />
          </Pressable>
          <Pressable
            testID="chat-send"
            accessibilityRole="button"
            accessibilityLabel={t("chat.send")}
            disabled={!canSend}
            onPress={submit}
            className={`h-10 w-10 items-center justify-center rounded-full bg-positive ${canSend ? "active:opacity-70" : "opacity-50"}`}
          >
            {send.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Icon name="send" size={18} color="#ffffff" />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
