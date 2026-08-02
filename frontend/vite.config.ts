import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import netlify from "@netlify/vite-plugin-tanstack-start";

export default defineConfig({
  plugins: [tanstackStart({ server: { entry: "server" } }), netlify(), react(), tailwindcss()],
  resolve: {
    tsconfigPaths: true,
  },
  optimizeDeps: {
    include: ["@firebase/app", "@firebase/auth"],
  },
  server: {
    host: "127.0.0.1",
    port: 8080,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
      },
    },
  },
});
