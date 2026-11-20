import { fireEvent, render, screen } from "@testing-library/react-native";

import { FitFigure } from "@/features/dashboard/fit-figure";
import { KpiRow } from "@/features/labor/kpi-row";
import {
  fitFontSize,
  kpiCardWidth,
  kpiColumns,
  monoTextWidth,
} from "@/lib/dashboard/fit-figure";
import { Text } from "react-native";

/** P-11: an amount shrinks to its box, then wraps — never "415,00…". */
describe("fitFontSize", () => {
  it("keeps the size when the figure fits or the box is not laid out yet", () => {
    expect(fitFontSize("415,00 €", 200, 18)).toEqual({
      fontSize: 18,
      wrap: false,
    });
    expect(fitFontSize("415,00 €", 0, 18)).toEqual({
      fontSize: 18,
      wrap: false,
    });
  });

  it("shrinks down to the minimum scale", () => {
    const width = monoTextWidth("415,00 €", 18) * 0.8;
    const fit = fitFontSize("415,00 €", width, 18);
    expect(fit.wrap).toBe(false);
    expect(fit.fontSize).toBeLessThan(18);
    expect(fit.fontSize).toBeGreaterThanOrEqual(18 * 0.7);
    expect(monoTextWidth("415,00 €", fit.fontSize)).toBeLessThanOrEqual(width);
  });

  it("wraps instead of shrinking past the minimum scale", () => {
    expect(fitFontSize("123.456,00 €", 40, 18)).toEqual({
      fontSize: 18 * 0.7,
      wrap: true,
    });
  });
});

describe("kpiColumns", () => {
  it("keeps three cards on a row while each fits its widest figure", () => {
    expect(kpiColumns(3, 600, 8, 120)).toBe(3);
  });

  it("goes to two columns on a 360 px phone with a wide amount", () => {
    const minWidth = kpiCardWidth(["40", "0", "8.715,00 €"], 18);
    // 360 px screen − 2 × 16 px gutter.
    expect(kpiColumns(3, 328, 8, minWidth)).toBe(2);
  });

  it("never splits one or two cards", () => {
    expect(kpiColumns(2, 100, 8, 400)).toBe(2);
  });
});

describe("FitFigure", () => {
  it("shows the whole amount on one line, smaller once laid out in a narrow box", async () => {
    await render(<FitFigure testID="fig" text="415,00 €" size={18} />);
    const figure = screen.getByTestId("fig");
    expect(figure).toHaveTextContent("415,00 €");
    expect(figure.props.numberOfLines).toBe(1);
    await fireEvent(screen.getByTestId("fig-box"), "layout", {
      nativeEvent: { layout: { width: 60, height: 20, x: 0, y: 0 } },
    });
    const after = screen.getByTestId("fig");
    expect(after.props.numberOfLines).toBe(2);
    expect(after.props.style).toMatchObject({ fontSize: 18 * 0.7 });
  });
});

describe("KpiRow", () => {
  it("wraps the third card onto its own row when narrow", async () => {
    await render(
      <KpiRow testID="row" minCardWidth={130}>
        <Text>a</Text>
        <Text>b</Text>
        <Text>c</Text>
      </KpiRow>,
    );
    const row = screen.getByTestId("row");
    await fireEvent(row, "layout", {
      nativeEvent: { layout: { width: 328, height: 80, x: 0, y: 0 } },
    });
    const cells = screen.getByTestId("row").children as unknown as {
      props: { style: Record<string, number> };
    }[];
    expect(cells[0].props.style).toMatchObject({ flexBasis: 160, flexGrow: 1 });
  });
});
