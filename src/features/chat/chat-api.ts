import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { api } from "@/api/client";
import { showToast } from "@/components/ui/toast";
import { uploadMultipart } from "@/lib/files/upload";
import type { PickedFile } from "@/lib/files/pick";
import { ApiError, unwrapAs, unwrapVoid } from "@/lib/query/api-error";
import { useApiMutation } from "@/lib/query/use-api-mutation";

import type { components } from "@/api/generated/schema";
import type { SupportedLocale } from "@/i18n";

export type ChatChannel = components["schemas"]["ChannelResponse"];
export type ChatMessage = components["schemas"]["MessageResponse"];
export type ChatMember = components["schemas"]["MemberResponse"];
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

/** `true` once the backend has confirmed the assistant feature (both AI keys configured). */
export function useAssistantEnabled(): boolean {
  return useFeatures().data?.assistant === true;
}

/** Channels with unread counts; polled while the caller is on screen. */
export function useChatChannels(enabled: boolean, refetchInterval = 30_000) {
  return useQuery({
    queryKey: chatKeys.channels,
    enabled,
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

/** Sends text and/or one image; the message appears on the next poll (or the invalidation).
 * `lang` is the reader's current UI language; the backend only keeps it inside the assistant
 * channel (it is silently dropped everywhere else), so callers can always pass it along. */
export function useSendChatMessage(channelKey: string) {
  return useApiMutation<
    { body: string; file?: PickedFile | null; lang?: SupportedLocale },
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
          body: { body: body.trim(), lang: lang ?? null },
        }),
      );
    },
    invalidates: [chatKeys.messages(channelKey), chatKeys.channels],
  });
}

/**
 * Answers an assistant `choice` message (tapped option) or fires another assistant action.
 * Optimistically stamps `payload.answered` on the message cache so the buttons go inert the
 * instant the reader taps one; an `AlreadyAnswered` (409) just refetches — the server's
 * answer wins over the optimistic guess rather than being treated as a failure to roll back.
 */
export function useAssistantAction(channelKey: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const messagesKey = chatKeys.messages(channelKey);

  return useMutation<
    { accepted: boolean },
    unknown,
    { action: string; payload?: Record<string, unknown>; reply_to_id: string },
    { previous: ChatMessagesPage | undefined }
  >({
    mutationFn: async ({ action, payload, reply_to_id }) =>
      unwrapAs<{ accepted: boolean }>(
        await api.POST("/api/v1/assistant/actions", {
          body: { action, payload, reply_to_id },
        }),
      ),
    onMutate: async ({ action, reply_to_id }) => {
      await queryClient.cancelQueries({ queryKey: messagesKey });
      const previous = queryClient.getQueryData<ChatMessagesPage>(messagesKey);
      queryClient.setQueryData<ChatMessagesPage | undefined>(
        messagesKey,
        (current) =>
          current && {
            ...current,
            items: current.items.map((message) =>
              message.id === reply_to_id
                ? {
                    ...message,
                    payload: { ...(message.payload ?? {}), answered: action },
                  }
                : message,
            ),
          },
      );
      return { previous };
    },
    onError: (error, _variables, context) => {
      if (error instanceof ApiError && error.status === 409) {
        void queryClient.invalidateQueries({ queryKey: messagesKey });
        return;
      }
      if (context?.previous)
        queryClient.setQueryData(messagesKey, context.previous);
      if (__DEV__ && !(error instanceof ApiError))
        console.error("[useAssistantAction]", error);
      showToast(t("assistant.actionFailed"), "error");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: messagesKey });
    },
  });
}

/** Moves the read marker of a channel to now (called when a channel is opened). */
export function useMarkChatRead() {
  const queryClient = useQueryClient();
  return useApiMutation<{ channelKey: string }, void>({
    mutationFn: async ({ channelKey }) =>
      unwrapVoid(
        await api.POST("/api/v1/chat/channels/{channel_key}/read", {
          params: { path: { channel_key: channelKey } },
        }),
      ),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: chatKeys.channels }),
    onError: () => true,
  });
}
