import type { ChildProcess } from 'node:child_process'
import type { PluginOption } from 'vite'
import { spawn } from 'node:child_process'
import process from 'node:process'
import electron from 'electron'
import { build } from 'vite'

export function electronDevPlugin() {
  return {
    name: 'electron-dev-start',
    async configureServer(server) {
      const result = await build({
        configFile: 'vite.config.electron.ts',
        mode: 'development',
        build: {
          watch: {},
        },
      })

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
      await build({
        configFile: 'vite.config.electron.ts',
        mode: 'production',
      })
    },
  } as PluginOption
}
