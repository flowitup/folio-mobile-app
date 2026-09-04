import { useColorScheme } from "react-native";

/**
 * Design tokens of the 2a hand-off (README "Design tokens"). `global.css` declares the same
 * values as CSS variables for NativeWind classes; this module serves the places that need a
 * plain color string (icons, ActivityIndicator, shadows, inline styles). A Jest test keeps the
 * two in sync.
 */
export const LIGHT = {
  paper: "#f5f1ea",
  paper2: "#efe9de",
  card: "#ffffff",
  line: "#e3dccd",
  line2: "#d6cdbb",
  ink: "#1a1a1a",
  ink2: "#2c2a26",
  muted: "#8a8479",
  muted2: "#b8b1a4",
  onInk: "#f5f1ea",
  accent: "#e8843c",
  accentInk: "#b96523",
  accentTint: "#fbe7d4",
  positive: "#5a7a4a",
  positiveTint: "#e6ecdc",
  warning: "#c98e2b",
  warningTint: "#f5e9cf",
  negative: "#b3543d",
  negativeTint: "#f3dccf",
  scrim: "rgba(26,26,26,0.35)",
  shadowCard: "0 1px 0 rgba(26,26,26,0.02), 0 8px 24px -16px rgba(26,26,26,0.08)",
} as const;

export const DARK: Tokens = {
  paper: "#171513",
  paper2: "#211e1a",
  card: "#1f1c18",
  line: "#302b25",
  line2: "#3d372f",
  ink: "#f1ece3",
  ink2: "#d9d2c5",
  muted: "#9c948a",
  muted2: "#6b645b",
  onInk: "#171513",
  accent: "#ee9552",
  accentInk: "#f2b07d",
  accentTint: "#3a2718",
  positive: "#8fb07a",
  positiveTint: "#26301f",
  warning: "#d9a44a",
  warningTint: "#372b14",
  negative: "#d0785f",
  negativeTint: "#3a2119",
  scrim: "rgba(0,0,0,0.55)",
  shadowCard: "",
};

export type Tokens = { [K in keyof typeof LIGHT]: string };

/** Maps the camelCase token name to the `--kebab` variable declared in global.css. */
export const CSS_VARIABLE_NAMES: Record<keyof Tokens, string> = {
  paper: "--paper",
  paper2: "--paper-2",
  card: "--card",
  line: "--line",
  line2: "--line-2",
  ink: "--ink",
  ink2: "--ink-2",
  muted: "--muted",
  muted2: "--muted-2",
  onInk: "--on-ink",
  accent: "--accent",
  accentInk: "--accent-ink",
  accentTint: "--accent-tint",
  positive: "--positive",
  positiveTint: "--positive-tint",
  warning: "--warning",
  warningTint: "--warning-tint",
  negative: "--negative",
  negativeTint: "--negative-tint",
  scrim: "--scrim",
  shadowCard: "--shadow-card",
};

/** Palette for the active color scheme. */
export function useTokens(): Tokens {
  return useColorScheme() === "dark" ? DARK : LIGHT;
}

/** Card shadow as a style object (empty in dark mode, where the design drops shadows). */
export function cardShadow(tokens: Tokens): { boxShadow?: string } {
  return tokens.shadowCard ? { boxShadow: tokens.shadowCard } : {};
}

/**
 * Default worker colors when a worker has no labor-role color (README "Worker colors"):
 * accent, positive, warning, ink-2 — cycled by position.
 */
export function workerColor(
  tokens: Tokens,
  roleColor: string | null | undefined,
  index: number,
): string {
  if (roleColor) return roleColor;
  const palette = [tokens.accent, tokens.positive, tokens.warning, tokens.ink2];
  return palette[((index % palette.length) + palette.length) % palette.length];
}

/** First letter of a name for initials tiles; falls back to "?" for empty names. */
export function initialOf(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim();
  return trimmed ? Array.from(trimmed)[0].toUpperCase() : "?";
}
