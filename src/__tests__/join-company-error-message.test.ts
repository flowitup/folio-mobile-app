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

  it("names the rate limit, whose server text is no sentence in any language", () => {
    // flask-limiter answers "10 per 1 minute" — even an English UI must not show that.
    expect(
      joinErrorKey(new ApiError(429, "TooManyRequests", "10 per 1 minute")),
    ).toBe("common.errors.tooManyRequests");
  });

  it("leaves anything else to the generic API error text", () => {
    // The screen falls back to apiErrorMessage (offline, 5xx, other statuses).
    expect(joinErrorKey(new ApiError(500, "ServerError", "boom"))).toBeNull();
    expect(joinErrorKey(new Error("offline"))).toBeNull();
    expect(joinErrorKey(undefined)).toBeNull();
  });
});
