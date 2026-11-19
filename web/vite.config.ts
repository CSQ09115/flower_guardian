import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [react()],
  base: "/",
  publicDir: r("./public"),
  build: {
    outDir: r("./dist"),
    emptyOutDir: true,
    rollupOptions: {
      input: { site: r("./index.html"), admin: r("./admin/index.html") },
    },
  },
  server: { port: 4177, host: "127.0.0.1" },
  preview: { port: 4177, host: "127.0.0.1" },
});
