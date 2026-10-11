import { fireEvent, render, screen } from "@testing-library/react-native";

import "@/i18n";
import { NotificationsSheet } from "@/components/shell/notifications-sheet";

/**
 * A reminder can belong to a project other than the one the shell shows: opening it must
 * select that project, as a tapped push does, so the tabs and the notes screen agree.
 */
const mockPush = jest.fn();
const mockSelect = jest.fn();
const mockCloseSheet = jest.fn();

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
jest.mock("@/features/notes/notes-api", () => ({
  useNotifications: () => ({
    isPending: false,
    data: {
      items: [
        {
          dismissed: false,
          note: {
            id: "n1",
            project_id: "p-other",
            title: "Call the plumber",
            category: "general",
            due_date: "2026-09-27",
          },
        },
      ],
      attendance_pending: [],
      company_events: [],
    },
  }),
  useDismissNotification: () => ({ mutate: jest.fn() }),
  useMarkActivityRead: () => ({ mutate: jest.fn() }),
}));

describe("notifications sheet · reminder", () => {
  it("selects the reminder's project before opening its notes", async () => {
    await render(<NotificationsSheet />);
    await fireEvent.press(screen.getByTestId("notification-n1"));

    expect(mockCloseSheet).toHaveBeenCalled();
    expect(mockSelect).toHaveBeenCalledWith("p-other");
    expect(mockPush).toHaveBeenCalledWith("/projects/p-other/notes");
    expect(mockSelect.mock.invocationCallOrder[0]).toBeLessThan(
      mockPush.mock.invocationCallOrder[0],
    );
  });
});
