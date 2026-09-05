import { isWorkerMode } from "@/lib/labor/worker-mode";

const project = { owner_id: "owner", my_permissions: ["project:read"] };

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

  it("keeps the full view for the owner, superadmins and labor managers", () => {
    expect(isWorkerMode(project, { id: "owner", permissions: [] })).toBe(false);
    expect(isWorkerMode(project, { id: "u", permissions: ["*:*"] })).toBe(
      false,
    );
    expect(isWorkerMode(project, { id: "u", permissions: ["project:*"] })).toBe(
      false,
    );
    expect(
      isWorkerMode(project, { id: "u", permissions: ["project:manage_labor"] }),
    ).toBe(false);
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
});
