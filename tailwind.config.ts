import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Elevated monochrome, borrowed from the Universal Experience Framework:
        // a warm off-white paper + deep ink, not stark black/white. One coherent
        // system so every decision adds up (Aesthetic-Usability Effect).
        ink: "#0a0a0a", // deep ink foreground
        paper: "#f5f5f0", // warm off-white
        clay: "#0a0a0a", // ink accent — buttons, selection
        sage: "#6b6b66", // muted grey for secondary text/chips
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "-apple-system", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      letterSpacing: {
        eyebrow: "0.3em",
      },
    },
  },
  plugins: [],
};

export default config;
