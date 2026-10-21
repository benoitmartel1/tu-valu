import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  base: "/tu-valu/",
  server: {
    proxy: {
      "/__student-photos/young-blackett/": {
        target: "https://s3.bhs.io.cloud.ovh.net",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/__student-photos/, ""),
      },
      // Proxy API requests to PHP server
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
