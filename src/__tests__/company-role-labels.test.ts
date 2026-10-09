import i18n from "@/i18n";

/**
 * The company role badge ("Vai trò: …", member lists, the account sheet, invitations) reads
 * `companies.x.<role>`. Vietnamese had "Thành viên" and "Quản lý" but left the admin as the
 * English "Admin", unlike the web ("Quản trị viên").
 */
describe("company role labels", () => {
  const vi = i18n.getFixedT("vi");
  const en = i18n.getFixedT("en");

  it("translates every company role in Vietnamese", () => {
    expect(vi("companies.x.admin")).toBe("Quản trị viên");
    for (const role of ["admin", "manager", "member"])
      expect(vi(`companies.x.${role}`)).not.toBe(en(`companies.x.${role}`));
  });
});
