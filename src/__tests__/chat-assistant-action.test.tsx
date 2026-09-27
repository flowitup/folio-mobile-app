/**
 * `useAssistantAction`: the tap stamps `answered`/`answered_payload` on the cached message at
 * once, a 409 (already answered) keeps that and refetches, any other failure restores the
 * previous page, re-fetches it too and toasts (a 503 with its own retryable message, since the
 * backend has already reset the choice to unanswered when it could not queue the action).
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

import { chatKeys, useAssistantAction } from "@/features/chat/chat-api";
import i18n from "@/i18n";
import { ApiError } from "@/lib/query/api-error";

const mockPost = jest.fn();
jest.mock("@/api/client", () => ({
  api: {
    GET: jest.fn(),
    POST: (...args: unknown[]) => mockPost(...args),
    PATCH: jest.fn(),
    DELETE: jest.fn(),
  },
}));
const mockToast = jest.fn();
jest.mock("@/components/ui/toast", () => ({
  showToast: (...args: unknown[]) => mockToast(...args),
}));

const CHANNEL = "assistant:u1";
const page = () => ({
  items: [
    {
      id: "choice-1",
      channel_key: CHANNEL,
      sender_id: null,
      sender_name: "Assistant",
      body: "Quel chantier ?",
      attachment: null,
      created_at: "2026-09-21T10:00:00+00:00",
      mine: false,
      sender_type: "assistant",
      content_type: "choice",
      payload: {
        prompt: "Quel chantier ?",
        options: [
          { label: "A", action: "set_project", payload: { project_id: "a" } },
        ],
        answered: null,
      },
      reply_to_id: null,
    },
  ],
  members: [],
});

type Hook = ReturnType<typeof useAssistantAction>;

/** Renders the hook inside a throwaway component and hands its latest value back. */
function Probe({ onRender }: { onRender: (hook: Hook) => void }) {
  onRender(useAssistantAction(CHANNEL));
  return <Text>probe</Text>;
}

async function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(chatKeys.messages(CHANNEL), page());
  const result: { current: Hook } = { current: undefined as unknown as Hook };
  await render(
    <QueryClientProvider client={client}>
      <Probe
        onRender={(hook) => {
          result.current = hook;
        }}
      />
    </QueryClientProvider>,
  );
  const answered = () =>
    (client.getQueryData(chatKeys.messages(CHANNEL)) as ReturnType<typeof page>)
      .items[0].payload as Record<string, unknown>;
  return { client, result, answered };
}

beforeEach(() => {
  mockPost.mockReset();
  mockToast.mockReset();
});

describe("useAssistantAction", () => {
  it("stamps the answer and its payload on the cached message before the server replies", async () => {
    let resolve: (value: unknown) => void = () => undefined;
    mockPost.mockReturnValue(new Promise((r) => (resolve = r)));
    const { result, answered } = await setup();

    await act(async () => {
      result.current.mutate({
        action: "set_project",
        payload: { project_id: "a" },
        reply_to_id: "choice-1",
      });
    });
    await waitFor(() => expect(answered().answered).toBe("set_project"));
    expect(answered().answered_payload).toEqual({ project_id: "a" });
    expect(mockPost).toHaveBeenCalledWith(
      "/api/v1/assistant/actions",
      expect.objectContaining({
        body: {
          action: "set_project",
          payload: { project_id: "a" },
          reply_to_id: "choice-1",
        },
      }),
    );
    await act(async () => resolve({ data: { accepted: true } }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("keeps the optimistic answer on 409 (the server already has one) and does not toast", async () => {
    mockPost.mockResolvedValue({
      error: { error: "AlreadyAnswered", message: "answered" },
      response: { status: 409 },
    });
    const { result, answered } = await setup();
    await act(async () => {
      result.current.mutate({
        action: "set_project",
        payload: { project_id: "a" },
        reply_to_id: "choice-1",
      });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ApiError);
    expect(answered().answered).toBe("set_project");
    expect(mockToast).not.toHaveBeenCalled();
  });

  it("restores the previous page, re-fetches it and toasts on any other failure", async () => {
    mockPost.mockResolvedValue({
      error: { error: "InternalError", message: "boom" },
      response: { status: 500 },
    });
    const { client, result, answered } = await setup();
    const invalidateSpy = jest.spyOn(client, "invalidateQueries");
    await act(async () => {
      result.current.mutate({
        action: "set_project",
        payload: { project_id: "a" },
        reply_to_id: "choice-1",
      });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(answered().answered).toBeNull();
    expect(mockToast).toHaveBeenCalledWith(
      i18n.t("assistant.actionFailed"),
      "error",
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: chatKeys.messages(CHANNEL),
    });
  });

  it("rolls back, re-fetches and shows a retryable message on a 503 (backend could not queue it)", async () => {
    mockPost.mockResolvedValue({
      error: { error: "ServiceUnavailable", message: "queue full" },
      response: { status: 503 },
    });
    const { result, answered } = await setup();
    await act(async () => {
      result.current.mutate({
        action: "set_project",
        payload: { project_id: "a" },
        reply_to_id: "choice-1",
      });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(answered().answered).toBeNull();
    expect(mockToast).toHaveBeenCalledWith(
      i18n.t("assistant.actionQueueUnavailable"),
      "error",
    );
  });
});
