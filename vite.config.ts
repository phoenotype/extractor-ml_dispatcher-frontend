import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootDir, "");
  const dispatcherTarget = (
    env.DISPATCHER_API_URL ||
    env.VITE_DISPATCHER_API_URL ||
    "http://localhost:8000"
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
          target: dispatcherTarget,
          changeOrigin: true,
          rewrite: (requestPath) =>
            requestPath.replace(/^\/api\/dispatcher/, "") || "/",
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
