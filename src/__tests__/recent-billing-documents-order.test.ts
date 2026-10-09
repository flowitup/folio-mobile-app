/**
 * The "from existing document" picker lists the newest issue date first. The API sends
 * `issue_date` as RFC-1123 text, so comparing the strings sorted by weekday name ("Wed, 30 Sep"
 * came before "Fri, 09 Oct") instead of by date.
 */

import { byIssueDateDesc } from "@/features/billing/billing-documents-api";

jest.mock("@/api/client", () => ({ api: {} }));

describe("byIssueDateDesc", () => {
  it("orders RFC-1123 issue dates by date, newest first", () => {
    const docs = [
      { n: "9 Oct", issue_date: "Fri, 09 Oct 2026 00:00:00 GMT" },
      { n: "30 Sep", issue_date: "Wed, 30 Sep 2026 00:00:00 GMT" },
      { n: "1 Jan", issue_date: "Thu, 01 Jan 2026 00:00:00 GMT" },
      { n: "10 Oct", issue_date: "Sat, 10 Oct 2026 00:00:00 GMT" },
      { n: "5 Oct", issue_date: "Mon, 05 Oct 2026 00:00:00 GMT" },
    ].map((d) => ({ ...d, created_at: "2026-10-01T08:00:00Z" }));

    expect([...docs].sort(byIssueDateDesc).map((d) => d.n)).toEqual([
      "10 Oct",
      "9 Oct",
      "5 Oct",
      "30 Sep",
      "1 Jan",
    ]);
  });

  it("breaks a same-day tie by the newest creation", () => {
    const day = "Fri, 09 Oct 2026 00:00:00 GMT";
    const docs = [
      {
        n: "morning",
        issue_date: day,
        created_at: "Fri, 09 Oct 2026 08:00:00 GMT",
      },
      {
        n: "evening",
        issue_date: day,
        created_at: "Fri, 09 Oct 2026 20:00:00 GMT",
      },
    ];

    expect([...docs].sort(byIssueDateDesc).map((d) => d.n)).toEqual([
      "evening",
      "morning",
    ]);
  });
});
