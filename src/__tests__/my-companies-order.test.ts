/**
 * "My companies" lists the primary company first, then the oldest attachment — the API and web
 * order, so all of them default to the same company. The API sends
 * `attached_at` as RFC-1123 text, so comparing the strings sorted by weekday name ("Thu, 08 Oct"
 * came before "Mon, 12 Oct") instead of by date.
 */

import {
  byPrimaryThenOldest,
  currentCompanyId,
} from "@/features/companies/companies-api";

jest.mock("@/api/client", () => ({ api: {} }));
jest.mock("@/auth/auth-context", () => ({ useAuth: () => ({ user: null }) }));

describe("byPrimaryThenOldest", () => {
  it("keeps the primary first, then the oldest attachment first", () => {
    const companies = [
      {
        name: "Older",
        is_primary: false,
        attached_at: "Thu, 08 Oct 2026 09:00:00 GMT",
      },
      {
        name: "Newest",
        is_primary: false,
        attached_at: "Fri, 16 Oct 2026 09:00:00 GMT",
      },
      {
        name: "Primary",
        is_primary: true,
        attached_at: "Wed, 01 Jan 2025 09:00:00 GMT",
      },
      {
        name: "Newer",
        is_primary: false,
        attached_at: "Mon, 12 Oct 2026 09:00:00 GMT",
      },
    ];

    expect([...companies].sort(byPrimaryThenOldest).map((c) => c.name)).toEqual(
      ["Primary", "Older", "Newer", "Newest"],
    );
  });

  it("also orders ISO timestamps by instant", () => {
    const companies = [
      {
        name: "Morning",
        is_primary: false,
        attached_at: "2026-10-09T08:00:00Z",
      },
      {
        name: "Evening",
        is_primary: false,
        attached_at: "2026-10-09T20:00:00Z",
      },
    ];

    expect([...companies].sort(byPrimaryThenOldest).map((c) => c.name)).toEqual(
      ["Morning", "Evening"],
    );
  });
});

describe("currentCompanyId", () => {
  const company = (id: string, is_primary: boolean) => ({ id, is_primary });

  it("prefers the primary company", () => {
    expect(currentCompanyId([company("a", false), company("b", true)])).toBe(
      "b",
    );
  });

  it("falls back to the only company when an admin attached it (never primary)", () => {
    expect(currentCompanyId([company("a", false)])).toBe("a");
  });

  it("takes the oldest attachment with several companies and no primary, as the API does", () => {
    expect(currentCompanyId([company("a", false), company("b", false)])).toBe(
      "a",
    );
  });

  it("has none without data", () => {
    expect(currentCompanyId([])).toBe(undefined);
    expect(currentCompanyId(undefined)).toBe(undefined);
  });
});
