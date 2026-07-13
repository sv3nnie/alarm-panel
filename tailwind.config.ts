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
          DEFAULT: "#2563EB",
          dark: "#1D4ED8"
        },
        success: {
          DEFAULT: "#16A34A",
          dark: "#15803D"
        },
        danger: {
          DEFAULT: "#DC2626",
          dark: "#B91C1C"
        }
      }
    }
  },
  plugins: []
}
export default config
