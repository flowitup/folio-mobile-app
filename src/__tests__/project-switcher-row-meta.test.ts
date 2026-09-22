import { projectRowMeta } from "@/components/shell/project-switcher-sheet";
import type { Project } from "@/features/projects/projects-api";

/**
 * Switcher row meta. A null budget is the backend hiding the financing from a caller without
 * `project:view_budget`, not a project that has none — claiming "no budget set" there is wrong,
 * and so is drawing a 0 % gauge against a figure the row was never given.
 */
const t = (key: string, options?: Record<string, unknown>) =>
  options ? `${key}:${JSON.stringify(options)}` : key;

function row(budget: number | null): Project {
  return {
    id: "p1",
    name: "Chantier",
    address: "1 rue de la Recette",
    budget,
    spent: 640,
    user_count: 3,
  } as unknown as Project;
}

describe("projectRowMeta", () => {
  it("says nothing about the budget and draws no bar when it is hidden", () => {
    const meta = projectRowMeta(row(null), t);

    expect(meta.pct).toBeNull();
    expect(meta.meta).not.toContain("shell.noBudget");
    expect(meta.remain).toContain("shell.spentNoBudget");
  });

  it("still calls out a budget that is really unset", () => {
    const meta = projectRowMeta(row(0), t);

    expect(meta.meta).toContain("shell.noBudget");
    expect(meta.pct).toBe(0);
  });

  it("measures spend against a budget the caller can read", () => {
    const meta = projectRowMeta(row(1280), t);

    expect(meta.pct).toBe(50);
    expect(meta.tone).toBe("ink");
  });

  it("shows no spend line to a caller without a money permission", () => {
    const meta = projectRowMeta(row(1280), t, false);
    expect(meta.remain).toBe("");
    expect(meta.pct).toBeNull();
  });
});
