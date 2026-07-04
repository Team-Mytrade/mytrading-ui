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
      "/v1/api/product-categories": {
        target: "http://192.168.1.113:52930",
        changeOrigin: true,
        secure: false,
      },
      // Proxy /v1/api requests to the backend
      "/v1/api": {
        target: "http://192.168.1.3:9595/",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
