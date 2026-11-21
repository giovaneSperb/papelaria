import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Em dev, repassa /api para o FastAPI local (uvicorn na porta 8010)
    proxy: { "/api": process.env.API_URL || "http://localhost:8010" },
  },
});
