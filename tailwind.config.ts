import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: "var(--c-paper)",
        panel: "var(--c-sheet)",
        subtle: "var(--c-paper-2)",
        tint: "var(--c-tint)",
        ink: "var(--c-ink)",
        muted: "var(--c-ink-2)",
        line: "var(--c-rule)",
        lineStrong: "var(--c-rule-strong)",
        accent: "var(--c-ai)",
        accentDeep: "var(--c-ai-deep)",
        accentEdge: "var(--c-ai-edge)",
        controlEdge: "var(--c-control-edge)",
        mark: "var(--c-mark)",
        markSoft: "var(--c-mark-soft)",
        danger: "var(--c-shu)",
        success: "var(--c-green)",
        focus: "var(--c-focus)",
      },
      fontSize: {
        label: ["13px", "18px"],
        xl: ["22px", "28px"],
        display: ["48px", "52px"],
      },
      boxShadow: {
        raise: "inset 0 1px 0 rgb(255 255 255 / .22), 0 3px 0 var(--c-ai-edge), 0 4px 6px rgb(0 0 0 / .18)",
        "raise-light": "inset 0 1px 0 rgb(255 255 255 / 1), 0 2px 0 var(--c-control-edge), 0 3px 4px rgb(0 0 0 / .08)",
        press: "inset 0 2px 3px rgb(0 0 0 / .25)",
        "inset-field": "inset 0 2px 3px rgb(0 0 0 / .10)",
        sheet: "0 1px 0 var(--c-rule)",
      },
      backgroundImage: {
        raise: "linear-gradient(var(--c-sheet), var(--c-paper-2))",
      },
    },
  },
  plugins: [],
};

export default config;
