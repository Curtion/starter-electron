import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import { defineConfig } from 'vite'
import { electronDevPlugin } from './vite-plugins/electron'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [vue(), UnoCSS(), electronDevPlugin()],
  build: {
    outDir: 'dist-web',
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
