/**
 * Rendering + interaction tests for the three assistant content widgets (`AssistantCard`,
 * `AssistantChoice`, `AssistantJobStatus`) and their gating in `ChatMessageList`: they only
 * ever replace the plain bubble inside the assistant channel, for an assistant-authored message.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import type { ReactElement } from "react";

import i18n from "@/i18n";
import {
  AssistantCard,
  AssistantChoice,
  AssistantJobStatus,
} from "@/features/chat/assistant-cards";
import type { ChatChannel, ChatMessage } from "@/features/chat/chat-api";
import { ChatMessageList } from "@/features/chat/chat-message-list";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockSelectProjectOnNextShell = jest.fn();
jest.mock("@/features/projects/selected-project", () => ({
  selectProjectOnNextShell: (id: string) => mockSelectProjectOnNextShell(id),
}));

// The thumbnail is a native Image loader with an async token fetch; irrelevant here.
jest.mock("@/components/ui/authed-image", () => ({ AuthedImage: () => null }));

// `chat-message-list.tsx` pulls in the voice-note player (a native module); no test message
// here carries an attachment, so a bare stub that does not crash on import is enough.
jest.mock("expo-audio", () => ({
  useAudioPlayer: () => ({
    play: jest.fn(),
    pause: jest.fn(),
    seekTo: jest.fn(),
  }),
  useAudioPlayerStatus: () => ({
    isLoaded: false,
    playing: false,
    currentTime: 0,
    duration: 0,
    didJustFinish: false,
  }),
}));

const mockPost = jest.fn();
jest.mock("@/api/client", () => ({
  api: {
    GET: jest.fn(),
    POST: (...args: unknown[]) => mockPost(...args),
    PATCH: jest.fn(),
    DELETE: jest.fn(),
  },
}));

jest.mock("@/components/ui/toast", () => ({ showToast: jest.fn() }));

// RNTL 14's `render` resolves asynchronously; every call site below awaits it, or `screen`
// queries run before the tree is mounted and fail with "render function has not been called".
async function renderWithClient(node: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{node}</QueryClientProvider>,
  );
}

const ASSISTANT_CHANNEL: ChatChannel = {
  id: "ch-assistant",
  key: "assistant:u1",
  kind: "assistant",
  last_message_at: null,
  member_count: 1,
  name: "Assistant",
  unread_count: 0,
};

const COMPANY_CHANNEL: ChatChannel = {
  ...ASSISTANT_CHANNEL,
  id: "ch-company",
  key: "company:c1",
  kind: "company",
};

function assistantMessage(overrides: Partial<ChatMessage>): ChatMessage {
  return {
    id: "m1",
    channel_key: "assistant:u1",
    sender_id: null,
    sender_name: "Assistant",
    body: "fallback text",
    attachment: null,
    created_at: "2026-09-21T10:00:00+00:00",
    mine: false,
    sender_type: "assistant",
    content_type: "text",
    payload: null,
    reply_to_id: null,
    ...overrides,
  };
}

beforeAll(async () => {
  await i18n.changeLanguage("en");
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("AssistantCard", () => {
  it("renders the title and badge, and opens an invoice after selecting its project", async () => {
    await render(
      <AssistantCard
        payload={{
          type: "invoice",
          id: "inv-1",
          projectId: "proj-1",
          title: "Facture Point P",
          subtitle: "Confirmé",
          badge: "confirmed",
          thumbnailUrl: null,
        }}
      />,
    );
    expect(screen.getByTestId("assistant-card-title").props.children).toBe(
      "Facture Point P",
    );
    expect(screen.getByTestId("assistant-card-badge")).toBeTruthy();

    await fireEvent.press(screen.getByTestId("assistant-card"));

    expect(mockSelectProjectOnNextShell).toHaveBeenCalledWith("proj-1");
    expect(mockPush).toHaveBeenCalledWith("/projects/proj-1/invoices/inv-1");
  });

  it("opens a material without touching the selected project", async () => {
    await render(
      <AssistantCard
        payload={{
          type: "material",
          id: "mat-1",
          projectId: null,
          title: "Ciment Lafarge",
          subtitle: null,
          badge: null,
          thumbnailUrl: null,
        }}
      />,
    );

    await fireEvent.press(screen.getByTestId("assistant-card"));

    expect(mockSelectProjectOnNextShell).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/library/mat-1");
  });
});

describe("AssistantChoice", () => {
  it("answers the actions endpoint with reply_to_id and disables every option once tapped", async () => {
    mockPost.mockResolvedValue({ data: { accepted: true } });
    const message = assistantMessage({
      id: "choice-1",
      content_type: "choice",
    });

    await renderWithClient(
      <AssistantChoice
        message={message}
        payload={{
          prompt: "Confirmer le matériau ?",
          options: [
            { label: "Confirmer", action: "confirm", payload: {} },
            { label: "Annuler", action: "cancel", payload: {} },
          ],
          answered: null,
        }}
      />,
    );

    expect(screen.getByText("Confirmer le matériau ?")).toBeTruthy();

    await fireEvent.press(
      screen.getByTestId("assistant-choice-option-confirm"),
    );

    await waitFor(() =>
      expect(
        screen.getByTestId("assistant-choice-option-confirm").props
          .accessibilityState.selected,
      ).toBe(true),
    );
    expect(
      screen.getByTestId("assistant-choice-option-cancel").props
        .accessibilityState.disabled,
    ).toBe(true);
    expect(mockPost).toHaveBeenCalledWith(
      "/api/v1/assistant/actions",
      expect.objectContaining({
        body: { action: "confirm", payload: {}, reply_to_id: "choice-1" },
      }),
    );
  });

  it("renders every option, inert from the start, when the server already recorded an answer", async () => {
    await renderWithClient(
      <AssistantChoice
        message={assistantMessage({ id: "choice-2", content_type: "choice" })}
        payload={{
          prompt: "Confirmer ?",
          options: [
            { label: "Confirmer", action: "confirm", payload: {} },
            { label: "Annuler", action: "cancel", payload: {} },
          ],
          answered: "cancel",
        }}
      />,
    );

    expect(
      screen.getByTestId("assistant-choice-option-cancel").props
        .accessibilityState.selected,
    ).toBe(true);
    expect(
      screen.getByTestId("assistant-choice-option-confirm").props
        .accessibilityState.disabled,
    ).toBe(true);
    expect(screen.getByTestId("assistant-choice-answered")).toBeTruthy();
  });
});

describe("AssistantJobStatus", () => {
  it("shows a spinner while queued or running", async () => {
    await render(
      <AssistantJobStatus
        payload={{
          jobId: "j1",
          state: "running",
          text: "Envoi…",
          progress: null,
        }}
      />,
    );
    expect(screen.getByTestId("assistant-job-status-spinner")).toBeTruthy();
  });

  it("shows the state label and a progress bar once it is no longer busy", async () => {
    await render(
      <AssistantJobStatus
        payload={{ jobId: "j1", state: "done", text: "Fini", progress: 1 }}
      />,
    );
    expect(screen.queryByTestId("assistant-job-status-spinner")).toBeNull();
    expect(
      screen.getByTestId("assistant-job-status-label").props.children,
    ).toBe("Done");
    expect(
      (
        screen.getByTestId("assistant-job-status-progress").props.style as {
          width: string;
        }
      ).width,
    ).toBe("100%");
  });
});

describe("ChatMessageList assistant gating", () => {
  it("shows a plain text assistant message under the Assistant name", async () => {
    await render(
      <ChatMessageList
        messages={[
          assistantMessage({ content_type: "text", body: "Bonjour !" }),
        ]}
        channel={ASSISTANT_CHANNEL}
      />,
    );
    expect(screen.getByText("Assistant")).toBeTruthy();
    expect(screen.getByText("Bonjour !")).toBeTruthy();
  });

  it("renders the card widget for a card message inside the assistant channel", async () => {
    await render(
      <ChatMessageList
        messages={[
          assistantMessage({
            content_type: "card",
            payload: {
              card: {
                type: "material",
                id: "mat-1",
                title: "Ciment Lafarge 25kg",
              },
            },
          }),
        ]}
        channel={ASSISTANT_CHANNEL}
      />,
    );
    expect(screen.getByTestId("assistant-card")).toBeTruthy();
  });

  it("leaves a non-assistant channel's messages as plain bubbles even with a card-shaped payload", async () => {
    await render(
      <ChatMessageList
        messages={[
          assistantMessage({
            content_type: "card",
            payload: {
              card: { type: "material", id: "mat-1", title: "Ciment" },
            },
            body: "Ciment",
          }),
        ]}
        channel={COMPANY_CHANNEL}
      />,
    );
    expect(screen.queryByTestId("assistant-card")).toBeNull();
    expect(screen.getByText("Ciment")).toBeTruthy();
  });
});
