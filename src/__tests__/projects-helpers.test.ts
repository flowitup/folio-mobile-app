import { toUpdateBody } from "../features/projects/project-form-sheet";
import { projectCan } from "../features/projects/projects-api";
import type { Project } from "../features/projects/projects-api";

const project = { my_permissions: ["project:update"] } as unknown as Project;

describe("projectCan", () => {
  it("accepts a project-scoped permission or a project-scoped wildcard", () => {
    expect(projectCan(project, "project:update")).toBe(true);
    expect(projectCan(project, "project:delete")).toBe(false);
    expect(
      projectCan(
        { my_permissions: ["project:*"] } as unknown as Project,
        "project:delete",
      ),
    ).toBe(true);
  });

  it("does not OR the global (JWT-wide) list back in once my_permissions is loaded — it is authoritative", () => {
    // A D8 deny that removed `project:delete` from `my_permissions` is not restored by the
    // JWT-wide claim still listing a broader `project:*` wildcard.
    expect(projectCan(project, "project:delete", ["project:*"])).toBe(false);
  });

  it("falls back to the global list only when the project has not loaded my_permissions yet", () => {
    expect(projectCan(undefined, "project:create", ["*:*"])).toBe(true);
    expect(projectCan(undefined, "project:create", [])).toBe(false);
  });
});

describe("toUpdateBody", () => {
  it("maps form values to the PUT body with explicit nulls", () => {
    expect(
      toUpdateBody({
        name: "A",
        address: null,
        budget: 10,
        budget_source: null,
      }),
    ).toEqual({
      name: "A",
      address: null,
      budget: 10,
      budget_source: null,
      invoice_prefix: null,
    });
  });
});
