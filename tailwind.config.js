/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      // Design tokens — the later design pass changes these, not the screens.
      colors: {
        primary: "#171717",
        "primary-foreground": "#ffffff",
        muted: "#f5f5f5",
        "muted-foreground": "#737373",
        border: "#e5e5e5",
        danger: "#dc2626",
        success: "#16a34a",
        warning: "#d97706",
      },
    },
  },
  plugins: [],
};
