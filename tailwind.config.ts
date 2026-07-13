import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#3B82F6",
          dark: "#2563EB",
          light: "#60A5FA"
        },
        dark: {
          DEFAULT: "#0F172A",
          deeper: "#020617"
        },
        success: {
          DEFAULT: "#22C55E",
          dark: "#16A34A"
        },
        danger: {
          DEFAULT: "#EF4444",
          dark: "#DC2626"
        }
      }
    }
  },
  plugins: []
}
export default config
