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
      "/earn-api": {
        target: "https://earn.li.fi",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/earn-api/, ""),
      },
      "/composer-api": {
        target: "https://li.quest",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/composer-api/, ""),
      },
      // Proxy Alchemy RPC calls to avoid CORS
      "/rpc/eth": {
        target: "https://eth-mainnet.g.alchemy.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/rpc\/eth/, ""),
      },
      "/rpc/base": {
        target: "https://base-mainnet.g.alchemy.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/rpc\/base/, ""),
      },
      "/rpc/arb": {
        target: "https://arb-mainnet.g.alchemy.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/rpc\/arb/, ""),
      },
      "/rpc/opt": {
        target: "https://opt-mainnet.g.alchemy.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/rpc\/opt/, ""),
      },
      "/rpc/polygon": {
        target: "https://polygon-mainnet.g.alchemy.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/rpc\/polygon/, ""),
      },
    },
  },
});
