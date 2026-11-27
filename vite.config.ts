import { defineConfig } from "vite";

export default defineConfig({
  base: "/",
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true
  },
  preview: {
    host: "0.0.0.0",
    port: 4175,
    strictPort: true
  },
  build: {
    target: "es2022",
    sourcemap: false,
    assetsInlineLimit: 4096
  }
});
