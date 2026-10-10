import { fireEvent, render, screen } from "@testing-library/react-native";

import { ChatMessageList } from "@/features/chat/chat-message-list";
import type { ChatMessage } from "@/features/chat/chat-api";

jest.mock("@/features/chat/chat-voice-note", () => ({
  ChatVoiceBubble: () => null,
}));
jest.mock("@/components/ui/authed-image", () => ({ AuthedImage: () => null }));

const withPicture = {
  id: "m1",
  channel_key: "company",
  body: "",
  content_type: "text",
  created_at: "2026-01-01T10:00:00.000Z",
  mine: false,
  sender_id: "u1",
  sender_name: "Lan",
  reply_to_id: null,
  attachment: {
    url: "/api/v1/chat/attachments/a1",
    filename: "site.jpg",
    content_type: "image/jpeg",
    size_bytes: 2048,
  },
} as unknown as ChatMessage;

describe("chat picture viewer", () => {
  it("opens the picture full screen when the thumbnail is tapped and closes again", async () => {
    await render(<ChatMessageList messages={[withPicture]} />);
    expect(screen.queryByTestId("chat-image-viewer")).toBeNull();
    await fireEvent.press(screen.getByTestId("chat-attachment-image"));
    expect(screen.getByTestId("chat-image-viewer")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("chat-image-viewer-close"));
    expect(screen.queryByTestId("chat-image-viewer")).toBeNull();
  }, 30000);
});
