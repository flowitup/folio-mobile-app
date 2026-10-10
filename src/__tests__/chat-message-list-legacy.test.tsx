import { render, screen } from "@testing-library/react-native";

import { ChatMessageList } from "@/features/chat/chat-message-list";
import type { ChatMessage } from "@/features/chat/chat-api";

jest.mock("@/features/chat/chat-voice-note", () => ({
  ChatVoiceBubble: () => null,
}));
jest.mock("@/components/ui/authed-image", () => ({ AuthedImage: () => null }));

/** Old backend rows may still carry a non-user sender and rich content types; they must show
 * as plain text rather than crash or render special cards. */
describe("ChatMessageList with legacy rows", () => {
  it("renders a legacy assistant card message as a plain text bubble", async () => {
    const legacy = {
      id: "m1",
      channel_key: "company",
      body: "Hello @folio, here is a summary",
      content_type: "card",
      payload: { title: "ignored", rows: [] },
      created_at: "2026-01-01T10:00:00.000Z",
      mine: false,
      sender_id: null,
      sender_name: "Folio",
      sender_type: "assistant",
      reply_to_id: null,
    } as unknown as ChatMessage;
    await render(<ChatMessageList messages={[legacy]} />);
    expect(screen.getByText("Hello @folio, here is a summary")).toBeTruthy();
    expect(screen.queryByTestId("chat-reply-assistant")).toBeNull();
  });
});
