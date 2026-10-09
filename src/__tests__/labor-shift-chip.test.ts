import { shiftChip } from "@/features/labor/labor-panels";
import type { LaborEntry } from "@/features/labor/labor-types";

const t = (key: string) => key;
const entry = (
  shift_type: LaborEntry["shift_type"],
  supplement_hours: number,
) => ({ shift_type, supplement_hours }) as LaborEntry;

describe("shiftChip", () => {
  it("adds supplement hours to a shift", () => {
    expect(shiftChip(entry("half", 2), t).label).toBe("labor.shift.half + 2 h");
    expect(shiftChip(entry("full", 1), t).label).toBe("labor.shift.full + 1 h");
    expect(shiftChip(entry("overtime", 3), t).label).toBe(
      "labor.shift.overtime + 3 h",
    );
  });

  it("shows the shift alone without supplement hours", () => {
    expect(shiftChip(entry("full", 0), t)).toEqual({
      label: "labor.shift.full",
      tone: "success",
    });
  });

  it("shows only the hours for a supplement-only entry", () => {
    expect(shiftChip(entry(null, 4), t)).toEqual({
      label: "+4 h",
      tone: "accent",
    });
  });
});
