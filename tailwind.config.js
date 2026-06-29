/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // 요리종류(cuisine) 색상 — RULES R0 코드와 1:1
        cuisine: {
          KR: "#ef4444", // 한식
          CN: "#f59e0b", // 중식
          JP: "#3b82f6", // 일식
          WS: "#8b5cf6", // 양식
          DINEOUT: "#6b7280", // 외식
        },
      },
    },
  },
  plugins: [],
};
