import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En dev, on redirige les appels API et Socket.IO vers le serveur Node (port 3001).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
      '/socket.io': { target: 'http://localhost:3001', ws: true },
    },
  },
});
