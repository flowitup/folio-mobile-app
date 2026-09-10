import type { CompanyPersonEntry } from "@/features/companies/company-members-api";
import type { Worker } from "@/features/labor/labor-types";
import {
  directoryCandidates,
  prefillFromDirectory,
} from "@/lib/labor/company-directory-candidates";

function person(over: Partial<CompanyPersonEntry> = {}): CompanyPersonEntry {
  return {
    person_id: "p-1",
    name: "Zoe Martin",
    phone: "+33600000001",
    linked_user_id: null,
    assigned_project_ids: [],
    is_active: true,
    pending: false,
    labor_role_id: null,
    default_daily_rate: null,
    ...over,
  };
}

function worker(over: Partial<Worker> = {}): Worker {
  return {
    id: "w-1",
    project_id: "proj-1",
    name: "Zoe Martin",
    phone: null,
    daily_rate: 120,
    is_active: true,
    created_at: "2026-09-01T08:00:00Z",
    ...over,
  };
}

describe("directoryCandidates", () => {
  it("drops people who already have a worker row on the project", () => {
    const entries = [
      person({ person_id: "p-1", name: "Alice" }),
      person({ person_id: "p-2", name: "Bob" }),
    ];
    const result = directoryCandidates(entries, [worker({ person_id: "p-1" })]);
    expect(result.map((entry) => entry.person_id)).toEqual(["p-2"]);
  });

  it("ignores workers with no linked person instead of dropping everyone", () => {
    const entries = [person({ person_id: "p-1", name: "Alice" })];
    const result = directoryCandidates(entries, [
      worker({ person_id: null }),
      worker({ id: "w-2" }),
    ]);
    expect(result).toHaveLength(1);
  });

  it("drops deactivated company profiles", () => {
    const entries = [
      person({ person_id: "p-1", name: "Alice", is_active: false }),
      person({ person_id: "p-2", name: "Bob" }),
    ];
    expect(directoryCandidates(entries, []).map((e) => e.name)).toEqual([
      "Bob",
    ]);
  });

  it("keeps a pending profile — a worker need not have signed up yet", () => {
    const entries = [
      person({ person_id: "p-1", name: "Alice", pending: true }),
    ];
    expect(directoryCandidates(entries, [])).toHaveLength(1);
  });

  it("does not use assigned_project_ids, which reports access and not labor", () => {
    const entries = [
      person({
        person_id: "p-1",
        name: "Alice",
        assigned_project_ids: ["proj-1"],
      }),
    ];
    expect(directoryCandidates(entries, [])).toHaveLength(1);
  });

  it("sorts by name and tolerates missing inputs", () => {
    const entries = [
      person({ person_id: "p-2", name: "Bob" }),
      person({ person_id: "p-1", name: "Alice" }),
    ];
    expect(directoryCandidates(entries, undefined).map((e) => e.name)).toEqual([
      "Alice",
      "Bob",
    ]);
    expect(directoryCandidates(undefined, undefined)).toEqual([]);
  });
});

describe("prefillFromDirectory", () => {
  it("carries the company rate, role and linked account — never the identity", () => {
    expect(
      prefillFromDirectory(
        person({
          name: "Alice",
          phone: "+33600000002",
          default_daily_rate: 145.5,
          labor_role_id: "role-1",
          linked_user_id: "user-1",
        }),
      ),
    ).toEqual({
      rate: "145.5",
      roleId: "role-1",
      userId: "user-1",
    });
  });

  it("leaves the rate empty when the company profile carries none", () => {
    expect(
      prefillFromDirectory(person({ default_daily_rate: null })).rate,
    ).toBe("");
  });

  it("keeps a zero company rate visible rather than blanking it", () => {
    expect(prefillFromDirectory(person({ default_daily_rate: 0 })).rate).toBe(
      "0",
    );
  });
});
