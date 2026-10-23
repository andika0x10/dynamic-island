import { existsSync, readFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

if (process.platform !== 'win32') throw new Error('Build WindowsHost on Windows')
const dotnet = process.env.DOTNET_EXECUTABLE ?? (existsSync('.tools/dotnet/dotnet.exe') ? resolve('.tools/dotnet/dotnet.exe') : 'dotnet')
const { version } = JSON.parse(readFileSync('package.json', 'utf8'))
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Expected a stable three-part release version')
const child = spawn(dotnet, ['build', 'native/WindowsHost/WindowsHost.csproj', '-c', 'Release', '--nologo', `-p:Version=${version}`, `-p:AssemblyVersion=${version}.0`, `-p:FileVersion=${version}.0`], { windowsHide: true, stdio: 'inherit' })
child.on('error', error => { console.error(error); process.exitCode = 1 })
child.on('exit', code => { process.exitCode = code ?? 1 })
