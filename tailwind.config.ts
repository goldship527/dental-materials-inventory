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
        surface: "#f7f7f4",
        ink: "#1f2933",
        muted: "#667085",
        line: "#d8ddd7",
        accent: "#0f766e",
        warning: "#b7791f",
        danger: "#b42318",
      },
      boxShadow: {
        panel: "0 1px 2px rgba(16, 24, 40, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
