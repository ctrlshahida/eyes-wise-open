import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // In development, send /api calls to the Express server (npm start) on port 3000.
  server: { proxy: { '/api': 'http://localhost:3000' } },
})
