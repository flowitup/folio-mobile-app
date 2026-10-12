/**
 * Reacting updates the cached messages page at once, takes the server's list on success, and
 * puts the old list back (then refetches) when the server refuses.
 */
import { act, renderHook } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";

import { api } from "@/api/client";
import { showToast } from "@/components/ui/toast";
import { chatKeys, useToggleChatReaction } from "@/features/chat/chat-api";
import type { ChatMessagesPage } from "@/features/chat/chat-api";
import "@/i18n";
import { REACTION_EMOJIS } from "@/lib/chat/reactions";

jest.mock("@/api/client", () => ({
  api: { PUT: jest.fn(), DELETE: jest.fn() },
}));
jest.mock("@/components/ui/toast", () => ({ showToast: jest.fn() }));

const [THUMBS, HEART] = REACTION_EMOJIS;
const KEY = chatKeys.messages("company:c1");
const bob = {
  user_id: "bob",
  emoji: HEART,
  created_at: "2026-09-04T10:00:00Z",
};

let queryClient: QueryClient;
function Providers({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const reactionsInCache = () =>
  queryClient.getQueryData<ChatMessagesPage>(KEY)?.items[0]?.reactions;

beforeEach(() => {
  jest.clearAllMocks();
  queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity }, mutations: { gcTime: 0 } },
  });
  queryClient.setQueryData<ChatMessagesPage>(KEY, {
    members: [],
    items: [
      {
        id: "m1",
        channel_key: "company:c1",
        body: "hi",
        content_type: "text",
        created_at: "2026-09-04T09:00:00Z",
        mine: false,
        sender_id: "bob",
        sender_name: "Bob",
        sender_type: "user",
        attachment: null,
        payload: null,
        reply_to_id: null,
        reactions: [bob],
      },
    ],
  });
});

async function hook(viewerId = "me") {
  const { result } = await renderHook(
    () => useToggleChatReaction("company:c1", viewerId),
    { wrapper: Providers },
  );
  return result;
}

it("shows the reaction before the server answers, then keeps the server's list", async () => {
  let answer: (value: unknown) => void = () => {};
  jest.mocked(api.PUT).mockReturnValue(
    new Promise((resolve) => {
      answer = resolve;
    }) as never,
  );
  const result = await hook();
  await act(async () => {
    result.current.mutate({ messageId: "m1", emoji: THUMBS });
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(reactionsInCache()?.map((r) => [r.user_id, r.emoji])).toEqual([
    ["bob", HEART],
    ["me", THUMBS],
  ]);
  expect(api.PUT).toHaveBeenCalledWith(
    "/api/v1/chat/messages/{message_id}/reaction",
    { params: { path: { message_id: "m1" } }, body: { emoji: THUMBS } },
  );
  const server = [
    bob,
    { user_id: "me", emoji: THUMBS, created_at: "2026-09-04T10:05:00Z" },
  ];
  await act(async () => {
    answer({ data: { reactions: server }, response: { status: 200 } });
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(reactionsInCache()).toEqual(server);
  expect(showToast).not.toHaveBeenCalled();
});

it("removes the viewer's reaction when the same emoji is tapped again", async () => {
  jest.mocked(api.DELETE).mockResolvedValue({
    data: { reactions: [] },
    response: { status: 200 },
  } as never);
  const result = await hook("bob");
  await act(async () => {
    await result.current.mutateAsync({ messageId: "m1", emoji: HEART });
  });
  expect(api.DELETE).toHaveBeenCalledWith(
    "/api/v1/chat/messages/{message_id}/reaction",
    { params: { path: { message_id: "m1" } } },
  );
  expect(api.PUT).not.toHaveBeenCalled();
  expect(reactionsInCache()).toEqual([]);
});

it("rolls back, refetches and toasts when the server refuses", async () => {
  jest.mocked(api.PUT).mockResolvedValue({
    error: { error: "Forbidden", message: "Not a member of this channel" },
    response: new Response(null, { status: 403 }),
  } as never);
  const invalidate = jest.spyOn(queryClient, "invalidateQueries");
  const result = await hook();
  await act(async () => {
    await result.current
      .mutateAsync({ messageId: "m1", emoji: THUMBS })
      .catch(() => undefined);
  });
  expect(reactionsInCache()).toEqual([bob]);
  expect(invalidate).toHaveBeenCalledWith({ queryKey: KEY });
  expect(showToast).toHaveBeenCalledWith(expect.any(String), "error");
});
