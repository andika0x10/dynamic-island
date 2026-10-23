import { createServer } from 'vite'
import { context } from 'esbuild'
import { spawn } from 'node:child_process'
import electron from 'electron'
import { mainOptions, preloadOptions } from './build-electron.mjs'

let child
let server
let contexts = []
let stopping = false
let restartTimer
let restartQueue = Promise.resolve()
let ready = false
const electronEnv = { ...process.env, VITE_DEV_SERVER_URL: 'http://127.0.0.1:5173' }
delete electronEnv.ELECTRON_RUN_AS_NODE

function stopChild() {
  const previous = child
  child = undefined
  if (!previous || previous.exitCode !== null) return Promise.resolve()
  return new Promise(resolve => {
    previous.once('exit', resolve)
    if (process.platform === 'win32') {
      const killer = spawn('taskkill', ['/pid', String(previous.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
      killer.on('error', () => previous.kill())
    } else previous.kill('SIGTERM')
  })
}

async function shutdown(code = 0) {
  if (stopping) return
  stopping = true
  clearTimeout(restartTimer)
  await stopChild()
  await Promise.all(contexts.map(ctx => ctx.dispose()))
  await server?.close()
  process.exit(code)
}

function restart() {
  clearTimeout(restartTimer)
  restartTimer = setTimeout(() => {
    restartQueue = restartQueue.then(async () => {
      await stopChild()
      if (stopping) return
      const launched = spawn(electron, ['.'], {
        stdio: 'inherit', windowsHide: true,
        env: electronEnv,
      })
      child = launched
      launched.once('error', error => { console.error(error); void shutdown(1) })
      launched.once('exit', code => { if (child === launched && !stopping) void shutdown(code ?? 0) })
    }).catch(error => { console.error(error); void shutdown(1) })
  }, 150)
}

process.on('SIGINT', () => void shutdown())
process.on('SIGTERM', () => void shutdown())
try {
  server = await createServer()
  await server.listen()
  server.printUrls()
  const restartPlugin = {
    name: 'restart-electron',
    setup(build) {
      build.onEnd(result => {
        if (result.errors.length) { if (ready) void shutdown(1) }
        else if (ready) restart()
      })
    },
  }
  contexts = await Promise.all([mainOptions, preloadOptions].map(options => context({ ...options, plugins: [restartPlugin] })))
  await Promise.all(contexts.map(ctx => ctx.rebuild()))
  await Promise.all(contexts.map(ctx => ctx.watch()))
  ready = true
  restart()
} catch (error) { console.error(error); await shutdown(1) }
