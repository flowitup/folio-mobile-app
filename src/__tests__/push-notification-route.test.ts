import { routeForNotification } from "@/lib/push/notification-route";

describe("routeForNotification", () => {
  it("opens the bell on the project for a manager push", () => {
    expect(
      routeForNotification({
        kind: "submitted",
        project_id: "p1",
        entry_id: "e1",
      }),
    ).toEqual({ projectId: "p1", sheet: "notifications" });
    expect(
      routeForNotification({ kind: "change_requested", project_id: "p1" }),
    ).toEqual({
      projectId: "p1",
      sheet: "notifications",
    });
  });

  it("only selects the project for a worker decision push", () => {
    expect(
      routeForNotification({ kind: "validated", project_id: "p2" }),
    ).toEqual({
      projectId: "p2",
      sheet: null,
    });
  });

  it("does nothing for unknown or empty payloads", () => {
    expect(routeForNotification(undefined)).toEqual({
      projectId: null,
      sheet: null,
    });
    expect(routeForNotification({ kind: "whatever" })).toEqual({
      projectId: null,
      sheet: null,
    });
  });
});
