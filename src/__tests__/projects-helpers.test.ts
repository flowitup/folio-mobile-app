import { toUpdateBody } from "../features/projects/project-form-sheet";
import { projectCan } from "../features/projects/projects-api";
import type { Project } from "../features/projects/projects-api";

const project = { my_permissions: ["project:update"] } as unknown as Project;

describe("projectCan", () => {
  it("accepts project-scoped, wildcard and global permissions", () => {
    expect(projectCan(project, "project:update")).toBe(true);
    expect(projectCan(project, "project:delete")).toBe(false);
    expect(projectCan(project, "project:delete", ["project:*"])).toBe(true);
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
