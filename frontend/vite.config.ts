import { defineConfig, loadEnv } from 'vite'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const rootDir = fileURLToPath(new URL('..', import.meta.url))
  const env = loadEnv(mode, rootDir, '')

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    server: {
      host: '0.0.0.0',
      port: 5173,
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8000',
          changeOrigin: true,
          secure: false,
        },
        '/ticker': {
          target: env.VITE_WS_PROXY_TARGET || 'ws://127.0.0.1:8000',
          changeOrigin: true,
          secure: false,
          ws: true,
        },
      },
    },
  }
})