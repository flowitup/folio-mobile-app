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

  it("opens the chat channel for a chat push, selecting the project behind a project channel", () => {
    expect(
      routeForNotification({ kind: "chat_message", channel_key: "project:p5" }),
    ).toEqual({
      projectId: "p5",
      sheet: null,
      path: "/chat?channel=project%3Ap5",
    });
    expect(
      routeForNotification({ kind: "chat_message", channel_key: "company:c1" }),
    ).toEqual({
      projectId: null,
      sheet: null,
      path: "/chat?channel=company%3Ac1",
    });
  });

  it("opens the planning tab on the project for task pushes", () => {
    for (const kind of ["task_assigned", "task_moved"]) {
      expect(
        routeForNotification({ kind, project_id: "p6", task_id: "t1" }),
      ).toEqual({
        projectId: "p6",
        sheet: null,
        path: "/(app)/(tabs)/planning",
      });
    }
  });

  it("selects the project when added to it, and only opens the app when removed", () => {
    expect(
      routeForNotification({ kind: "project_member_added", project_id: "p7" }),
    ).toEqual({ projectId: "p7", sheet: null, path: null });
    expect(
      routeForNotification({
        kind: "project_member_removed",
        project_id: "p7",
      }),
    ).toEqual({ projectId: null, sheet: null, path: null });
    expect(
      routeForNotification({
        kind: "company_member_removed",
        company_id: "c1",
      }),
    ).toEqual({ projectId: null, sheet: null, path: null });
  });

  it("opens the company members screen for role and permission changes", () => {
    for (const kind of [
      "company_member_role_changed",
      "company_member_grants_changed",
    ]) {
      expect(routeForNotification({ kind, company_id: "c2" })).toEqual({
        projectId: null,
        sheet: null,
        path: "/company/members",
      });
    }
  });

  it("opens the expense itself for a refund push, the expenses tab without an invoice id", () => {
    expect(
      routeForNotification({
        kind: "refund_completed",
        project_id: "p8",
        invoice_id: "i1",
      }),
    ).toEqual({
      projectId: "p8",
      sheet: null,
      path: "/projects/p8/invoices/i1",
    });
    expect(
      routeForNotification({ kind: "refund_requested", project_id: "p8" }),
    ).toEqual({ projectId: "p8", sheet: null, path: "/(app)/(tabs)/expenses" });
  });

  it("opens the billing document for a status push", () => {
    expect(
      routeForNotification({
        kind: "billing_status",
        document_id: "d1",
        status: "paid",
      }),
    ).toEqual({ projectId: null, sheet: null, path: "/billing/documents/d1" });
  });
});
