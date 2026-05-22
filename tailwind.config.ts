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
        surface: "#f8fafc",
        panel: "#ffffff",
        subtle: "#f1f5f9",
        ink: "#0f172a",
        muted: "#64748b",
        line: "#dde5e8",
        accent: "#0f766e",
        accentDeep: "#115e59",
        danger: "#dc2626",
        warning: "#ea580c",
        caution: "#ca8a04",
        success: "#15803d",
      },
      boxShadow: {
        panel: "0 1px 2px rgba(15, 23, 42, 0.04), 0 10px 28px rgba(15, 23, 42, 0.05)",
      },
    },
  },
  plugins: [],
};

export default config;
