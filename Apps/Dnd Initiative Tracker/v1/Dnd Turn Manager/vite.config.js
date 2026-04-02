import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        name: 'DnD Turn Manager',
        short_name: 'TurnMgr',
        description: 'Manage D&D 5e turn order in real-time',
        theme_color: '#0a0a0f',
        icons: [
          {
            src: 'https://vitejs.dev/logo.svg', // Remote placeholder icon for now
            sizes: '192x192',
            type: 'image/svg+xml'
          }
        ]
      }
    })
  ],
})
