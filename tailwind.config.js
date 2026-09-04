/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      // Design tokens (2a hand-off) as CSS variables declared in global.css, light + dark.
      colors: {
        paper: "var(--paper)",
        "paper-2": "var(--paper-2)",
        card: "var(--card)",
        line: "var(--line)",
        "line-2": "var(--line-2)",
        ink: "var(--ink)",
        "ink-2": "var(--ink-2)",
        muted: "var(--muted)",
        "muted-2": "var(--muted-2)",
        "on-ink": "var(--on-ink)",
        accent: "var(--accent)",
        "accent-ink": "var(--accent-ink)",
        "accent-tint": "var(--accent-tint)",
        positive: "var(--positive)",
        "positive-tint": "var(--positive-tint)",
        warning: "var(--warning)",
        "warning-tint": "var(--warning-tint)",
        negative: "var(--negative)",
        "negative-tint": "var(--negative-tint)",
        scrim: "var(--scrim)",
        // Legacy names still used by screens written before the design pass.
        primary: "var(--ink)",
        "primary-foreground": "var(--on-ink)",
        "muted-foreground": "var(--muted)",
        border: "var(--line)",
        danger: "var(--negative)",
        success: "var(--positive)",
      },
      // One family per weight: custom fonts loaded through expo-font do not synthesize weights.
      fontFamily: {
        sans: ["Inter_400Regular"],
        "sans-medium": ["Inter_500Medium"],
        "sans-semibold": ["Inter_600SemiBold"],
        "sans-bold": ["Inter_700Bold"],
        serif: ["Fraunces_400Regular"],
        "serif-medium": ["Fraunces_500Medium"],
        mono: ["JetBrainsMono_500Medium"],
        "mono-regular": ["JetBrainsMono_400Regular"],
        "mono-semibold": ["JetBrainsMono_600SemiBold"],
        "mono-bold": ["JetBrainsMono_700Bold"],
      },
      borderRadius: {
        "2.5xl": "20px",
      },
    },
  },
  plugins: [],
};
