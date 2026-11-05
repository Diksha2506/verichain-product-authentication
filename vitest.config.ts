import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // The service-layer tests assert the deterministic offline mock path; the
    // application itself defaults to the live backend (see API_CONFIG).
    env: { VITE_USE_MOCK: "true" },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
