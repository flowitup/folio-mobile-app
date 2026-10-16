import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePreventRemove } from "expo-router/react-navigation";

import { useAuth } from "@/auth/auth-context";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { showToast } from "@/components/ui/toast";
import { EmptyState, ErrorState } from "@/components/ui/primitives";
import {
  CHAT_OLDER_PAGE_SIZE,
  CHAT_PAGE_SIZE,
  chatKeys,
  fetchChatMessages,
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
import type { ChatMessage } from "@/features/chat/chat-api";
import { BlockedUsersSheet } from "@/features/chat/blocked-users-sheet";
import { ChatComposer } from "@/features/chat/chat-composer";
import { ChatMessageList } from "@/features/chat/chat-message-list";
import { MessageDetailsSheet } from "@/features/chat/message-details-sheet";
import type { PickedFile } from "@/lib/files/pick";
import type { SupportedLocale } from "@/i18n";
import { seenByMessage } from "@/lib/chat/seen-by";
import { mergeHistory, slidOut } from "@/lib/chat/merge-history";
import { chatPersonName } from "@/lib/chat/person-name";
import { ApiError } from "@/lib/query/api-error";
import { refreshKeys, usePullToRefresh } from "@/lib/query/use-pull-to-refresh";
import { useQueryClient } from "@tanstack/react-query";
import { useChatColors } from "@/features/chat/chat-colors";
import { useTokens, workerColor } from "@/theme/tokens";

/** How close to the end (px) still counts as "reading the newest messages". */
const NEAR_BOTTOM_PX = 80;

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
  // The conversation list: pulling re-reads the channels (a project just joined) and the flag.
  const pullToRefresh = usePullToRefresh([
    refreshKeys.chatChannels,
    refreshKeys.features,
  ]);
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
  const queryClient = useQueryClient();
  // The requested channel can be newer than the cached list (a project the user was just added
  // to): refetch the list once and wait for it. If it is still missing, the reader lost access
  // (removed from the project, or the link is stale): say so and show the list, instead of
  // silently opening another conversation.
  const selectedKnown = Boolean(
    selected && channelList.some((c) => c.key === selected),
  );
  const waitingForChannel = enabled && Boolean(selected) && !selectedKnown;
  const channelKey = selectedKnown
    ? selected
    : waitingForChannel
      ? null
      : (channelList[0]?.key ?? null);
  const listVisible = showList && channelList.length > 1;
  const canGoToList = channelList.length > 1;
  // Only a thread on screen is fetched, polled and marked read: the list shows unread dots, and
  // opening it must not mark the first conversation read for its senders.
  const activeKey = listVisible ? null : channelKey;
  const loseChannel = useCallback(
    (key: string) => {
      showToast(t("chat.noLongerAvailable"), "error");
      setSelected((current) => (current === key ? null : current));
      setShowList(true);
      void queryClient.invalidateQueries({ queryKey: chatKeys.channels });
    },
    [queryClient, t],
  );
  const refetchChannels = channels.refetch;
  useEffect(() => {
    if (!selected || selectedKnown || !channels.isSuccess) return;
    let cancelled = false;
    const key = selected;
    void refetchChannels().then((result) => {
      if (cancelled) return;
      if (!(result.data ?? []).some((c) => c.key === key)) loseChannel(key);
    });
    return () => {
      cancelled = true;
    };
    // Once per requested channel; a list that still lacks it must not loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, selectedKnown, channels.isSuccess]);
  const blocked = useBlockedUsers(enabled);
  const report = useReportChatMessage();
  const block = useBlockChatUser();
  const [blockedOpen, setBlockedOpen] = useState(false);
  const messages = useChatMessages(activeKey);
  const markRead = useMarkChatRead();
  const send = useSendChatMessage(activeKey ?? "");
  const react = useToggleChatReaction(activeKey ?? "", user?.id);
  // A thread answering 403/404 is one the reader was removed from.
  const lostStatus =
    messages.error instanceof ApiError &&
    (messages.error.status === 403 || messages.error.status === 404);
  useEffect(() => {
    // Reacts to the query's answer; there is no event to subscribe to instead.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (lostStatus && activeKey) loseChannel(activeKey);
  }, [lostStatus, activeKey, loseChannel]);

  // Unsent text per conversation, kept while the chat screen is open.
  // (A mutable map held in state: written on each keystroke, read when a thread mounts.)
  const [drafts] = useState(() => new Map<string, string>());

  // History older than the polled newest page, fetched on demand (oldest first). Reset when the
  // thread changes (adjusting state during render, keyed on the thread).
  const [older, setOlder] = useState<ChatMessage[]>([]);
  const [olderDone, setOlderDone] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [newBelow, setNewBelow] = useState(false);
  const [threadKey, setThreadKey] = useState(activeKey);
  if (threadKey !== activeKey) {
    setThreadKey(activeKey);
    setOlder([]);
    setOlderDone(false);
    setLoadingOlder(false);
    setNewBelow(false);
  }
  const activeKeyRef = useRef(activeKey);
  const atBottomRef = useRef(true);
  const prependRef = useRef<{ height: number; offset: number } | null>(null);
  const contentHeightRef = useRef(0);
  const offsetRef = useRef(0);
  useEffect(() => {
    activeKeyRef.current = activeKey;
    atBottomRef.current = true;
    prependRef.current = null;
  }, [activeKey]);

  // Newer messages push the oldest ones out of the polled page; once older history is shown,
  // keep them so there is no gap.
  const previousPage = useRef<ChatMessage[]>([]);
  useEffect(() => {
    const next = messages.data?.items ?? [];
    const gone = slidOut(previousPage.current, next);
    previousPage.current = next;
    if (gone.length > 0 && older.length > 0)
      setOlder((current) => mergeHistory(current, gone));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.data]);
  // The message whose details sheet is open; looked up in the live page so it tracks each poll.
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const channel = useMemo(
    () => channelList.find((c) => c.key === channelKey) ?? null,
    [channelList, channelKey],
  );
  const members = useMemo(
    () => messages.data?.members ?? [],
    [messages.data],
  );
  const pageItems = useMemo(() => messages.data?.items ?? [], [messages.data]);
  const items = useMemo(
    () => mergeHistory(older, pageItems),
    [older, pageItems],
  );
  const hasOlder =
    !olderDone &&
    (older.length > 0 || pageItems.length >= CHAT_PAGE_SIZE);
  const detailsMessage = detailsId
    ? (items.find((m) => m.id === detailsId) ?? null)
    : null;
  const lastMessageId = items[items.length - 1]?.id;
  const lastMessageMine = items[items.length - 1]?.mine ?? true;
  // Who has read up to which message ("seen" avatars); recomputed on every poll.
  const seen = useMemo(
    () => seenByMessage(items, members, user?.id),
    [items, members, user?.id],
  );

  // Opening (or switching to) a thread clears its unread marker.
  useEffect(() => {
    if (activeKey) markRead.mutate({ channelKey: activeKey });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey]);
  // An incoming message is read only if the reader is at the end of the thread; while they read
  // older messages it waits under a "new messages" pill and the position is kept.
  useEffect(() => {
    if (!lastMessageId || !activeKey) return;
    if (atBottomRef.current) {
      scrollRef.current?.scrollToEnd({ animated: false });
      if (!lastMessageMine) markRead.mutate({ channelKey: activeKey });
    } else if (!lastMessageMine) {
      // Reacts to a poll bringing a message; there is no event to subscribe to instead.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNewBelow(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMessageId]);

  const loadOlder = useCallback(async () => {
    const oldest = items[0];
    if (!activeKey || !oldest || loadingOlder || !hasOlder) return;
    const key = activeKey;
    setLoadingOlder(true);
    try {
      const page = await fetchChatMessages(key, {
        limit: CHAT_OLDER_PAGE_SIZE,
        before: oldest.created_at,
      });
      if (key !== activeKeyRef.current) return; // the reader switched thread meanwhile
      prependRef.current = {
        height: contentHeightRef.current,
        offset: offsetRef.current,
      };
      setOlder((current) => mergeHistory(page.items, current));
      if (page.items.length < CHAT_OLDER_PAGE_SIZE) setOlderDone(true);
    } catch {
      showToast(t("common.loadError"), "error");
    } finally {
      setLoadingOlder(false);
    }
  }, [activeKey, hasOlder, items, loadingOlder, t]);

  function onThreadScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    offsetRef.current = contentOffset.y;
    const atBottom =
      contentOffset.y + layoutMeasurement.height >=
      contentSize.height - NEAR_BOTTOM_PX;
    atBottomRef.current = atBottom;
    if (atBottom && newBelow) {
      setNewBelow(false);
      if (activeKey) markRead.mutate({ channelKey: activeKey });
    }
  }

  function onThreadContentSize(_width: number, height: number) {
    const previous = contentHeightRef.current;
    contentHeightRef.current = height;
    const anchor = prependRef.current;
    if (anchor) {
      // Older messages went on top: keep the message the reader was looking at in place.
      prependRef.current = null;
      scrollRef.current?.scrollTo({
        y: Math.max(0, height - anchor.height + anchor.offset),
        animated: false,
      });
      return;
    }
    if (atBottomRef.current || previous === 0)
      scrollRef.current?.scrollToEnd({ animated: false });
  }

  function showNewest() {
    atBottomRef.current = true;
    setNewBelow(false);
    scrollRef.current?.scrollToEnd({ animated: true });
    if (activeKey) markRead.mutate({ channelKey: activeKey });
  }

  function backToList() {
    setShowList(true);
    setSelected(null);
  }
  // Android's back button and the iOS back gesture leave a thread for the list, as the on-screen
  // arrow does, instead of closing the whole chat.
  usePreventRemove(!listVisible && canGoToList, () => backToList());

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
    if (activeKey) markRead.mutate({ channelKey: activeKey });
  }

  return (
    <View className="flex-1 bg-card" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-2 border-b border-line px-3 py-2">
        <Pressable
          testID="chat-close"
          accessibilityRole="button"
          onPress={() => {
            if (!listVisible && canGoToList) {
              backToList();
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
                      ...members
                        .slice(0, 3)
                        .map((m) => chatPersonName(m.name, m.state, t)),
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

      {channels.isError && channelList.length === 0 ? (
        <ErrorState
          message={t("chat.channelsError")}
          retryLabel={t("common.retry")}
          onRetry={() => void channels.refetch()}
        />
      ) : null}
      {listVisible ? (
        <ScrollView
          testID="chat-list-screen"
          className="flex-1"
          refreshControl={pullToRefresh}
        >
          <View className="gap-0.5 px-2 py-2">
            {channelList.map((item) => {
              const active = item.key === selected;
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
            testID="chat-thread"
            className="flex-1"
            contentContainerClassName="flex-grow justify-end p-4"
            onScroll={onThreadScroll}
            scrollEventThrottle={64}
            onContentSizeChange={onThreadContentSize}
          >
            {items.length > 0 && hasOlder ? (
              <Pressable
                testID="chat-load-older"
                accessibilityRole="button"
                onPress={() => void loadOlder()}
                disabled={loadingOlder}
                className="mb-3 items-center self-center rounded-full border border-line px-3 py-1.5 active:opacity-70"
              >
                {loadingOlder ? (
                  <ActivityIndicator color={tokens.muted} />
                ) : (
                  <Text className="font-sans-medium text-[12.5px] text-ink">
                    {t("chat.loadOlder")}
                  </Text>
                )}
              </Pressable>
            ) : null}
            {items.length > 0 && !hasOlder && messages.data ? (
              <Text
                testID="chat-history-start"
                className="mb-3 text-center font-sans text-[11.5px] text-muted"
              >
                {t("chat.historyStart")}
              </Text>
            ) : null}
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
            {(messages.isPending && activeKey) || waitingForChannel ? (
              <ActivityIndicator className="my-6" color={tokens.ink} />
            ) : null}
            {messages.isError && !lostStatus ? (
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
                      onSuccess: () => {
                        // The refetched page hides them; the older history must too.
                        setOlder((current) =>
                          current.filter((m) => m.sender_id !== userId),
                        );
                        showToast(t("chat.moderation.blocked"), "success");
                      },
                    },
                  )
                }
              />
            ) : null}
          </ScrollView>

          {newBelow ? (
            <Pressable
              testID="chat-new-below"
              accessibilityRole="button"
              onPress={showNewest}
              className="absolute bottom-[84px] self-center rounded-full px-3.5 py-1.5 active:opacity-80"
              style={{ backgroundColor: colors.blue }}
            >
              <Text className="font-sans-medium text-[12.5px] text-white">
                {t("chat.newMessages")}
              </Text>
            </Pressable>
          ) : null}

          {/* No composer when the server has chat off: there is nothing to send to. */}
          {enabled ? (
            <ChatComposer
              key={activeKey ?? "none"}
              disabled={!activeKey}
              sending={send.isPending}
              onSend={submit}
              initialDraft={activeKey ? drafts.get(activeKey) : ""}
              onDraftChange={(text) => {
                if (!activeKey) return;
                if (text) drafts.set(activeKey, text);
                else drafts.delete(activeKey);
              }}
            />
          ) : null}
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
