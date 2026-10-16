import { fireEvent, render, screen } from "@testing-library/react-native";

import "@/i18n";
import { NotificationsSheet } from "@/components/shell/notifications-sheet";

/**
 * The bell lists the stored activity feed (chat, tasks, invoices, membership). A tap marks the
 * entry read and lands where the push would have; "mark all read" sends no ids.
 */
const mockPush = jest.fn();
const mockSelect = jest.fn();
const mockCloseSheet = jest.fn();
const mockMarkRead = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, navigate: jest.fn() }),
}));
jest.mock("@/components/shell/shell-context", () => ({
  useShell: () => ({
    sheet: "notifications",
    closeSheet: mockCloseSheet,
    tabBarHeight: 0,
  }),
}));
jest.mock("@/components/shell/attendance-requests-section", () => ({
  AttendanceRequestsSection: () => null,
}));
jest.mock("@/features/projects/selected-project", () => ({
  useSelectedProject: () => ({ projectId: "p-current", select: mockSelect }),
}));
jest.mock("@/features/projects/projects-api", () => ({
  useProjects: () => ({
    data: {
      projects: [{ id: "p-other", name: "Other", address: "12 rue Haute" }],
      total: 1,
    },
  }),
}));
jest.mock("@/features/notes/notes-api", () => ({
  useNotifications: () => ({
    isPending: false,
    data: {
      items: [],
      attendance_pending: [],
      company_events: [],
      events: [
        {
          id: "e-task",
          category: "tasks",
          kind: "task_moved",
          title: "Task moved",
          body: "Concrete slab",
          data: { kind: "task_moved", project_id: "p-other" },
          created_at: "2026-10-10T10:00:00Z",
          read: false,
        },
        {
          id: "e-chat",
          category: "chat",
          kind: "chat_message",
          title: "Pierre",
          body: "On site at 8",
          data: { kind: "chat_message", channel_key: "company:c1" },
          created_at: "2026-10-10T09:00:00Z",
          read: true,
        },
        {
          id: "e-gone",
          category: "membership",
          kind: "project_member_removed",
          title: "Removed from a project",
          body: "12 rue Basse",
          data: { kind: "project_member_removed", project_id: "p-gone" },
          created_at: "2026-10-09T08:00:00Z",
          read: false,
        },
      ],
      // The feed is one page; the server counts every unread entry.
      events_unread: 84,
    },
  }),
  useDismissNotification: () => ({ mutate: jest.fn() }),
  useMarkActivityRead: () => ({ mutate: mockMarkRead }),
}));

describe("notifications sheet · activity", () => {
  beforeEach(() => jest.clearAllMocks());

  it("lists the entries, with a dot only on unread ones", async () => {
    await render(<NotificationsSheet />);
    expect(screen.getByText("Task moved")).toBeTruthy();
    expect(screen.getByText("Pierre")).toBeTruthy();
    expect(screen.getByTestId("notification-event-unread-e-task")).toBeTruthy();
    expect(screen.queryByTestId("notification-event-unread-e-chat")).toBeNull();
  });

  it("marks a task entry read and opens its project's planning tab", async () => {
    await render(<NotificationsSheet />);
    await fireEvent.press(screen.getByTestId("notification-event-e-task"));

    expect(mockMarkRead).toHaveBeenCalledWith({ ids: ["e-task"] });
    expect(mockCloseSheet).toHaveBeenCalled();
    expect(mockSelect).toHaveBeenCalledWith("p-other");
    expect(mockPush).toHaveBeenCalledWith("/(app)/(tabs)/planning");
  });

  it("opens the chat channel for a chat entry without marking an already read one", async () => {
    await render(<NotificationsSheet />);
    await fireEvent.press(screen.getByTestId("notification-event-e-chat"));

    expect(mockMarkRead).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/chat?channel=company%3Ac1");
  });

  it("counts unread activity from the server, beyond the loaded page", async () => {
    await render(<NotificationsSheet />);
    expect(screen.getByText(/84/)).toBeTruthy();
  });

  it("shows an entry with nowhere to go as a plain row with its own mark-read action", async () => {
    await render(<NotificationsSheet />);
    await fireEvent.press(screen.getByTestId("notification-event-e-gone"));
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockCloseSheet).not.toHaveBeenCalled();
    expect(mockMarkRead).not.toHaveBeenCalled();

    await fireEvent.press(
      screen.getByTestId("notification-event-mark-read-e-gone"),
    );
    expect(mockMarkRead).toHaveBeenCalledWith({ ids: ["e-gone"] });
    expect(mockCloseSheet).not.toHaveBeenCalled();
  });

  it("marks everything read without ids", async () => {
    await render(<NotificationsSheet />);
    await fireEvent.press(screen.getByTestId("notification-mark-all-read"));
    expect(mockMarkRead).toHaveBeenCalledWith({});
  });
});
