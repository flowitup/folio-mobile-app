import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";
import { toggleReaction } from "@/lib/chat/reactions";
import type { ReactionEmoji } from "@/lib/chat/reactions";
import { uploadMultipart } from "@/lib/files/upload";
import type { PickedFile } from "@/lib/files/pick";
import { unwrap, unwrapAs, unwrapVoid } from "@/lib/query/api-error";
import { useApiMutation } from "@/lib/query/use-api-mutation";

import type { components } from "@/api/generated/schema";
import type { SupportedLocale } from "@/i18n";

export type ChatChannel = components["schemas"]["ChannelResponse"];
export type ChatMessage = components["schemas"]["MessageResponse"];
export type ChatMember = components["schemas"]["MemberResponse"];
export type ChatReaction = components["schemas"]["ReactionResponse"];
export type Features = components["schemas"]["FeaturesResponse"];
export type ChatMessagesPage = { items: ChatMessage[]; members: ChatMember[] };

export const chatKeys = {
  features: ["features"] as const,
  channels: ["chat", "channels"] as const,
  messages: (key: string) => ["chat", "messages", key] as const,
};

/** Deployment feature flags; chat is only on for AVN Construction. Cached for the session. */
export function useFeatures() {
  return useQuery({
    queryKey: chatKeys.features,
    staleTime: Infinity,
    queryFn: async () => unwrapAs<Features>(await api.GET("/api/v1/features")),
  });
}

/** `true` once the backend has confirmed the chat feature; `false` while unknown or off. */
export function useChatEnabled(): boolean {
  return useFeatures().data?.chat === true;
}

/** Channels with unread counts; polled while the caller is on screen. */
export function useChatChannels(enabled: boolean, refetchInterval = 30_000) {
  return useQuery({
    queryKey: chatKeys.channels,
    enabled,
    // Opening the chat must not trust a list cached up to 30 s ago: the channel a push names
    // may be newer than it (a project the user was just added to).
    refetchOnMount: "always",
    refetchInterval: enabled ? refetchInterval : false,
    queryFn: async () =>
      unwrapAs<{ items: ChatChannel[] }>(await api.GET("/api/v1/chat/channels"))
        .items,
  });
}

/** Newest 100 messages of a channel (oldest first) plus its members; polled while open. */
export function useChatMessages(
  channelKey: string | null,
  refetchInterval = 5_000,
) {
  return useQuery({
    queryKey: chatKeys.messages(channelKey ?? ""),
    enabled: Boolean(channelKey),
    // A thread opened from a push, the bell or the conversation list shows what the server has
    // now, not the page cached the last time it was open: never fresh, so switching channel
    // refetches too (not only mounting the screen).
    staleTime: 0,
    refetchOnMount: "always",
    refetchInterval: channelKey ? refetchInterval : false,
    queryFn: async () =>
      unwrapAs<{ items: ChatMessage[]; members: ChatMember[] }>(
        await api.GET("/api/v1/chat/channels/{channel_key}/messages", {
          params: {
            path: { channel_key: channelKey ?? "" },
            query: { limit: 100 } as never,
          },
        }),
      ),
  });
}

/** Sends text and/or one image or voice note; the message appears on the next poll (or the invalidation).
 * `lang` is the reader's current UI language, sent on every channel (the backend reads it everywhere). */
export function useSendChatMessage(channelKey: string) {
  return useApiMutation<
    {
      body: string;
      file?: PickedFile | null;
      lang?: SupportedLocale;
    },
    ChatMessage
  >({
    mutationFn: async ({ body, file, lang }) => {
      const path = `/api/v1/chat/channels/${encodeURIComponent(channelKey)}/messages`;
      if (file)
        return uploadMultipart<ChatMessage>(path, [{ field: "file", file }], {
          ...(body.trim() ? { body: body.trim() } : {}),
          ...(lang ? { lang } : {}),
        });
      return unwrapAs<ChatMessage>(
        await api.POST("/api/v1/chat/channels/{channel_key}/messages", {
          params: { path: { channel_key: channelKey } },
          // `lang` is generated as required-nullable (the spec generator's reading of
          // `Optional[str] = None`) though the wire contract accepts its absence, so it is only
          // ever added to the object when the caller passes it, hence the cast below.
          body: {
            body: body.trim(),
            ...(lang ? { lang } : {}),
          } as never,
        }),
      );
    },
    refreshAll: false,
    invalidates: [chatKeys.messages(channelKey), chatKeys.channels],
  });
}

/** Moves the read marker of a channel to now (called when a channel is opened). */
export function useMarkChatRead() {
  const queryClient = useQueryClient();
  return useApiMutation<{ channelKey: string }, void>({
    refreshAll: false,
    mutationFn: async ({ channelKey }) =>
      unwrapVoid(
        await api.POST("/api/v1/chat/channels/{channel_key}/read", {
          params: { path: { channel_key: channelKey } },
        }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: chatKeys.channels });
      // Reading a channel also marks its bell entries read server-side (`noteKeys.notifications`).
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: () => true,
  });
}

/** Writes one message's reactions into the cached messages page of its channel. */
function writeReactions(
  queryClient: QueryClient,
  channelKey: string,
  messageId: string,
  reactions: ChatReaction[],
): void {
  queryClient.setQueryData<ChatMessagesPage>(
    chatKeys.messages(channelKey),
    (page) =>
      page && {
        ...page,
        items: page.items.map((message) =>
          message.id === messageId ? { ...message, reactions } : message,
        ),
      },
  );
}

/**
 * Taps an emoji on a message for the viewer: sets it, swaps theirs for it, or removes it when it
 * is already theirs (one reaction per person). The cached page changes at once; the server's list
 * replaces it on success, and a failure puts the old list back and refetches the channel.
 */
export function useToggleChatReaction(
  channelKey: string,
  viewerId: string | null | undefined,
) {
  const queryClient = useQueryClient();
  return useApiMutation<
    { messageId: string; emoji: ReactionEmoji },
    ChatReaction[]
  >({
    refreshAll: false,
    mutationFn: async ({ messageId, emoji }) => {
      if (!viewerId) throw new Error("Reacting needs a signed-in user");
      const key = chatKeys.messages(channelKey);
      // A poll landing mid-request would overwrite the optimistic list with the old one.
      await queryClient.cancelQueries({ queryKey: key });
      const previous =
        queryClient
          .getQueryData<ChatMessagesPage>(key)
          ?.items.find((message) => message.id === messageId)?.reactions ?? [];
      const next = toggleReaction(
        previous,
        viewerId,
        emoji,
        new Date().toISOString(),
      );
      writeReactions(queryClient, channelKey, messageId, next.reactions);
      const path = { message_id: messageId };
      try {
        const result =
          next.change.kind === "set"
            ? await api.PUT("/api/v1/chat/messages/{message_id}/reaction", {
                params: { path },
                body: { emoji: next.change.emoji },
              })
            : await api.DELETE("/api/v1/chat/messages/{message_id}/reaction", {
                params: { path },
              });
        return unwrap(result).reactions;
      } catch (error) {
        writeReactions(queryClient, channelKey, messageId, previous);
        throw error;
      }
    },
    onSuccess: (reactions, { messageId }) =>
      writeReactions(queryClient, channelKey, messageId, reactions),
    onError: () => {
      void queryClient.invalidateQueries({
        queryKey: chatKeys.messages(channelKey),
      });
    },
  });
}

export type BlockedUser = { id: string; name: string };

export const blockedKey = ["chat", "blocks"] as const;

/** People the caller blocked in chat (their messages and pushes are hidden). */
export function useBlockedUsers(enabled: boolean) {
  return useQuery({
    queryKey: blockedKey,
    enabled,
    queryFn: async () =>
      unwrapAs<{ items: BlockedUser[] }>(
        await api.GET("/api/v1/chat/blocks" as never),
      ).items,
  });
}

/** Reports one message to the moderators (App Store guideline 1.2). Idempotent on the server. */
export function useReportChatMessage() {
  return useApiMutation<{ messageId: string; reason?: string }, void>({
    refreshAll: false,
    mutationFn: async ({ messageId, reason }) =>
      unwrapVoid(
        await api.POST(
          `/api/v1/chat/messages/${encodeURIComponent(messageId)}/report` as never,
          { body: (reason ? { reason } : {}) as never } as never,
        ),
      ),
  });
}

/** Hides a person's messages from the caller; refreshes messages, channels and the blocked list. */
export function useBlockChatUser() {
  return useApiMutation<{ userId: string }, void>({
    mutationFn: async ({ userId }) =>
      unwrapVoid(
        await api.PUT(
          `/api/v1/chat/blocks/${encodeURIComponent(userId)}` as never,
        ),
      ),
    invalidates: [["chat"]],
  });
}

export function useUnblockChatUser() {
  return useApiMutation<{ userId: string }, void>({
    mutationFn: async ({ userId }) =>
      unwrapVoid(
        await api.DELETE(
          `/api/v1/chat/blocks/${encodeURIComponent(userId)}` as never,
        ),
      ),
    invalidates: [["chat"]],
  });
}
