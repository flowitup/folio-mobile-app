import { joinErrorKey } from "@/lib/companies/join-error-message";
import { ApiError } from "@/lib/query/api-error";

describe("joinErrorKey", () => {
  it("names the two ways a code fails for a normal user", () => {
    expect(
      joinErrorKey(
        new ApiError(404, "NotFound", "Unknown or revoked company code"),
      ),
    ).toBe("companies.join.errors.unknownCode");
    expect(
      joinErrorKey(
        new ApiError(409, "Conflict", "You already belong to this company"),
      ),
    ).toBe("companies.join.errors.alreadyMember");
  });

  it("keeps the server's own wording for anything else", () => {
    // A catch-all string would lose detail the backend bothered to give.
    expect(joinErrorKey(new ApiError(500, "ServerError", "boom"))).toBeNull();
    expect(joinErrorKey(new Error("offline"))).toBeNull();
    expect(joinErrorKey(undefined)).toBeNull();
  });
});
