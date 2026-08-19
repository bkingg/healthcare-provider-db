import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

const dirname = import.meta.dirname;

// Fast, deterministic unit/component tests only — no live-database
// integration harness exists yet (see the geospatial-search plan notes), so
// this project intentionally scopes to pure-function and component-level
// tests rather than trying to spin up Postgres/PostGIS per test run.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.mts"],
    exclude: ["node_modules/**", ".next/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(dirname, "./src"),
      // Next.js's bundler special-cases these two marker packages (strips
      // "server-only" from server bundles, throws if it leaks into a client
      // one); outside that bundler — i.e. under Vitest — importing either
      // one for real always throws, so every server-only module in this
      // codebase would be untestable without this no-op alias.
      "server-only": path.resolve(dirname, "./vitest.empty-module.mts"),
      "client-only": path.resolve(dirname, "./vitest.empty-module.mts"),
    },
  },
});
