import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const env = { ...process.env }
env.ISLAND_DISABLE_STARTUP = '1'
delete env.ELECTRON_RUN_AS_NODE
delete env.VITE_DEV_SERVER_URL
const child = spawn(resolve('native/WindowsHost/bin/Release/net48/Dynamic Island.exe'), [], { env, stdio: 'inherit', windowsHide: true })
child.on('error', error => { console.error(error); process.exitCode = 1 })
child.on('exit', code => { process.exitCode = code ?? 0 })
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  if (process.platform === 'win32') {
    const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
    killer.on('error', () => child.kill())
  } else child.kill(signal)
})
