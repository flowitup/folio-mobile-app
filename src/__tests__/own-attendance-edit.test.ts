import { classifyOwnEdit } from "@/lib/labor/own-attendance-edit";

const validated = {
  shift_type: "full" as const,
  supplement_hours: 2,
  note: "Site A",
  change_requested_at: null,
  proposed_shift_type: null,
  proposed_supplement_hours: null,
  proposed_note: null,
};

describe("classifyOwnEdit", () => {
  it("refuses a proposal identical to the validated day", () => {
    expect(
      classifyOwnEdit(validated, {
        shift_type: "full",
        supplement_hours: 2,
        note: " Site A ",
      }),
    ).toBe("unchanged");
  });

  it("treats a blank note like no note", () => {
    expect(
      classifyOwnEdit(
        { ...validated, note: null },
        { shift_type: "full", supplement_hours: 2, note: "   " },
      ),
    ).toBe("unchanged");
  });

  it("accepts a real change", () => {
    expect(
      classifyOwnEdit(validated, {
        shift_type: "half",
        supplement_hours: 2,
        note: "Site A",
      }),
    ).toBe("ok");
    expect(
      classifyOwnEdit(validated, {
        shift_type: "full",
        supplement_hours: 3,
        note: "Site A",
      }),
    ).toBe("ok");
  });

  it("refuses re-sending the change request already waiting", () => {
    const withRequest = {
      ...validated,
      change_requested_at: "2026-09-06T10:00:00Z",
      proposed_shift_type: "half" as const,
      proposed_supplement_hours: 0,
      proposed_note: null,
    };
    expect(
      classifyOwnEdit(withRequest, {
        shift_type: "half",
        supplement_hours: 0,
        note: "",
      }),
    ).toBe("duplicate_request");
    // A different proposal replaces the open request.
    expect(
      classifyOwnEdit(withRequest, {
        shift_type: "overtime",
        supplement_hours: 1,
        note: null,
      }),
    ).toBe("ok");
  });

  it("applies the unchanged rule to a pending day too", () => {
    expect(
      classifyOwnEdit(
        { ...validated, supplement_hours: 0, note: null },
        { shift_type: "full", supplement_hours: 0, note: null },
      ),
    ).toBe("unchanged");
  });
});
