import type { Config } from "tailwindcss";

const config = {
  theme: {
    extend: {
      colors: {
        canvas: "#f6f8f5",
        surface: "#ffffff",
        ink: "#17231e",
        muted: "#66736c",
        line: "#dfe7e1",
        sage: {
          50: "#f1f6f2",
          100: "#e2ede5",
          200: "#c4dbc9",
          300: "#9cc1a5",
          400: "#72a47e",
          500: "#528761",
          600: "#3f6c4d",
          700: "#35573f",
          800: "#2d4635",
          900: "#263a2d",
        },
        slate: {
          850: "#1c2b25",
          950: "#101b16",
        },
        amber: {
          soft: "#fff8e8",
          line: "#f3d79d",
          ink: "#875e13",
        },
        indigo: {
          action: "#4f5dba",
          hover: "#414da0",
          soft: "#eef0ff",
        },
      },
      boxShadow: {
        card: "0 16px 50px -28px rgba(28, 43, 37, 0.28)",
        lift: "0 22px 60px -24px rgba(28, 43, 37, 0.34)",
      },
      borderRadius: {
        "2xl": "1.25rem",
        "3xl": "1.75rem",
      },
    },
  },
} satisfies Config;

export default config;
