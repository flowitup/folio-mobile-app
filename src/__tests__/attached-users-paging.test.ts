import { fetchAllAttachedUsers } from "@/features/companies/company-members-api";

const mockGet = jest.fn();
jest.mock("@/api/client", () => ({ api: { GET: (...args: unknown[]) => mockGet(...args) } }));

const user = (id: string) => ({
  user_id: id,
  is_primary: false,
  attached_at: "2026-01-01T00:00:00Z",
  role: "member",
});

describe("fetchAllAttachedUsers", () => {
  it("follows total page after page, so members past the first page are listed", async () => {
    const page1 = Array.from({ length: 200 }, (_, i) => user(`u-${i}`));
    const page2 = Array.from({ length: 5 }, (_, i) => user(`u-${200 + i}`));
    mockGet
      .mockResolvedValueOnce({ data: { items: page1, total: 205 }, response: { ok: true, status: 200 } })
      .mockResolvedValueOnce({ data: { items: page2, total: 205 }, response: { ok: true, status: 200 } });

    const all = await fetchAllAttachedUsers("co-1");

    expect(all).toHaveLength(205);
    expect(mockGet.mock.calls.map((c) => c[1].params.query)).toEqual([
      { limit: 200, offset: 0 },
      { limit: 200, offset: 200 },
    ]);
  });
});
