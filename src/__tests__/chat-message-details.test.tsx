/**
 * Tapping a person's message opens its details (reactions + "seen by"); the chips under the
 * bubble count reactions and toggle the viewer's own. Legacy bot rows stay inert.
 */
import {
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react-native";

import type { ChatMember, ChatMessage } from "@/features/chat/chat-api";
import { ChatMessageList } from "@/features/chat/chat-message-list";
import { MessageDetailsSheet } from "@/features/chat/message-details-sheet";
import i18n from "@/i18n";
import { REACTION_EMOJIS } from "@/lib/chat/reactions";

jest.mock("@/features/chat/chat-voice-note", () => ({
  ChatVoiceBubble: () => null,
}));
jest.mock("@/components/ui/authed-image", () => ({ AuthedImage: () => null }));

const [THUMBS, HEART] = REACTION_EMOJIS;

const message = (overrides: Partial<ChatMessage>): ChatMessage =>
  ({
    id: "m1",
    channel_key: "company",
    body: "hello",
    content_type: "text",
    created_at: "2026-09-04T10:00:00+00:00",
    mine: false,
    sender_id: "bob",
    sender_name: "Bob",
    sender_type: "user",
    reply_to_id: null,
    attachment: null,
    reactions: [],
    ...overrides,
  }) as ChatMessage;

const members: ChatMember[] = [
  { id: "me", name: "Me", last_read_at: "2026-09-04T10:30:00+00:00" },
  { id: "bob", name: "Bob", last_read_at: "2026-09-04T11:00:00+00:00" },
  { id: "ann", name: "Ann", last_read_at: "2026-09-04T10:01:00+00:00" },
  { id: "cat", name: "Cat", last_read_at: "2026-09-04T09:00:00+00:00" },
];

beforeAll(async () => {
  await i18n.changeLanguage("en");
});

describe("message bubble interactions", () => {
  const onOpenDetails = jest.fn();
  const onReact = jest.fn();
  beforeEach(() => jest.clearAllMocks());

  const list = (messages: ChatMessage[]) => (
    <ChatMessageList
      messages={messages}
      viewerId="me"
      onOpenDetails={onOpenDetails}
      onReact={onReact}
    />
  );

  it("opens the details on a tap of a person's message", async () => {
    await render(list([message({})]));
    await fireEvent.press(screen.getByTestId("chat-message-m1"));
    expect(onOpenDetails).toHaveBeenCalledWith("m1");
  });

  it("leaves a legacy assistant row inert", async () => {
    await render(
      list([
        message({
          sender_type: "assistant",
          sender_id: null,
          reactions: [{ user_id: "me", emoji: THUMBS, created_at: "x" }],
        }),
      ]),
    );
    await fireEvent.press(screen.getByTestId("chat-message-m1"));
    expect(onOpenDetails).not.toHaveBeenCalled();
    expect(screen.queryByTestId("chat-reaction-m1-0")).toBeNull();
  });

  it("shows one chip per emoji with its count and toggles from a chip", async () => {
    await render(
      list([
        message({
          reactions: [
            {
              user_id: "me",
              emoji: THUMBS,
              created_at: "2026-09-04T10:02:00Z",
            },
            {
              user_id: "ann",
              emoji: THUMBS,
              created_at: "2026-09-04T10:03:00Z",
            },
            {
              user_id: "cat",
              emoji: HEART,
              created_at: "2026-09-04T10:04:00Z",
            },
          ],
        }),
      ]),
    );
    const own = screen.getByTestId("chat-reaction-m1-0");
    expect(own.props.accessibilityLabel).toBe(`${THUMBS} 2 reactions`);
    expect(own.props.accessibilityState).toMatchObject({ selected: true });
    const heart = screen.getByTestId("chat-reaction-m1-1");
    expect(heart.props.accessibilityLabel).toBe(`${HEART} 1 reaction`);
    expect(heart.props.accessibilityState).toMatchObject({ selected: false });
    await fireEvent.press(heart);
    expect(onReact).toHaveBeenCalledWith("m1", HEART);
  });
});

describe("MessageDetailsSheet", () => {
  const onReact = jest.fn();
  const onClose = jest.fn();
  beforeEach(() => jest.clearAllMocks());

  const sheet = (target: ChatMessage | null) => (
    <MessageDetailsSheet
      message={target}
      members={members}
      viewerId="me"
      onReact={onReact}
      onClose={onClose}
    />
  );

  it("offers the six emoji, marks the viewer's own and reacts on a tap", async () => {
    await render(
      sheet(
        message({
          reactions: [
            { user_id: "me", emoji: HEART, created_at: "2026-09-04T10:02:00Z" },
          ],
        }),
      ),
    );
    REACTION_EMOJIS.forEach((emoji, index) =>
      expect(
        screen.getByTestId(`message-details-react-${index}`).props
          .accessibilityLabel,
      ).toBe(`React with ${emoji}`),
    );
    expect(
      screen.getByTestId("message-details-react-1").props.accessibilityState,
    ).toMatchObject({ selected: true });
    await fireEvent.press(screen.getByTestId("message-details-react-0"));
    expect(onReact).toHaveBeenCalledWith("m1", THUMBS);
  });

  it("lists who reacted with what and who has seen it with the time", async () => {
    await render(
      sheet(
        message({
          reactions: [
            {
              user_id: "ann",
              emoji: THUMBS,
              created_at: "2026-09-04T10:02:00Z",
            },
          ],
        }),
      ),
    );
    const reacted = within(screen.getByTestId("message-details-reacted-ann"));
    expect(reacted.getByText("Ann")).toBeTruthy();
    expect(reacted.getByText(THUMBS)).toBeTruthy();
    // Bob sent it and Cat stopped reading before it; Me and Ann have seen it.
    expect(screen.getByTestId("message-details-seen-ann")).toBeTruthy();
    expect(screen.getByTestId("message-details-seen-me")).toBeTruthy();
    expect(screen.queryByTestId("message-details-seen-bob")).toBeNull();
    expect(screen.queryByTestId("message-details-seen-cat")).toBeNull();
  });

  it("says nobody has seen it yet", async () => {
    await render(sheet(message({ created_at: "2026-09-04T12:00:00+00:00" })));
    expect(screen.getByText("Nobody has seen it yet")).toBeTruthy();
  });

  it("closes from the close button and stays hidden without a message", async () => {
    await render(sheet(message({})));
    await fireEvent.press(screen.getByTestId("message-details-close"));
    expect(onClose).toHaveBeenCalled();
    await render(sheet(null));
    expect(screen.queryByTestId("message-details-sheet")).toBeNull();
  });
});
