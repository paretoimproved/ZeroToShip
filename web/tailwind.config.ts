import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#f0f9ff",
          100: "#e0f2fe",
          200: "#bae6fd",
          300: "#7dd3fc",
          400: "#38bdf8",
          500: "#0ea5e9",
          600: "#0284c7",
          700: "#0369a1",
          800: "#075985",
          900: "#0c4a6e",
        },
      },
      fontFamily: {
        mono: [
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
  plugins: [],
};

export default config;
