/** @type {import('tailwindcss').Config} */

// Warm gray scale (replaces the default cool slate/neutral) for a considered,
// content-first aesthetic. Backgrounds are off-white, text is near-black-warm.
const warm = {
  50: "#FAFAF8",
  100: "#F4F3EF",
  200: "#E7E5DF",
  300: "#D6D3CA",
  400: "#A8A39A",
  500: "#79746B",
  600: "#57534D",
  700: "#44403B",
  800: "#2A2722",
  900: "#1A1A1A",
};

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ['"IBM Plex Serif"', "ui-serif", "Georgia", "serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      colors: {
        // Deeper, considered forest green.
        brand: {
          50: "#EEF4F1",
          100: "#D6E5DD",
          200: "#AECBBE",
          300: "#7FAB97",
          500: "#2F7259",
          600: "#28604B",
          700: "#1F4D3F",
          800: "#173B30",
          900: "#102A22",
        },
        // Muted gold/amber, used sparingly.
        accent: {
          400: "#CDA85A",
          500: "#B8923D",
          600: "#9A7A31",
          700: "#7C6228",
        },
        neutral: warm,
        slate: warm,
      },
    },
  },
  plugins: [],
};
