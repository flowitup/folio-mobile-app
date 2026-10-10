/**
 * "My companies" lists the primary company first, then the most recently attached. The API sends
 * `attached_at` as RFC-1123 text, so comparing the strings sorted by weekday name ("Thu, 08 Oct"
 * came before "Mon, 12 Oct") instead of by date.
 */

import { byPrimaryThenRecent } from "@/features/companies/companies-api";

jest.mock("@/api/client", () => ({ api: {} }));
jest.mock("@/auth/auth-context", () => ({ useAuth: () => ({ user: null }) }));

describe("byPrimaryThenRecent", () => {
  it("keeps the primary first, then the newest attachment first", () => {
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

    expect([...companies].sort(byPrimaryThenRecent).map((c) => c.name)).toEqual(
      ["Primary", "Newest", "Newer", "Older"],
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

    expect([...companies].sort(byPrimaryThenRecent).map((c) => c.name)).toEqual(
      ["Evening", "Morning"],
    );
  });
});
