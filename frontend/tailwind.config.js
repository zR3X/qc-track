/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Red Hat Text'", "system-ui", "-apple-system", "sans-serif"],
        display: ["'Red Hat Display'", "system-ui", "-apple-system", "sans-serif"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fadeIn 0.3s ease-in-out",
        "slide-up": "slideUp 0.3s ease-out",
        "new-sample": "newSample 4s ease-out forwards",
        "progress-carousel": "progressCarousel 5s linear forwards",
      },
      keyframes: {
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideUp: { "0%": { opacity: "0", transform: "translateY(10px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        newSample: {
          "0%":   { boxShadow: "0 0 0 6px rgba(74,222,128,0.65)" },
          "60%":  { boxShadow: "0 0 0 8px rgba(74,222,128,0.25)" },
          "100%": { boxShadow: "0 0 0 0px rgba(74,222,128,0)" },
        },
        progressCarousel: {
          "0%":   { width: "0%" },
          "100%": { width: "100%" },
        },
      },
    },
  },
  plugins: [],
};
