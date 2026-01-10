import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { electronDevPlugin } from './vite-plugins/electron'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [vue(), electronDevPlugin()],
  build: {
    outDir: 'dist-web',
  },
})
