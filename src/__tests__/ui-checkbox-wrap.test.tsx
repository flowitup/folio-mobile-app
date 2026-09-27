import { render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { Checkbox } from "@/components/ui/primitives";

/**
 * A long checkbox label (a refundable expense: number · recipient · amount · project) wrapped
 * at the row's width, ignoring the box beside it, so its lines ran past the right edge.
 */
describe("Checkbox", () => {
  it("lets its label shrink to the space left of the box", async () => {
    const label = "INV-2026-0042 · Leroy Merlin · 36,36 € · QA-api-project";
    await render(<Checkbox label={label} value={false} onChange={() => {}} />);
    const text = screen.getByText(label);
    const style = StyleSheet.flatten(text.props.style) ?? {};
    const className = String(text.props.className ?? "");
    expect(style.flex === 1 || /\bflex-1\b/.test(className)).toBe(true);
  });
});
