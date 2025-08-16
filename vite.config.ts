import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // small dev plugin to set COOP/COEP headers so SharedArrayBuffer works in local dev
    {
      name: "coop-coep-dev-headers",
      configureServer(server: import("vite").ViteDevServer) {
        server.middlewares.use((req: any, res: any, next: () => void) => {
          res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
          res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
          next();
        });
      },
    },
  ],
});
