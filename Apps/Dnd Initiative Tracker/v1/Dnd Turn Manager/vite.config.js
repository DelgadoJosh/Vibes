import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/Vibes/Apps/Dnd Initiative Tracker/v1/Dnd Turn Manager/dist/',
  plugins: [
    react()
  ],
})
