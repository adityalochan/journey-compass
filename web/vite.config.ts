import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The site reads Tarun's shared data and types from ../src, so allow Vite to serve the repo root.
export default defineConfig({
  plugins: [react()],
  server: { fs: { allow: [".."] } },
});
