import { routeForNotification } from "@/lib/push/notification-route";

describe("routeForNotification", () => {
  it("opens the bell on the project for a manager push", () => {
    expect(
      routeForNotification({
        kind: "submitted",
        project_id: "p1",
        entry_id: "e1",
      }),
    ).toEqual({ projectId: "p1", sheet: "notifications", path: null });
    expect(
      routeForNotification({ kind: "change_requested", project_id: "p1" }),
    ).toEqual({
      projectId: "p1",
      sheet: "notifications",
      path: null,
    });
  });

  it("only selects the project for a worker decision push", () => {
    expect(
      routeForNotification({ kind: "validated", project_id: "p2" }),
    ).toEqual({
      projectId: "p2",
      sheet: null,
      path: null,
    });
  });

  it("opens the notes section for a due reminder", () => {
    expect(
      routeForNotification({ kind: "note_due", project_id: "p3" }),
    ).toEqual({
      projectId: "p3",
      sheet: null,
      path: "/projects/p3/notes",
    });
  });

  it("opens the members section when an invitation is accepted", () => {
    expect(
      routeForNotification({ kind: "invitation_accepted", project_id: "p4" }),
    ).toEqual({
      projectId: "p4",
      sheet: null,
      path: "/projects/p4/members",
    });
  });

  it("opens the bell for a new company member, which has no project screen", () => {
    expect(routeForNotification({ kind: "member_joined" })).toEqual({
      projectId: null,
      sheet: "notifications",
      path: null,
    });
  });

  it("never builds a section path without a project", () => {
    expect(routeForNotification({ kind: "note_due" })).toEqual({
      projectId: null,
      sheet: null,
      path: null,
    });
  });

  it("ignores inherited object keys as kinds", () => {
    expect(
      routeForNotification({ kind: "constructor", project_id: "p5" }),
    ).toEqual({
      projectId: "p5",
      sheet: null,
      path: null,
    });
  });

  it("does nothing for unknown or empty payloads", () => {
    expect(routeForNotification(undefined)).toEqual({
      projectId: null,
      sheet: null,
      path: null,
    });
    expect(routeForNotification({ kind: "whatever" })).toEqual({
      projectId: null,
      sheet: null,
      path: null,
    });
  });
});
