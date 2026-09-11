import {
  InviteActionError,
  acceptInvite,
  requestInviteCode,
  verifyInvite,
} from "@/features/invitations/invitations-api";

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

const mockFetch = jest.fn();

beforeEach(() => {
  mockFetch.mockReset();
  global.fetch = mockFetch as unknown as typeof fetch;
});

describe("requestInviteCode", () => {
  it("resolves with the code's lifetime on 202", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(202, { expires_in: 300 }));

    const result = await requestInviteCode({
      token: "tok",
      phone: "+33612345678",
    });

    expect(result).toEqual({ expiresIn: 300 });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/invitations/accept/request-code"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it.each([
    [400, {}, "invalid_phone"],
    [404, {}, "not_found"],
    [409, { reason: "phone_registered" }, "phone_registered"],
    [409, {}, "generic"],
    [410, { reason: "expired" }, "expired"],
    [410, { reason: "revoked" }, "revoked"],
    [410, { reason: "accepted" }, "accepted"],
    [410, {}, "expired"],
    [429, {}, "throttled"],
    [503, {}, "sms_failed"],
    [500, {}, "generic"],
  ] as const)(
    "maps HTTP %i (%j) to reason %s",
    async (status, body, reason) => {
      mockFetch.mockResolvedValueOnce(jsonResponse(status, body));

      await expect(
        requestInviteCode({ token: "tok", phone: "+33612345678" }),
      ).rejects.toMatchObject({ reason });
    },
  );

  it("throws InviteActionError even when the body is not JSON", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => {
        throw new Error("not json");
      },
    } as unknown as Response);

    const caught = await requestInviteCode({
      token: "tok",
      phone: "+33612345678",
    }).catch((error: unknown) => error);

    expect(caught).toBeInstanceOf(InviteActionError);
    expect((caught as InviteActionError).reason).toBe("throttled");
  });
});

describe("acceptInvite", () => {
  it("resolves on 200 without throwing (no tokens in the body — see module doc)", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, { user: { id: "u1", email: "a@example.com" } }),
    );

    await expect(
      acceptInvite({
        token: "tok",
        name: "New User",
        phone: "+33612345678",
        code: "424242",
      }),
    ).resolves.toBeUndefined();
  });

  it("rejects with reason invalid_code on a wrong or expired code", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(401, {
        error: "Unauthorized",
        message: "Invalid or expired code",
      }),
    );

    await expect(
      acceptInvite({
        token: "tok",
        name: "N",
        phone: "+33612345678",
        code: "000000",
      }),
    ).rejects.toMatchObject({ reason: "invalid_code" });
  });

  it("rejects with reason phone_registered on a 409 conflict", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(409, { reason: "phone_registered" }),
    );

    await expect(
      acceptInvite({
        token: "tok",
        name: "N",
        phone: "+33612345678",
        code: "424242",
      }),
    ).rejects.toMatchObject({ reason: "phone_registered" });
  });

  it("rejects with the invitation's own reason on a 410", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(410, { reason: "accepted" }));

    await expect(
      acceptInvite({
        token: "tok",
        name: "N",
        phone: "+33612345678",
        code: "424242",
      }),
    ).rejects.toMatchObject({ reason: "accepted" });
  });
});

describe("verifyInvite", () => {
  it("returns the invite details on 200", async () => {
    const invite = {
      email: "a@example.com",
      expires_at: "2026-09-20T00:00:00Z",
      inviter_name: "Admin",
      project_name: "Chantier",
      role_name: "member",
    };
    mockFetch.mockResolvedValueOnce(jsonResponse(200, invite));

    await expect(verifyInvite("tok")).resolves.toEqual(invite);
  });

  it("reports not_found on 404", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(404, {}));

    await expect(verifyInvite("tok")).resolves.toEqual({ error: "not_found" });
  });

  it("reports the reason from the body on 410", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(410, { reason: "revoked" }));

    await expect(verifyInvite("tok")).resolves.toEqual({ error: "revoked" });
  });
});
