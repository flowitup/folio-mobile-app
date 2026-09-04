import { loginModesFor } from "@/auth/auth-config";

describe("loginModesFor", () => {
  it("offers only the configured sign-in", () => {
    expect(loginModesFor("email")).toEqual(["email"]);
    expect(loginModesFor("phone")).toEqual(["phone"]);
  });

  it("offers both, phone first, only when the backend activates email too", () => {
    expect(loginModesFor("both")).toEqual(["phone", "email"]);
  });

  it("hides email while the config is unknown", () => {
    expect(loginModesFor(undefined)).toEqual(["phone"]);
    expect(loginModesFor("weird")).toEqual(["phone"]);
  });
});
