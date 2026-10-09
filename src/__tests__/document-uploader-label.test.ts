/**
 * The documents uploader filter never shows an erased account's placeholder address: the API
 * flags it (`is_deleted`, empty name) and the app names it as a former member.
 */
import { uploaderLabel } from "@/features/documents/documents-api";

// jest hoists this above the import.
jest.mock("@/api/client", () => ({ api: {} }));

describe("uploaderLabel", () => {
  it("shows the label the API sends (name, real e-mail or phone)", () => {
    expect(uploaderLabel({ user_id: "u1", display_name: "Alice Martin" })).toBe("Alice Martin");
    expect(
      uploaderLabel({ user_id: "u2", display_name: "+33620159009", phone: "+33620159009" }),
    ).toBe("+33620159009");
  });

  it("is null for an erased account, so the screen says former member", () => {
    expect(
      uploaderLabel({ user_id: "u3", display_name: "", phone: null, is_deleted: true }),
    ).toBeNull();
    expect(uploaderLabel({ user_id: "u4", display_name: "  " })).toBeNull();
  });
});
