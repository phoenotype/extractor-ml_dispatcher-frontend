import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootDir, "");
  // Browser never talks to Cloud Run directly. Dev proxy goes to the local BFF.
  const bffTarget = (
    env.BFF_URL ||
    `http://localhost:${env.BFF_PORT || "8787"}`
  ).replace(/\/$/, "");

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(rootDir, "src"),
      },
    },
    server: {
      proxy: {
        "/api/dispatcher": {
          target: bffTarget,
          changeOrigin: true,
        },
      },
    },
    test: {
      environment: "jsdom",
      globals: true,
      include: ["src/**/*.{test,spec}.{ts,tsx}"],
      exclude: ["node_modules/**", "dist/**", "app/**", "tests/**"],
    },
  };
});
