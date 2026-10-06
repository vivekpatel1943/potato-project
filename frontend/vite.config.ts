import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    allowedHosts: ['renegade-granular-overtly.ngrok-free.dev'],
    proxy: {
      '/api': 'http://localhost:8000'
    }
  }
})
