import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const dotnet = process.env.DOTNET_EXECUTABLE ?? (existsSync('.tools/dotnet/dotnet.exe') ? resolve('.tools/dotnet/dotnet.exe') : 'dotnet')
const result = spawnSync(dotnet, ['run', '--project', 'native/MediaCache.Tests', '-c', 'Release'], { windowsHide: true, stdio: 'inherit' })
if (result.error) console.error(result.error)
process.exitCode = result.status ?? 1
