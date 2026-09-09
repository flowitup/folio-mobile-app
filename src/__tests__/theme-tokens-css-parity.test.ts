import { readFileSync } from "fs";
import { join } from "path";

import {
  CSS_VARIABLE_NAMES,
  DARK,
  INK_BLOCK,
  LIGHT,
  initialOf,
  workerColor,
} from "@/theme/tokens";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const tailwind = require("../../tailwind.config.js") as {
  theme: { extend: { colors: Record<string, string> } };
};

const css = readFileSync(join(__dirname, "../../global.css"), "utf8");

/** Reads every `--name: value;` declared inside the first `{...}` block following `marker`. */
function variablesAfter(marker: string): Record<string, string> {
  const start = css.indexOf(marker);
  const block = css.slice(css.indexOf("{", start) + 1);
  const end = block.indexOf("}");
  const vars: Record<string, string> = {};
  for (const line of block.slice(0, end).split("\n")) {
    const match = /^\s*(--[a-z0-9-]+):\s*(.+);\s*$/.exec(line);
    if (match) vars[match[1]] = match[2];
  }
  return vars;
}

describe("design tokens", () => {
  const light = variablesAfter(":root");
  const dark = variablesAfter("@media (prefers-color-scheme: dark)");

  it("global.css light palette matches tokens.ts", () => {
    for (const [key, variable] of Object.entries(CSS_VARIABLE_NAMES)) {
      if (key === "shadowCard") continue; // shadows are applied from JS only
      expect(light[variable]).toBe(LIGHT[key as keyof typeof LIGHT]);
    }
  });

  it("global.css dark palette matches tokens.ts", () => {
    for (const [key, variable] of Object.entries(CSS_VARIABLE_NAMES)) {
      if (key === "shadowCard") continue;
      expect(dark[variable]).toBe(DARK[key as keyof typeof DARK]);
    }
  });

  it("tailwind ink-block colors mirror INK_BLOCK", () => {
    const colors = tailwind.theme.extend.colors;
    expect(colors["ink-block"]).toBe(INK_BLOCK.bg);
    expect(colors["on-ink-block"]).toBe(INK_BLOCK.text);
    expect(colors["on-ink-block-2"]).toBe(INK_BLOCK.text2);
    expect(colors["ink-block-muted"]).toBe(INK_BLOCK.muted);
    expect(colors["ink-block-line"]).toBe(INK_BLOCK.line);
    expect(colors["ink-block-tile"]).toBe(INK_BLOCK.tile);
    expect(colors["ink-block-accent"]).toBe(INK_BLOCK.accent);
  });

  it("worker colors prefer the role color and cycle the default palette", () => {
    expect(workerColor(LIGHT, "#123456", 0)).toBe("#123456");
    expect(workerColor(LIGHT, null, 0)).toBe(LIGHT.accent);
    expect(workerColor(LIGHT, null, 1)).toBe(LIGHT.positive);
    expect(workerColor(LIGHT, null, 4)).toBe(LIGHT.accent);
  });

  it("initials take the first character, upper-cased", () => {
    expect(initialOf("nguyễn Văn Tài")).toBe("N");
    expect(initialOf("  ")).toBe("?");
    expect(initialOf("Đức")).toBe("Đ");
  });
});
