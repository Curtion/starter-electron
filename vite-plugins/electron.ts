import type { ChildProcess } from 'node:child_process'
import type { PluginOption } from 'vite'
import { spawn } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import builtinModules from 'builtin-modules'
import electron from 'electron'
import { build } from 'vite'

const dirname = process.cwd()

async function buildElectronEntry(entry: 'main' | 'preload', mode: 'development' | 'production', watch = false) {
  return build({
    configFile: false,
    publicDir: false,
    build: {
      lib: {
        entry: path.resolve(dirname, `src/main/${entry}.ts`),
        formats: ['cjs'],
        fileName: () => `${entry}.cjs`,
      },
      outDir: 'dist-electron',
      emptyOutDir: entry === 'main',
      watch: watch ? {} : null,
      rollupOptions: {
        external: ['electron', ...builtinModules],
      },
    },
    resolve: {
      alias: {
        '@': '/src/main',
      },
    },
    mode,
  })
}

async function buildElectron(mode: 'development' | 'production', watch = false) {
  // 分别构建 main 和 preload，避免 rolldown 代码分割问题
  // https://github.com/vitejs/rolldown-vite/issues/572
  await buildElectronEntry('main', mode, watch)
  return buildElectronEntry('preload', mode, watch)
}

export function electronDevPlugin() {
  return {
    name: 'electron-dev-start',
    async configureServer(server) {
      const result = await buildElectron('development', true)

      server.httpServer?.on('listening', () => {
        const address = server.httpServer?.address()
        const port = typeof address === 'string' ? address : address?.port

        let electronProcess: ChildProcess

        const startElectron = () => {
          if (electronProcess) {
            electronProcess.removeAllListeners()
            electronProcess.kill()
          }

          electronProcess = spawn(
            electron as unknown as string,
            ['dist-electron/main.cjs'],
            {
              stdio: 'inherit',
              env: {
                ...process.env,
                VITE_DEV_SERVER_URL: `http://localhost:${port}`,
              },
            },
          )

          electronProcess.on('close', () => {
            server.close()
          })
        }

        startElectron()

        if ('on' in result) {
          result.on('event', (event) => {
            if (event.code === 'BUNDLE_END') {
              startElectron()
            }
          })
        }

        server.httpServer?.on('close', () => {
          if (electronProcess) {
            electronProcess.removeAllListeners('close')
            electronProcess.kill()
          }
        })
      })
    },
    async closeBundle() {
      await buildElectron('production', false)
    },
  } as PluginOption
}
