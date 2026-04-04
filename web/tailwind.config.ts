import type { Config } from "tailwindcss";
import colors from "tailwindcss/colors";
import typography from "@tailwindcss/typography";

const config: Config = {
  darkMode: 'class',
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: colors.indigo,
        accent: colors.cyan,
        gray: colors.zinc,
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          '"Helvetica Neue"',
          "Arial",
          "sans-serif",
        ],
        mono: [
          "var(--font-mono)",
          '"JetBrains Mono"',
          '"SF Mono"',
          '"Fira Code"',
          '"Fira Mono"',
          "Menlo",
          "Consolas",
          '"Liberation Mono"',
          '"Courier New"',
          "monospace",
        ],
      },
      keyframes: {
        "grid-rows-expand": {
          "0%": { gridTemplateRows: "0fr" },
          "100%": { gridTemplateRows: "1fr" },
        },
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "modal-backdrop-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "modal-card-in": {
          "0%": { opacity: "0", transform: "scale(0.93) translateY(10px)" },
          "100%": { opacity: "1", transform: "scale(1) translateY(0)" },
        },
      },
      animation: {
        "grid-rows-expand": "grid-rows-expand 300ms ease-out forwards",
        "fade-in-up": "fade-in-up 500ms ease-out forwards",
        "fade-in": "fade-in 500ms ease-out forwards",
        "modal-backdrop": "modal-backdrop-in 200ms ease-out forwards",
        "modal-card": "modal-card-in 300ms cubic-bezier(0.32, 0.72, 0, 1) forwards",
      },
      transitionDelay: {
        0: "0ms",
        150: "150ms",
        300: "300ms",
        450: "450ms",
        600: "600ms",
      },
    },
  },
  plugins: [typography],
};

export default config;
