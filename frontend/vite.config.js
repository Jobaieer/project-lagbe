import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://localhost:3000" } },
  root: "frontend",
  build: { outDir: "../dist", emptyOutDir: true, chunkSizeWarningLimit: 600 },
});
