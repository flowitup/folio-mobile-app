import { useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";
import { uploadMultipart } from "@/lib/files/upload";
import type { PickedFile } from "@/lib/files/pick";
import { unwrapAs, unwrapVoid } from "@/lib/query/api-error";
import { useApiMutation } from "@/lib/query/use-api-mutation";

import type { components } from "@/api/generated/schema";

export type ChatChannel = components["schemas"]["ChannelResponse"];
export type ChatMessage = components["schemas"]["MessageResponse"];
export type ChatMember = components["schemas"]["MemberResponse"];
export type Features = components["schemas"]["FeaturesResponse"];

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

/** Sends text and/or one image; the message appears on the next poll (or the invalidation). */
export function useSendChatMessage(channelKey: string) {
  return useApiMutation<
    { body: string; file?: PickedFile | null },
    ChatMessage
  >({
    mutationFn: async ({ body, file }) => {
      const path = `/api/v1/chat/channels/${encodeURIComponent(channelKey)}/messages`;
      if (file)
        return uploadMultipart<ChatMessage>(path, [{ field: "file", file }], {
          ...(body.trim() ? { body: body.trim() } : {}),
        });
      return unwrapAs<ChatMessage>(
        await api.POST("/api/v1/chat/channels/{channel_key}/messages", {
          params: { path: { channel_key: channelKey } },
          body: { body: body.trim() },
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
