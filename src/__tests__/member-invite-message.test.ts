import i18n from "@/i18n";
import {
  memberInviteMessage,
  nationalFrenchPhone,
} from "@/features/companies/member-invite-message";

const t = i18n.t.bind(i18n);

describe("the message sent to someone added by phone", () => {
  afterAll(async () => {
    await i18n.changeLanguage("vi");
  });

  it("writes the number the way its owner does", () => {
    expect(nationalFrenchPhone("+33612345678")).toBe("06 12 34 56 78");
    expect(nationalFrenchPhone("not a number")).toBe("not a number");
  });

  it.each(["vi", "fr", "en"])(
    "names the company, the number and the sign-up button (%s)",
    async (language) => {
      await i18n.changeLanguage(language);
      const message = memberInviteMessage(t, "Lavandou", "+33612345678", null);

      expect(message).toContain("Lavandou");
      expect(message).toContain("06 12 34 56 78");
      expect(message).toContain(t("login.createAccount"));
      expect(message).not.toContain("{{");
    },
  );

  it("adds the install link when the deployment has one", async () => {
    await i18n.changeLanguage("en");
    const message = memberInviteMessage(
      t,
      "Lavandou",
      "+33612345678",
      "https://example.test/app",
    );

    expect(message).toContain("https://example.test/app");
  });
});
