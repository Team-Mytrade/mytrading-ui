import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";

const basePath = process.env.VITE_BASE_PATH || "./";

export default defineConfig({
  // Relative by default so the build can be deployed below any URL prefix.
  // Set VITE_BASE_PATH (for example, /app/) when the hosting path is known.
  base: basePath,
  plugins: [
    {
      name: "base-aware-public-images",
      enforce: "pre",
      transform(source, id) {
        if (!/\.(?:[jt]sx?|css)$/.test(id)) return null;

        // JSX string literals that point into `public` are not rewritten by
        // Vite automatically. Make those URLs follow the configured base.
        const code = source.replace(
          /(["'])\/images\//g,
          `$1${basePath}images/`,
        );
        return code === source ? null : { code, map: null };
      },
    },
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
        target: "http://193.181.209.14:9595",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
