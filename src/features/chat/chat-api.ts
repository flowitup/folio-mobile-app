import { useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";
import { uploadMultipart } from "@/lib/files/upload";
import type { PickedFile } from "@/lib/files/pick";
import { unwrapAs, unwrapVoid } from "@/lib/query/api-error";
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
    invalidates: [chatKeys.messages(channelKey), chatKeys.channels],
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
