import path from 'node:path'
import builtinModules from 'builtin-modules'
import { defineConfig } from 'vite'

export default defineConfig({
  publicDir: false,
  build: {
    lib: {
      entry: {
        main: path.resolve(__dirname, 'src/main/main.ts'),
        preload: path.resolve(__dirname, 'src/main/preload.ts'),
      },
      formats: ['cjs'],
      fileName: (_, entryName) => `${entryName}.cjs`,
    },
    outDir: 'dist-electron',
    emptyOutDir: true,
    rollupOptions: {
      external: ['electron', ...builtinModules],
    },
  },
})
