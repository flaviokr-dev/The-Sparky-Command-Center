import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The API lives in ../server.py. In dev, Vite proxies /api to it; in production server.py serves web/dist.
export default defineConfig({
  plugins: [react()],
  server: { port: 5176, host: true, proxy: { '/api': 'http://127.0.0.1:8895' } },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three', '@react-three/fiber', '@react-three/drei'],
          motion: ['gsap', 'lenis'],
        },
      },
    },
  },
})
