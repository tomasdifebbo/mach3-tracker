import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    outDir: '../server/public',
    emptyOutDir: true,
    chunkSizeWarningLimit: 650,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'vendor-react', test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 30 },
            { name: 'vendor-three', test: /[\\/]node_modules[\\/]three[\\/]/, priority: 25 },
            { name: 'vendor-canvas', test: /[\\/]node_modules[\\/](html2canvas|dompurify|canvg)[\\/]/, priority: 22 },
          { name: 'vendor-pdf', test: /[\\/]node_modules[\\/](jspdf|jspdf-autotable|fflate)[\\/]/, priority: 20 },
            { name: 'vendor-charts', test: /[\\/]node_modules[\\/](chart\.js|react-chartjs-2)[\\/]/, priority: 15 },
            { name: 'vendor-motion', test: /[\\/]node_modules[\\/]framer-motion[\\/]/, priority: 10 },
            { name: 'vendor-icons', test: /[\\/]node_modules[\\/]lucide-react[\\/]/, priority: 5 },
          ],
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
})
