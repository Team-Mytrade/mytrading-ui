import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";

export default defineConfig({
  // base: '/app/',
  plugins: [
    react(),
    svgr({
      svgrOptions: {
        icon: true,
        exportType: "named",
        namedExport: "ReactComponent",
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      // Proxy /v1/api requests to the backend
      "/v1/api": {
        target: "http://193.181.209.14:9595",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});