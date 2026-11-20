import { fireEvent, render, screen } from "@testing-library/react-native";

import i18n from "@/i18n";
import {
  NotificationsSheet,
  dueStatus,
} from "@/components/shell/notifications-sheet";

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
  useSelectedProject: () => ({
    projectId: "p-current",
    select: mockSelect,
    projects: [
      { id: "p-other", name: "Villa Ngoc", address: "12 rue de la Paix" },
    ],
  }),
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

  it("names the reminder's project, so the same title in two projects is not a duplicate", async () => {
    await render(<NotificationsSheet />);

    expect(screen.getByTestId("notification-project-n1")).toHaveTextContent(
      "Villa Ngoc",
    );
  });
});

describe("notifications sheet · due date (TM-14)", () => {
  it("counts the days a reminder is overdue, by calendar day", () => {
    expect(dueStatus("2026-11-17", "2026-11-20")).toEqual({
      kind: "overdue",
      days: 3,
    });
    expect(dueStatus("2026-11-20", "2026-11-20")).toEqual({ kind: "today" });
    expect(dueStatus("2026-11-21", "2026-11-20")).toEqual({
      kind: "upcoming",
    });
    // Across a DST change (25 Oct) still whole days.
    expect(dueStatus("2026-10-20", "2026-11-20")).toEqual({
      kind: "overdue",
      days: 31,
    });
  });

  it("shows a past due date as overdue, in red", async () => {
    // The fixture's reminder is due 2026-09-27, before any day this test runs on.
    await render(<NotificationsSheet />);
    const label = screen.getByTestId("notification-due-n1");
    expect(label).toHaveTextContent(
      i18n.t("notifications.overdue", {
        count:
          dueStatus("2026-09-27").kind === "overdue"
            ? (dueStatus("2026-09-27") as { days: number }).days
            : 0,
      }),
    );
    expect(label).toHaveProp(
      "className",
      expect.stringContaining("text-negative"),
    );
  });
});
