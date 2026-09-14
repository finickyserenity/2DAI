import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  server: { host: true },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['app-icon.svg'],
      manifest: {
        name: '2Dai',
        short_name: '2Dai',
        description: 'A calm, local-first daily task manager.',
        theme_color: '#1e5784',
        background_color: '#f7f9fb',
        display: 'standalone',
        start_url: '/',
        icons: [{ src: '/app-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
      workbox: { cleanupOutdatedCaches: true, clientsClaim: true, skipWaiting: true },
      devOptions: { enabled: true, type: 'module' },
    }),
  ],
})
