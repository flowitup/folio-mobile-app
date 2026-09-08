import { resolveOnboardingRedirect } from "@/lib/auth/onboarding-route";
import type { OnboardingRedirectInput } from "@/lib/auth/onboarding-route";

const BASE: OnboardingRedirectInput = {
  platformOps: false,
  companiesReady: true,
  companyRoles: [],
  projectsReady: true,
  hasProjects: false,
  pathname: "/",
};

describe("resolveOnboardingRedirect", () => {
  it("sends a company-less user to the onboarding hub", () => {
    expect(resolveOnboardingRedirect({ ...BASE, companyRoles: [] })).toBe(
      "/onboarding",
    );
  });

  it("does not redirect while already on an onboarding screen", () => {
    for (const pathname of [
      "/onboarding",
      "/onboarding-create",
      "/join-company",
    ]) {
      expect(
        resolveOnboardingRedirect({ ...BASE, companyRoles: [], pathname }),
      ).toBeNull();
    }
  });

  it("waits for companies to resolve before redirecting", () => {
    expect(
      resolveOnboardingRedirect({
        ...BASE,
        companiesReady: false,
        companyRoles: [],
      }),
    ).toBeNull();
  });

  it("sends a member with no project assignment to the waiting screen", () => {
    expect(
      resolveOnboardingRedirect({
        ...BASE,
        companyRoles: ["member"],
        hasProjects: false,
      }),
    ).toBe("/onboarding-waiting");
  });

  it("does not wait when the member is assigned to a project", () => {
    expect(
      resolveOnboardingRedirect({
        ...BASE,
        companyRoles: ["member"],
        hasProjects: true,
      }),
    ).toBeNull();
  });

  it("does not wait when the caller is admin or manager somewhere", () => {
    expect(
      resolveOnboardingRedirect({
        ...BASE,
        companyRoles: ["member", "manager"],
        hasProjects: false,
      }),
    ).toBeNull();
    expect(
      resolveOnboardingRedirect({
        ...BASE,
        companyRoles: ["admin"],
        hasProjects: false,
      }),
    ).toBeNull();
  });

  it("bounces back out of onboarding once the condition is satisfied", () => {
    expect(
      resolveOnboardingRedirect({
        ...BASE,
        companyRoles: ["admin"],
        pathname: "/onboarding",
      }),
    ).toBe("/");
    expect(
      resolveOnboardingRedirect({
        ...BASE,
        companyRoles: ["member"],
        hasProjects: true,
        pathname: "/onboarding-waiting",
      }),
    ).toBe("/");
  });

  it("exempts platform-ops accounts from both gates", () => {
    expect(
      resolveOnboardingRedirect({
        ...BASE,
        platformOps: true,
        companyRoles: [],
      }),
    ).toBeNull();
  });

  it("waits for projects to resolve before sending a member to the waiting screen", () => {
    expect(
      resolveOnboardingRedirect({
        ...BASE,
        companyRoles: ["member"],
        projectsReady: false,
        hasProjects: false,
      }),
    ).toBeNull();
  });

  it("does not bounce /join-company back to home for an existing member or admin (opened from Settings)", () => {
    expect(
      resolveOnboardingRedirect({
        ...BASE,
        companyRoles: ["member"],
        hasProjects: true,
        pathname: "/join-company",
      }),
    ).toBeNull();
    expect(
      resolveOnboardingRedirect({
        ...BASE,
        companyRoles: ["admin"],
        pathname: "/join-company?another=1",
      }),
    ).toBeNull();
  });

  it("still treats /join-company (with or without ?another=1) as an onboarding path for a company-less user", () => {
    expect(
      resolveOnboardingRedirect({
        ...BASE,
        companyRoles: [],
        pathname: "/join-company",
      }),
    ).toBeNull();
    expect(
      resolveOnboardingRedirect({
        ...BASE,
        companyRoles: [],
        pathname: "/join-company?another=1",
      }),
    ).toBeNull();
  });

  it("still sends /onboarding and /onboarding-create back to home once a company exists", () => {
    expect(
      resolveOnboardingRedirect({
        ...BASE,
        companyRoles: ["admin"],
        pathname: "/onboarding-create",
      }),
    ).toBe("/");
  });
});
