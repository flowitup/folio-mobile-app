/**
 * Pins which endpoints the API client treats as carrying their own credentials.
 *
 * Those endpoints get no Bearer token attached, and — the part that matters —
 * their 401 is not run through the refresh-or-sign-out path. A wrong SMS code
 * answers 401, so mislabelling one of these clears a perfectly good stored
 * session because someone mistyped a digit.
 *
 * The list used to name `/auth/login`, which no longer exists, while omitting
 * the OTP endpoints that replaced it as the only way to sign in.
 */

import { isAuthPath } from "../api/client";

const BASE = "https://api.example.com";

describe("isAuthPath", () => {
  it.each([
    "/api/v1/auth/otp/request",
    "/api/v1/auth/otp/verify",
    "/api/v1/auth/signup/request",
    "/api/v1/auth/signup/verify",
    "/api/v1/auth/refresh",
    "/api/v1/invitations/accept",
    "/api/v1/invitations/accept/request-code",
  ])("treats %s as carrying its own credentials", (path) => {
    expect(isAuthPath(`${BASE}${path}`)).toBe(true);
  });

  it.each(["/api/v1/projects", "/api/v1/auth/me", "/api/v1/invitations"])(
    "leaves %s on the normal authenticated path",
    (path) => {
      expect(isAuthPath(`${BASE}${path}`)).toBe(false);
    },
  );

  it("no longer names the removed email sign-in endpoint", () => {
    expect(isAuthPath(`${BASE}/api/v1/auth/login`)).toBe(false);
  });
});
