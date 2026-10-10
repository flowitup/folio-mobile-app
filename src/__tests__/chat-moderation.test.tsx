import { fireEvent, render, screen } from "@testing-library/react-native";
import { Alert } from "react-native";

import { ChatMessageList } from "@/features/chat/chat-message-list";
import type { ChatMessage } from "@/features/chat/chat-api";

const onReport = jest.fn();
const onBlock = jest.fn();
const list = (messages: ChatMessage[]) => (
  <ChatMessageList messages={messages} onReport={onReport} onBlock={onBlock} />
);
jest.mock("@/features/chat/chat-voice-note", () => ({
  ChatVoiceBubble: () => null,
}));
jest.mock("@/components/ui/authed-image", () => ({ AuthedImage: () => null }));

const base = {
  channel_key: "company",
  content_type: "text",
  created_at: "2026-01-01T10:00:00.000Z",
  reply_to_id: null,
  attachment: null,
} as const;
const theirs = {
  ...base,
  id: "m1",
  body: "hello",
  mine: false,
  sender_id: "u1",
  sender_name: "Lan",
} as unknown as ChatMessage;
const mine = {
  ...base,
  id: "m2",
  body: "hi",
  mine: true,
  sender_id: "me",
  sender_name: "Me",
} as unknown as ChatMessage;

type Button = { text?: string; onPress?: () => void };

describe("chat moderation menu", () => {
  beforeEach(() => jest.clearAllMocks());

  it("offers no menu on my own messages", async () => {
    await render(list([mine]));
    expect(screen.queryByTestId("chat-message-menu-m2")).toBeNull();
  });

  it("reports a message after confirming", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(list([theirs]));
    await fireEvent.press(screen.getByTestId("chat-message-menu-m1"));
    const menu = alert.mock.calls[0]?.[2] as Button[];
    menu[0].onPress?.();
    const confirm = alert.mock.calls[1]?.[2] as Button[];
    confirm[1].onPress?.();
    expect(onReport).toHaveBeenCalledWith("m1");
  });

  it("blocks the sender after confirming", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(list([theirs]));
    await fireEvent.press(screen.getByTestId("chat-message-menu-m1"));
    const menu = alert.mock.calls[0]?.[2] as Button[];
    menu[1].onPress?.();
    const confirm = alert.mock.calls[1]?.[2] as Button[];
    confirm[1].onPress?.();
    expect(onBlock).toHaveBeenCalledWith("u1");
  });
});
