import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { QueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";
import { toggleReaction } from "@/lib/chat/reactions";
import type { ReactionEmoji } from "@/lib/chat/reactions";
import { uploadMultipart } from "@/lib/files/upload";
import type { PickedFile } from "@/lib/files/pick";
import { ApiError, unwrap, unwrapAs, unwrapVoid } from "@/lib/query/api-error";
import { showToast } from "@/components/ui/toast";
import { useApiMutation } from "@/lib/query/use-api-mutation";

import type { components } from "@/api/generated/schema";
import type { ChatAccountState } from "@/lib/chat/person-name";
import type { SupportedLocale } from "@/i18n";

export type { ChatAccountState };

export type ChatChannel = components["schemas"]["ChannelResponse"];
// Fields added by the API after the generated schema; older servers leave them out.
export type ChatMessage = components["schemas"]["MessageResponse"] & {
  sender_state?: ChatAccountState | null;
};
export type ChatMember = components["schemas"]["MemberResponse"] & {
  state?: ChatAccountState | null;
};
export type ChatReaction = components["schemas"]["ReactionResponse"] & {
  /** The reactor's name, also for someone no longer in the channel. */
  user_name?: string | null;
};
export type Features = components["schemas"]["FeaturesResponse"];
export type ChatMessagesPage = { items: ChatMessage[]; members: ChatMember[] };

/** The newest page a thread polls. */
export const CHAT_PAGE_SIZE = 100;
/** Older messages fetched per step when the reader scrolls back. */
export const CHAT_OLDER_PAGE_SIZE = 50;
/** Longest message body the API accepts (same limit as the web composer). */
export const CHAT_MAX_BODY_LENGTH = 4000;

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

/** One page of a channel (oldest first): the newest `limit`, or with `before` (a message's
 * `created_at`) the `limit` messages just older than it — how a thread pages back. */
export async function fetchChatMessages(
  channelKey: string,
  opts: { limit?: number; before?: string } = {},
): Promise<ChatMessagesPage> {
  return unwrapAs<ChatMessagesPage>(
    await api.GET("/api/v1/chat/channels/{channel_key}/messages", {
      params: {
        path: { channel_key: channelKey },
        query: {
          limit: opts.limit ?? CHAT_PAGE_SIZE,
          ...(opts.before ? { before: opts.before } : {}),
        } as never,
      },
    }),
  );
}

/** Newest 100 messages of a channel (oldest first) plus its members; polled while open.
 * `null` while no thread is on screen (the conversation list): nothing is fetched or polled. */
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
    // A channel the reader lost access to answers 403/404: retrying it is pointless.
    retry: false,
    queryFn: async () => fetchChatMessages(channelKey ?? ""),
  });
}

/** Sends text and/or one image or voice note; the message appears on the next poll (or the invalidation).
 * `lang` is the reader's current UI language, sent on every channel (the backend reads it everywhere). */
export function useSendChatMessage(channelKey: string) {
  const { t } = useTranslation();
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
    // Say what is wrong instead of the generic "some values are not valid".
    onError: (error, { body }) => {
      if (!(error instanceof ApiError)) return;
      if (
        (error.status === 400 || error.status === 422) &&
        body.trim().length > CHAT_MAX_BODY_LENGTH
      ) {
        showToast(
          t("chat.bodyTooLong", { max: CHAT_MAX_BODY_LENGTH }),
          "error",
        );
        return true;
      }
      if (error.status === 415) {
        showToast(t("chat.attachmentRejected"), "error");
        return true;
      }
    },
  });
}

/** Moves the read marker of a channel to now (called while its thread is on screen). The
 * cached channel list drops that channel's unread count at once instead of refetching it. */
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
    onSuccess: (_result, { channelKey }) => {
      queryClient.setQueryData<ChatChannel[]>(chatKeys.channels, (list) =>
        list?.map((channel) =>
          channel.key === channelKey
            ? { ...channel, unread_count: 0 }
            : channel,
        ),
      );
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

/** Reports someone else's message to the company's admins (App Store guideline 1.2), who are
 * notified and can remove it. Idempotent on the server. */
export function useReportChatMessage() {
  return useApiMutation<{ messageId: string; reason?: string }, void>({
    refreshAll: false,
    mutationFn: async ({ messageId, reason }) => {
      const cleaned = reason?.trim().slice(0, 500);
      return unwrapVoid(
        await api.POST(
          `/api/v1/chat/messages/${encodeURIComponent(messageId)}/report` as never,
          { body: (cleaned ? { reason: cleaned } : {}) as never } as never,
        ),
      );
    },
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
