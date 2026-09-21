import {
  isChosenOption,
  orderChannels,
  parseCardPayload,
  parseChoicePayload,
  parseJobStatusPayload,
} from "@/lib/chat/assistant";

describe("orderChannels", () => {
  it("pins the assistant channel first without otherwise reordering the list", () => {
    const channels = [
      { key: "company:1", kind: "company" },
      { key: "assistant:me", kind: "assistant" },
      { key: "project:1", kind: "project" },
    ];
    expect(orderChannels(channels).map((c) => c.key)).toEqual([
      "assistant:me",
      "company:1",
      "project:1",
    ]);
  });

  it("is a no-op when there is no assistant channel", () => {
    const channels = [
      { key: "company:1", kind: "company" },
      { key: "project:1", kind: "project" },
    ];
    expect(orderChannels(channels)).toEqual(channels);
  });

  it("leaves an already-first assistant channel where it is", () => {
    const channels = [
      { key: "assistant:me", kind: "assistant" },
      { key: "company:1", kind: "company" },
    ];
    expect(orderChannels(channels).map((c) => c.key)).toEqual([
      "assistant:me",
      "company:1",
    ]);
  });
});

describe("parseCardPayload", () => {
  it("parses a full invoice card", () => {
    const payload = {
      card: {
        type: "invoice",
        id: "inv-1",
        project_id: "proj-1",
        title: "Ciment Lafarge 25kg",
        subtitle: "Confirmé",
        badge: "confirmed",
        thumbnail_url: "/api/v1/attachments/x",
      },
    };
    expect(parseCardPayload(payload)).toEqual({
      type: "invoice",
      id: "inv-1",
      projectId: "proj-1",
      title: "Ciment Lafarge 25kg",
      subtitle: "Confirmé",
      badge: "confirmed",
      thumbnailUrl: "/api/v1/attachments/x",
    });
  });

  it("defaults the optional fields to null", () => {
    const payload = { card: { type: "material", id: "m1", title: "Ciment" } };
    expect(parseCardPayload(payload)).toEqual({
      type: "material",
      id: "m1",
      projectId: null,
      title: "Ciment",
      subtitle: null,
      badge: null,
      thumbnailUrl: null,
    });
  });

  it.each([
    null,
    undefined,
    {},
    { card: {} },
    { card: { type: "other", id: "x", title: "y" } },
    { card: { type: "invoice", id: "x" } },
  ])("returns null for a malformed payload", (payload) => {
    expect(parseCardPayload(payload as never)).toBeNull();
  });
});

describe("parseChoicePayload", () => {
  it("parses an unanswered choice", () => {
    const payload = {
      prompt: "Confirmer le matériau ?",
      options: [
        { label: "Confirmer", action: "confirm", payload: {} },
        { label: "Annuler", action: "cancel" },
      ],
      answered: null,
    };
    expect(parseChoicePayload(payload)).toEqual({
      prompt: "Confirmer le matériau ?",
      options: [
        { label: "Confirmer", action: "confirm", payload: {} },
        { label: "Annuler", action: "cancel", payload: {} },
      ],
      answered: null,
      answeredPayload: null,
    });
  });

  it("keeps the recorded option payload so same-action options can be told apart", () => {
    const options = [
      { label: "A", action: "set_project", payload: { project_id: "a" } },
      { label: "B", action: "set_project", payload: { project_id: "b" } },
    ];
    const parsed = parseChoicePayload({
      prompt: "Quel chantier ?",
      options,
      answered: "set_project",
      answered_payload: { project_id: "b" },
    });
    expect(parsed?.answeredPayload).toEqual({ project_id: "b" });
    expect(isChosenOption(options[0], "set_project", { project_id: "b" })).toBe(
      false,
    );
    expect(isChosenOption(options[1], "set_project", { project_id: "b" })).toBe(
      true,
    );
    // Older servers record only the action: every option with that action counts as chosen.
    expect(isChosenOption(options[0], "set_project", null)).toBe(true);
    expect(isChosenOption(options[0], "cancel", null)).toBe(false);
  });

  it("carries the server's answered action through unchanged", () => {
    const payload = {
      prompt: "x",
      options: [{ label: "Confirmer", action: "confirm", payload: {} }],
      answered: "confirm",
    };
    expect(parseChoicePayload(payload)?.answered).toBe("confirm");
  });

  it("returns null when an option is missing its label or action", () => {
    expect(
      parseChoicePayload({ prompt: "x", options: [{ label: "Only label" }] }),
    ).toBeNull();
  });

  it("returns null when the prompt or options are missing", () => {
    expect(parseChoicePayload(null)).toBeNull();
    expect(parseChoicePayload({ prompt: "x" })).toBeNull();
    expect(parseChoicePayload({ options: [] })).toBeNull();
  });
});

describe("parseJobStatusPayload", () => {
  it("parses a running job with a progress fraction", () => {
    expect(
      parseJobStatusPayload({
        job_id: "j1",
        state: "running",
        text: "Envoi de la photo…",
        progress: 0.4,
      }),
    ).toEqual({
      jobId: "j1",
      state: "running",
      text: "Envoi de la photo…",
      progress: 0.4,
    });
  });

  it("defaults a missing progress to null", () => {
    expect(
      parseJobStatusPayload({ job_id: "j1", state: "done", text: "Fini" }),
    ).toEqual({ jobId: "j1", state: "done", text: "Fini", progress: null });
  });

  it("returns null for an unknown state or missing fields", () => {
    expect(
      parseJobStatusPayload({ job_id: "j1", state: "weird", text: "x" }),
    ).toBeNull();
    expect(parseJobStatusPayload({ state: "done", text: "x" })).toBeNull();
    expect(parseJobStatusPayload(null)).toBeNull();
  });
});
