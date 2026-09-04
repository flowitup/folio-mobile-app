import { loginModesFor } from "@/auth/auth-config";

describe("loginModesFor", () => {
  it("offers only the configured sign-in", () => {
    expect(loginModesFor("email")).toEqual(["email"]);
    expect(loginModesFor("phone")).toEqual(["phone"]);
  });

  it("offers both, phone first, for 'both' or when the config is unknown", () => {
    expect(loginModesFor("both")).toEqual(["phone", "email"]);
    expect(loginModesFor(undefined)).toEqual(["phone", "email"]);
  });
});
