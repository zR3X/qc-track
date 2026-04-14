import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/socket.io": {
        target: "http://localhost:3100",
        changeOrigin: true,
        ws: true,
      },
      "/api/events": {
        target: "http://localhost:3100",
        changeOrigin: true,
        compress: false,
      },
      "/api": {
        target: "http://localhost:3100",
        changeOrigin: true,
      },
    },
  },
});
