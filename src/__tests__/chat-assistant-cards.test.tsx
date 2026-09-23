/**
 * Rendering + interaction tests for the three assistant content widgets (`AssistantCard`,
 * `AssistantChoice`, `AssistantJobStatus`) and their gating in `ChatMessageList`: they replace
 * the plain bubble for any assistant-authored message, whichever channel it landed in (company,
 * project or admin — the assistant has no dedicated channel of its own).
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
import type { ChatMessage } from "@/features/chat/chat-api";
import { ChatMessageList } from "@/features/chat/chat-message-list";

const mockNavigate = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ navigate: mockNavigate }),
}));

const mockSelectProjectOnNextShell = jest.fn();
jest.mock("@/features/projects/selected-project", () => ({
  selectProjectOnNextShell: (id: string) => mockSelectProjectOnNextShell(id),
}));

let mockUserId: string | undefined = "u1";
jest.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ user: mockUserId ? { id: mockUserId } : null }),
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

const mockGet = jest.fn();
const mockPost = jest.fn();
jest.mock("@/api/client", () => ({
  api: {
    GET: (...args: unknown[]) => mockGet(...args),
    POST: (...args: unknown[]) => mockPost(...args),
    PATCH: jest.fn(),
    DELETE: jest.fn(),
  },
}));

jest.mock("@/components/ui/toast", () => ({ showToast: jest.fn() }));

/** `AssistantCard` reads `useProjects()` to disable cards for projects the user is not on; every test that
 * mounts it needs `GET /api/v1/projects` to resolve to something, even an empty list, or the
 * query stays in its unconfigured (permissive) `data: undefined` state throughout the test. */
function mockProjectsList(ids: string[]) {
  mockGet.mockImplementation((path: string) => {
    if (path === "/api/v1/projects")
      return Promise.resolve({
        data: { projects: ids.map((id) => ({ id })), total: ids.length },
        response: { status: 200, statusText: "OK" },
      });
    return Promise.resolve({
      data: undefined,
      error: { error: "NotFound", message: "not mocked" },
      response: { status: 404, statusText: "Not Found" },
    });
  });
}

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

function assistantMessage(overrides: Partial<ChatMessage>): ChatMessage {
  return {
    id: "m1",
    channel_key: "project:p1",
    sender_id: null,
    sender_name: "Folio",
    body: "fallback text",
    attachment: null,
    created_at: "2026-09-21T10:00:00+00:00",
    mine: false,
    sender_type: "assistant",
    content_type: "text",
    payload: null,
    reply_to_id: null,
    mentions_assistant: false,
    ...overrides,
  };
}

beforeAll(async () => {
  await i18n.changeLanguage("en");
});

beforeEach(() => {
  mockUserId = "u1";
});

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockReset();
  // Default: the reader is on the invoice's project, so most tests do not need to think
  // about the project-membership gate. Tests for that gate call `mockProjectsList` again with a narrower list.
  mockProjectsList(["proj-1"]);
});

describe("AssistantCard", () => {
  it("renders the title and badge, distinct accessibility label, and opens an invoice on its own project", async () => {
    await renderWithClient(
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
    const card = await screen.findByTestId("assistant-card");
    expect(screen.getByTestId("assistant-card-title").props.children).toBe(
      "Facture Point P",
    );
    expect(screen.getByTestId("assistant-card-badge")).toBeTruthy();
    expect(card.props.accessibilityLabel).toBe(
      "Open the invoice — Facture Point P",
    );

    await fireEvent.press(card);

    expect(mockSelectProjectOnNextShell).toHaveBeenCalledWith("proj-1");
    expect(mockNavigate).toHaveBeenCalledWith(
      "/projects/proj-1/invoices/inv-1",
    );
  });

  it("opens a material without touching the selected project, regardless of the project list", async () => {
    mockProjectsList([]);
    await renderWithClient(
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

    const card = screen.getByTestId("assistant-card");
    expect(card.props.accessibilityLabel).toBe(
      "Open the material — Ciment Lafarge",
    );
    await fireEvent.press(card);

    expect(mockSelectProjectOnNextShell).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/library/mat-1");
  });

  it("keeps an invoice card without a project id informational (no /projects/null route)", async () => {
    await renderWithClient(
      <AssistantCard
        payload={{
          type: "invoice",
          id: "inv-9",
          projectId: null,
          title: "Leroy Merlin – 12,00 €",
          subtitle: null,
          badge: "needs_review",
          thumbnailUrl: null,
        }}
      />,
    );

    const card = screen.getByTestId("assistant-card");
    expect(card.props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(card);
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockSelectProjectOnNextShell).not.toHaveBeenCalled();
  });

  it("keeps an invoice card inert once its project is confirmed absent from the user's projects", async () => {
    mockProjectsList(["proj-other"]);
    await renderWithClient(
      <AssistantCard
        payload={{
          type: "invoice",
          id: "inv-2",
          projectId: "proj-1",
          title: "Facture hors chantier",
          subtitle: null,
          badge: null,
          thumbnailUrl: null,
        }}
      />,
    );

    const card = await screen.findByTestId("assistant-card");
    await waitFor(() =>
      expect(card.props.accessibilityState.disabled).toBe(true),
    );
    await fireEvent.press(card);
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockSelectProjectOnNextShell).not.toHaveBeenCalled();
  });

  it("stays tappable while the project list is still loading", async () => {
    mockGet.mockReturnValue(new Promise(() => {})); // never resolves
    await renderWithClient(
      <AssistantCard
        payload={{
          type: "invoice",
          id: "inv-3",
          projectId: "proj-1",
          title: "Facture en attente",
          subtitle: null,
          badge: null,
          thumbnailUrl: null,
        }}
      />,
    );

    const card = screen.getByTestId("assistant-card");
    expect(card.props.accessibilityState.disabled).toBe(false);
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
          answeredPayload: null,
          addressedTo: null,
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
          answeredPayload: null,
          addressedTo: null,
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

  it("fills only the tapped option when several options share one action", async () => {
    mockPost.mockResolvedValue({ data: { accepted: true } });
    const message = assistantMessage({
      id: "choice-2",
      content_type: "choice",
    });

    await renderWithClient(
      <AssistantChoice
        message={message}
        payload={{
          prompt: "Quel chantier ?",
          options: [
            {
              label: "Tour",
              action: "set_project",
              payload: { project_id: "a" },
            },
            {
              label: "Riverside",
              action: "set_project",
              payload: { project_id: "b" },
            },
          ],
          answered: null,
          answeredPayload: null,
          addressedTo: null,
        }}
      />,
    );

    const [first, second] = screen.getAllByTestId(
      "assistant-choice-option-set_project",
    );
    await fireEvent.press(second);

    await waitFor(() =>
      expect(second.props.accessibilityState.selected).toBe(true),
    );
    expect(first.props.accessibilityState.selected).toBe(false);
    expect(first.props.accessibilityState.disabled).toBe(true);
    expect(mockPost).toHaveBeenCalledWith(
      "/api/v1/assistant/actions",
      expect.objectContaining({
        body: {
          action: "set_project",
          payload: { project_id: "b" },
          reply_to_id: "choice-2",
        },
      }),
    );
  });

  it("disables every option with a muted hint when addressed to someone else", async () => {
    mockUserId = "u2";
    const message = assistantMessage({
      id: "choice-3",
      content_type: "choice",
    });

    await renderWithClient(
      <AssistantChoice
        message={message}
        payload={{
          prompt: "Quel chantier ?",
          options: [{ label: "Tour", action: "confirm", payload: {} }],
          answered: null,
          answeredPayload: null,
          addressedTo: "u1",
        }}
      />,
    );

    expect(
      screen.getByTestId("assistant-choice-option-confirm").props
        .accessibilityState.disabled,
    ).toBe(true);
    expect(screen.getByTestId("assistant-choice-not-addressed")).toBeTruthy();
    expect(screen.queryByTestId("assistant-choice-answered")).toBeNull();

    await fireEvent.press(
      screen.getByTestId("assistant-choice-option-confirm"),
    );
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("keeps the options tappable for the user the choice is addressed to", async () => {
    mockUserId = "u1";
    mockPost.mockResolvedValue({ data: { accepted: true } });
    const message = assistantMessage({
      id: "choice-4",
      content_type: "choice",
    });

    await renderWithClient(
      <AssistantChoice
        message={message}
        payload={{
          prompt: "Quel chantier ?",
          options: [{ label: "Tour", action: "confirm", payload: {} }],
          answered: null,
          answeredPayload: null,
          addressedTo: "u1",
        }}
      />,
    );

    expect(
      screen.getByTestId("assistant-choice-option-confirm").props
        .accessibilityState.disabled,
    ).toBe(false);
    expect(screen.queryByTestId("assistant-choice-not-addressed")).toBeNull();

    await fireEvent.press(
      screen.getByTestId("assistant-choice-option-confirm"),
    );
    await waitFor(() => expect(mockPost).toHaveBeenCalled());
  });

  it("disables every option with a muted hint when the assistant feature is off", async () => {
    const message = assistantMessage({
      id: "choice-5",
      content_type: "choice",
    });

    await renderWithClient(
      <AssistantChoice
        message={message}
        payload={{
          prompt: "Quel chantier ?",
          options: [{ label: "Tour", action: "confirm", payload: {} }],
          answered: null,
          answeredPayload: null,
          addressedTo: null,
        }}
        assistantEnabled={false}
      />,
    );

    expect(
      screen.getByTestId("assistant-choice-option-confirm").props
        .accessibilityState.disabled,
    ).toBe(true);
    expect(screen.getByTestId("assistant-choice-disabled")).toBeTruthy();
    expect(screen.queryByTestId("assistant-choice-not-addressed")).toBeNull();
    expect(screen.queryByTestId("assistant-choice-answered")).toBeNull();

    await fireEvent.press(
      screen.getByTestId("assistant-choice-option-confirm"),
    );
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("rolls back the optimistic pick and lets the reader retry on a 503 (backend could not queue it)", async () => {
    mockPost.mockResolvedValue({
      error: { error: "ServiceUnavailable", message: "queue full" },
      response: { status: 503 },
    });
    const message = assistantMessage({
      id: "choice-6",
      content_type: "choice",
    });

    await renderWithClient(
      <AssistantChoice
        message={message}
        payload={{
          prompt: "Confirmer ?",
          options: [{ label: "Confirmer", action: "confirm", payload: {} }],
          answered: null,
          answeredPayload: null,
          addressedTo: null,
        }}
      />,
    );

    await fireEvent.press(
      screen.getByTestId("assistant-choice-option-confirm"),
    );

    // The rollback restores the unanswered state, so the same button is tappable again — that
    // retap is the retry.
    await waitFor(() =>
      expect(
        screen.getByTestId("assistant-choice-option-confirm").props
          .accessibilityState.disabled,
      ).toBe(false),
    );
    expect(
      screen.getByTestId("assistant-choice-option-confirm").props
        .accessibilityState.selected,
    ).toBe(false);
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
  it("shows a plain text assistant message under the Folio name, inside a project channel", async () => {
    await render(
      <ChatMessageList
        messages={[
          assistantMessage({ content_type: "text", body: "Bonjour !" }),
        ]}
      />,
    );
    expect(screen.getByText("Folio")).toBeTruthy();
    expect(screen.getByText("Bonjour !")).toBeTruthy();
  });

  it("renders the card widget for a card message from the assistant, inside a project channel", async () => {
    await renderWithClient(
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
      />,
    );
    expect(screen.getByTestId("assistant-card")).toBeTruthy();
  });

  it("leaves a user message as a plain bubble even with a card-shaped payload", async () => {
    await render(
      <ChatMessageList
        messages={[
          assistantMessage({
            sender_type: "user",
            sender_id: "u1",
            content_type: "card",
            payload: {
              card: { type: "material", id: "mat-1", title: "Ciment" },
            },
            body: "Ciment",
          }),
        ]}
      />,
    );
    expect(screen.queryByTestId("assistant-card")).toBeNull();
    expect(screen.getByText("Ciment")).toBeTruthy();
  });

  it('wires the "Hỏi tiếp" button under an assistant message to onReplyToAssistant', async () => {
    const onReplyToAssistant = jest.fn();
    const message = assistantMessage({ content_type: "text", body: "Salut" });
    await render(
      <ChatMessageList
        messages={[message]}
        onReplyToAssistant={onReplyToAssistant}
      />,
    );

    await fireEvent.press(screen.getByTestId("chat-reply-assistant"));

    expect(onReplyToAssistant).toHaveBeenCalledWith(message);
  });

  it("does not show the reply button under a user message", async () => {
    await render(
      <ChatMessageList
        messages={[
          assistantMessage({
            sender_type: "user",
            sender_id: "u1",
            content_type: "text",
            body: "Bonjour",
          }),
        ]}
      />,
    );
    expect(screen.queryByTestId("chat-reply-assistant")).toBeNull();
  });

  it('hides the "Hỏi tiếp" button when the assistant feature is off', async () => {
    const onReplyToAssistant = jest.fn();
    await render(
      <ChatMessageList
        messages={[assistantMessage({ content_type: "text", body: "Salut" })]}
        onReplyToAssistant={onReplyToAssistant}
        assistantEnabled={false}
      />,
    );

    expect(screen.queryByTestId("chat-reply-assistant")).toBeNull();
  });

  it("disables an assistant choice's options when the assistant feature is off", async () => {
    await renderWithClient(
      <ChatMessageList
        messages={[
          assistantMessage({
            content_type: "choice",
            payload: {
              prompt: "Quel chantier ?",
              options: [{ label: "Tour", action: "confirm", payload: {} }],
              answered: null,
            },
          }),
        ]}
        assistantEnabled={false}
      />,
    );

    expect(
      screen.getByTestId("assistant-choice-option-confirm").props
        .accessibilityState.disabled,
    ).toBe(true);
    expect(screen.getByTestId("assistant-choice-disabled")).toBeTruthy();
  });
});
