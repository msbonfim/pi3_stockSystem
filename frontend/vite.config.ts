import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from "path"
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      strategies: 'injectManifest',
      srcDir: 'public',
      filename: 'service-worker.js',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,otf}'],
      },
      // Configura o manifesto da PWA
      manifest: {
        name: 'StockSystem',
        short_name: 'StockSystem',
        description: 'Sistema de Gestão de Estoque',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-64x64.png',
            sizes: '64x64',
            type: 'image/png'
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'  
          },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      // Desabilita Service Worker em desenvolvimento para evitar conflitos
      devOptions: {
        enabled: false // Desabilitado para evitar problemas durante desenvolvimento
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
