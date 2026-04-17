import type { ChildProcess } from 'node:child_process'
import type { PluginOption } from 'vite'
import { spawn } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import electron from 'electron'
import { build } from 'vite'

const dirname = process.cwd()

const electronExternals = [
  'electron',
]

async function buildElectronEntry(entry: 'main' | 'preload', mode: 'development' | 'production', watch = false) {
  const entryFile = path.resolve(dirname, `src/main/${entry}.ts`)

  return build({
    configFile: false,
    publicDir: false,
    build: {
      ssr: entryFile,
      outDir: 'dist-electron',
      emptyOutDir: false,
      watch: watch ? {} : null,
      rolldownOptions: {
        external: electronExternals,
        output: {
          entryFileNames: `${entry}.cjs`,
          format: 'cjs',
        },
      },
    },
    resolve: {
      alias: {
        '@': '/src/main',
      },
    },
    ssr: {
      noExternal: [],
      target: 'node',
    },
    mode,
  })
}

async function buildElectron(mode: 'development' | 'production', watch = false) {
  // 分别构建 main 和 preload，避免 rolldown 代码分割问题
  // https://github.com/vitejs/rolldown-vite/issues/572
  if (!watch) {
    const fs = await import('node:fs')
    const outDir = path.resolve(dirname, 'dist-electron')
    if (fs.existsSync(outDir)) {
      fs.rmSync(outDir, { recursive: true, force: true })
    }
  }
  const mainResult = await buildElectronEntry('main', mode, watch)
  const preloadResult = await buildElectronEntry('preload', mode, watch)
  return [mainResult, preloadResult]
}

export function electronDevPlugin() {
  return {
    name: 'electron-dev-start',
    async configureServer(server) {
      const fs = await import('node:fs')
      const outDir = path.resolve(dirname, 'dist-electron')
      if (fs.existsSync(outDir)) {
        fs.rmSync(outDir, { recursive: true, force: true })
      }

      const result = await buildElectron('development', true)

      await Promise.all(
        result.map(
          watcher =>
            new Promise<void>((resolve) => {
              if ('on' in watcher) {
                const handler = (event: { code: string }) => {
                  if (event.code === 'BUNDLE_END') {
                    watcher.off('event', handler)
                    resolve()
                  }
                }
                watcher.on('event', handler)
              } else {
                resolve()
              }
            }),
        ),
      )

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
            ['dist-electron/main.cjs', '--remote-debugging-port=19222'],
            {
              stdio: 'inherit',
              env: {
                ...process.env,
                VITE_DEV_SERVER_URL: `http://localhost:${port}`,
              },
            },
          )

          electronProcess.on('close', async () => {
            await server.close()
            process.exit(0)
          })
        }

        startElectron()

        let restartTimer: ReturnType<typeof setTimeout> | null = null
        const scheduleRestart = () => {
          if (restartTimer) {
            clearTimeout(restartTimer)
          }
          restartTimer = setTimeout(() => {
            restartTimer = null
            startElectron()
          }, 100)
        }

        for (const watcher of result) {
          if ('on' in watcher) {
            watcher.on('event', (event) => {
              if (event.code === 'BUNDLE_END') {
                scheduleRestart()
              }
            })
          }
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
