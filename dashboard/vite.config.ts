import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// In development the gateway runs on :8080; in Docker, nginx proxies /api instead.
export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': process.env.GATEWAY_URL ?? 'http://localhost:8080',
    },
  },
})
