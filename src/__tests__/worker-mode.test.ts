import { isWorkerMode } from "@/lib/labor/worker-mode";

const project = { my_permissions: ["project:read"] };

describe("isWorkerMode", () => {
  it("is off while the project or user is unknown", () => {
    expect(isWorkerMode(undefined, { id: "u" })).toBe(false);
    expect(isWorkerMode(project, null)).toBe(false);
  });

  it("restricts a plain member", () => {
    expect(
      isWorkerMode(project, { id: "u", permissions: ["project:read"] }),
    ).toBe(true);
  });

  it("no longer exempts a project owner without manage_labor (D6: owner bypass removed)", () => {
    expect(
      isWorkerMode(project, { id: "owner", permissions: ["project:read"] }),
    ).toBe(true);
  });

  it("keeps the full view when my_permissions grants manage_labor", () => {
    expect(
      isWorkerMode(
        {
          ...project,
          my_permissions: ["project:read", "project:manage_labor"],
        },
        { id: "u", permissions: ["project:read"] },
      ),
    ).toBe(false);
  });

  it("does not restore a D8 deny of manage_labor removed from my_permissions via the JWT claim", () => {
    expect(isWorkerMode(project, { id: "u", permissions: ["*:*"] })).toBe(true);
    expect(
      isWorkerMode(project, { id: "u", permissions: ["project:manage_labor"] }),
    ).toBe(true);
  });

  it("falls back to the JWT-wide list only when my_permissions has not loaded yet", () => {
    expect(
      isWorkerMode(
        { my_permissions: undefined },
        { id: "u", permissions: ["project:manage_labor"] },
      ),
    ).toBe(false);
    expect(isWorkerMode({}, { id: "u", permissions: ["*:*"] })).toBe(false);
  });
});
