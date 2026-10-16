import { inviteRouteOf, redirectSystemPath } from "../../app/+native-intent";
import { protectedPathOf } from "@/lib/auth/pending-deep-link";

describe("protectedPathOf (a link opened while signed out, replayed after sign-in)", () => {
  it.each([
    ["folio://projects/p1/documents", "/projects/p1/documents"],
    ["https://folio.example/projects/p1/documents", "/projects/p1/documents"],
    ["http://localhost:19006/projects/p1/documents", "/projects/p1/documents"],
    ["exp://192.168.1.2:8081/--/projects/p1?tab=docs", "/projects/p1?tab=docs"],
  ])("keeps the screen %s asks for", (url, path) => {
    expect(protectedPathOf(url)).toBe(path);
  });

  it.each([
    null,
    "folio://",
    "http://localhost:19006/",
    "exp://192.168.1.2:8081",
    "folio://signup",
    "folio://accept-invite/tok",
    "https://folio.example/fr/accept-invite/tok",
  ])("ignores %s (home, or open without a session)", (url) => {
    expect(protectedPathOf(url)).toBeNull();
  });
});

describe("+native-intent: invitation links from e-mails", () => {
  it("maps the web's locale-prefixed invitation path to the app screen", () => {
    expect(
      redirectSystemPath({
        path: "https://folio.example/fr/accept-invite/abc123",
        initial: true,
      }),
    ).toBe("/accept-invite/abc123");
    expect(inviteRouteOf("/vi/accept-invite/abc123?x=1")).toBe(
      "/accept-invite/abc123",
    );
  });

  it("leaves every other path alone", () => {
    expect(
      redirectSystemPath({ path: "folio://projects/p1", initial: false }),
    ).toBe("folio://projects/p1");
  });
});
