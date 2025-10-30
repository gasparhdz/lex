import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',    // expone en la LAN
    port: 5173,
    strictPort: true,
    hmr: {              // WebSocket del HMR apuntando a tu IP
      host: '192.168.100.183',
      protocol: 'ws',
      port: 5173,
    },
  },
})
