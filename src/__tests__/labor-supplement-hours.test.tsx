import { fireEvent, screen } from "@testing-library/react-native";
import { createRef } from "react";

import {
  EditEntrySheet,
  type SheetHandle,
} from "@/features/labor/labor-sheets";
import i18n, { DEFAULT_LOCALE } from "@/i18n";
import { parseSupplementHours } from "@/lib/labor/supplement-hours";
import {
  ENTRY_MINH_PENDING,
  renderWithProviders,
} from "./helpers/release-qa-fixtures";

/**
 * Typed extra hours were coerced with `Number(text) || 0` and clamped to 0-12, so "1,5"
 * was saved as 0 and "14" as 12 behind a success toast. They are now refused instead.
 */
jest.mock("@/api/client", () => ({
  api: { GET: jest.fn(async () => ({ data: [], response: { status: 200 } })) },
}));

describe("parseSupplementHours", () => {
  it("accepts whole hours from 0 to 12, blank meaning 0", () => {
    expect(parseSupplementHours("")).toBe(0);
    expect(parseSupplementHours(" 0 ")).toBe(0);
    expect(parseSupplementHours("7")).toBe(7);
    expect(parseSupplementHours("12")).toBe(12);
  });

  it("refuses decimals, values over 12 and other text", () => {
    for (const text of ["1,5", "1.5", "13", "14", "-1", "abc", "123"])
      expect(parseSupplementHours(text)).toBeNull();
  });
});

describe("EditEntrySheet extra hours", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });
  afterAll(async () => {
    await i18n.changeLanguage(DEFAULT_LOCALE);
  });

  async function renderSheet(onSubmit: jest.Mock) {
    await renderWithProviders(
      <EditEntrySheet
        ref={createRef<SheetHandle>()}
        entry={{
          ...ENTRY_MINH_PENDING,
          shift_type: "half",
          supplement_hours: 0,
        }}
        submitting={false}
        onSubmit={onSubmit}
        onDelete={jest.fn()}
      />,
    );
  }

  it.each(["1,5", "14"])("blocks Save for %s", async (typed) => {
    const onSubmit = jest.fn();
    await renderSheet(onSubmit);
    await fireEvent.changeText(screen.getByTestId("entry-supplement"), typed);
    expect(screen.getByTestId("entry-blocked-hint")).toHaveTextContent(
      "Extra hours must be a whole number from 0 to 12.",
    );
    await fireEvent.press(screen.getByTestId("entry-save"));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("saves a valid value as typed", async () => {
    const onSubmit = jest.fn();
    await renderSheet(onSubmit);
    await fireEvent.changeText(screen.getByTestId("entry-supplement"), "3");
    expect(screen.queryByTestId("entry-blocked-hint")).toBeNull();
    await fireEvent.press(screen.getByTestId("entry-save"));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ shift_type: "half", supplement_hours: 3 }),
    );
  });
});

describe("EditEntrySheet pending day", () => {
  it("validates or refuses a worker's self-logged day from the sheet", async () => {
    const onDecide = jest.fn();
    await renderWithProviders(
      <EditEntrySheet
        ref={createRef<SheetHandle>()}
        entry={{ ...ENTRY_MINH_PENDING, status: "pending" }}
        submitting={false}
        onSubmit={jest.fn()}
        onDelete={jest.fn()}
        onDecide={onDecide}
      />,
    );
    await fireEvent.press(screen.getByTestId("entry-validate"));
    await fireEvent.press(screen.getByTestId("entry-reject"));
    expect(onDecide.mock.calls).toEqual([[true], [false]]);
  });

  it("shows no decision for a validated day", async () => {
    await renderWithProviders(
      <EditEntrySheet
        ref={createRef<SheetHandle>()}
        entry={{
          ...ENTRY_MINH_PENDING,
          status: "validated",
          change_requested_at: null,
        }}
        submitting={false}
        onSubmit={jest.fn()}
        onDelete={jest.fn()}
        onDecide={jest.fn()}
      />,
    );
    expect(screen.queryByTestId("entry-decision")).toBeNull();
  });
});
