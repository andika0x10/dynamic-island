import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export async function buildNative() {
  if (process.platform !== 'win32') throw new Error('WindowsBridge must be built on Windows.')
  const local = resolve('.tools/dotnet/dotnet.exe')
  const dotnet = process.env.DOTNET_EXECUTABLE ?? (existsSync(local) ? local : 'dotnet')
  await new Promise((resolve, reject) => {
    const child = spawn(dotnet, ['publish', 'native/WindowsBridge/WindowsBridge.csproj', '-c', 'Release', '-o', 'native/WindowsBridge/bin/publish', '--nologo'], { windowsHide: true, stdio: 'inherit', env: { ...process.env, DOTNET_CLI_TELEMETRY_OPTOUT: '1', DOTNET_NOLOGO: '1' } })
    child.on('error', reject)
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`Native build failed (${code}). Install .NET 10 SDK or set DOTNET_EXECUTABLE.`)))
  })
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await buildNative()
