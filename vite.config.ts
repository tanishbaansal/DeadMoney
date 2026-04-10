import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter()],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    proxy: {
      // Proxy earn.li.fi to avoid CORS in dev
      "/earn-api": {
        target: "https://earn.li.fi",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/earn-api/, ""),
      },
      // Proxy li.quest Composer to avoid CORS in dev
      "/composer-api": {
        target: "https://li.quest",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/composer-api/, ""),
      },
    },
  },
});
