import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Listen on IPv4 + IPv6 so localhost previews (often ::1) connect
    host: true,
    port: 5173,
    strictPort: true,
  },
})
