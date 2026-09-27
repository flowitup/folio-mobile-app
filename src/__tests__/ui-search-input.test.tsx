import { render, screen } from "@testing-library/react-native";

import { SearchInput } from "@/components/ui/input";

/**
 * Search fields used to be raw TextInputs without the app font (iOS drew their placeholder
 * with wide letter spacing) and with a hard-coded grey placeholder instead of the theme colour.
 */
describe("SearchInput", () => {
  it("uses the app font, the theme placeholder colour and the caller's layout class", async () => {
    await render(
      <SearchInput testID="search" placeholder="Search" className="flex-1" />,
    );
    const input = screen.getByTestId("search");
    expect(input.props.placeholderTextColor).toBe("#b8b1a4");
  });
});
