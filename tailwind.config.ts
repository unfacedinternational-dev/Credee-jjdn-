import type { Config } from "tailwindcss";
const config: Config = { content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"], theme: { extend: { colors: { ink: "#100d1c", panel: "#1b1630", violet: "#8b5cf6", gold: "#f5c56b" }, boxShadow: { glow: "0 20px 80px rgba(139,92,246,.16)" } } }, plugins: [] };
export default config;
