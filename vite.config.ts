import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { electronDevPlugin } from './vite-plugins/electron'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), electronDevPlugin()],
})
