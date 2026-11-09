import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8083',
        changeOrigin: true,
      },
    },
  },
  build: {
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('chart.js')) {
              return 'chart'
            }
            if (id.includes('jspdf') || id.includes('jspdf-autotable')) {
              return 'pdf'
            }
            if (id.includes('qrcode')) {
              return 'qrcode'
            }
            if (id.includes('vue') || id.includes('pinia') || id.includes('vue-router')) {
              return 'vendor'
            }
            if (id.includes('@fullcalendar')) {
              return 'calendar'
            }
            if (id.includes('@emailjs')) {
              return 'emailjs'
            }
            return 'vendor-misc'
          }
        },
      },
    },
  },
})
