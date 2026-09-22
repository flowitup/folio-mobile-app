import { isWorkerMode, needsWorkerLink } from "@/lib/labor/worker-mode";

const project = { my_permissions: ["project:read"] };
const managerProject = {
  my_permissions: ["project:read", "project:manage_labor"],
};
/** The project's roster: one row linked to `u`, one linked to nobody, one to someone else. */
const ROSTER = [{ user_id: "u" }, { user_id: null }, { user_id: "u-other" }];
const ROSTER_WITHOUT_U = [{ user_id: null }, { user_id: "u-other" }];

describe("isWorkerMode", () => {
  it("is off while the project or user is unknown", () => {
    expect(isWorkerMode(undefined, { id: "u" }, ROSTER)).toBe(false);
    expect(isWorkerMode(project, null, ROSTER)).toBe(false);
  });

  it("restricts a member linked to one of the project's workers", () => {
    expect(
      isWorkerMode(project, { id: "u", permissions: ["project:read"] }, ROSTER),
    ).toBe(true);
  });

  it("leaves a member nobody linked to a worker in the normal shell (#100)", () => {
    const member = { id: "u", permissions: ["project:read"] };
    expect(isWorkerMode(project, member, ROSTER_WITHOUT_U)).toBe(false);
    expect(isWorkerMode(project, member, [])).toBe(false);
  });

  it("keeps the restricted shell while the roster is unknown, so a worker's shell never flashes", () => {
    expect(
      isWorkerMode(
        project,
        { id: "u", permissions: ["project:read"] },
        undefined,
      ),
    ).toBe(true);
  });

  it("never matches an unlinked row against an account without an id", () => {
    expect(
      isWorkerMode(project, { permissions: ["project:read"] }, [
        { user_id: null },
      ]),
    ).toBe(false);
  });

  it("no longer exempts a project owner without manage_labor (D6: owner bypass removed)", () => {
    expect(
      isWorkerMode(project, { id: "u", permissions: ["project:read"] }, ROSTER),
    ).toBe(true);
  });

  it("keeps the full view for a manager, linked to a worker or not", () => {
    const manager = { id: "u", permissions: ["project:read"] };
    expect(isWorkerMode(managerProject, manager, ROSTER)).toBe(false);
    expect(isWorkerMode(managerProject, manager, undefined)).toBe(false);
    expect(needsWorkerLink(managerProject, manager)).toBe(false);
  });

  it("does not restore a D8 deny of manage_labor removed from my_permissions via the JWT claim", () => {
    expect(
      isWorkerMode(project, { id: "u", permissions: ["*:*"] }, ROSTER),
    ).toBe(true);
    expect(
      isWorkerMode(
        project,
        { id: "u", permissions: ["project:manage_labor"] },
        ROSTER,
      ),
    ).toBe(true);
  });

  it("falls back to the JWT-wide list only when my_permissions has not loaded yet", () => {
    expect(
      isWorkerMode(
        { my_permissions: undefined },
        { id: "u", permissions: ["project:manage_labor"] },
        ROSTER,
      ),
    ).toBe(false);
    expect(isWorkerMode({}, { id: "u", permissions: ["*:*"] }, ROSTER)).toBe(
      false,
    );
  });
});

describe("needsWorkerLink", () => {
  it("is true only for a signed-in non-manager on a loaded project", () => {
    expect(
      needsWorkerLink(project, { id: "u", permissions: ["project:read"] }),
    ).toBe(true);
    expect(needsWorkerLink(undefined, { id: "u" })).toBe(false);
    expect(needsWorkerLink(project, null)).toBe(false);
  });
});
