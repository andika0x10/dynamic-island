import { cp, mkdir, readdir, rm } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const source = resolve('native/WindowsHost/bin/Release/net48')
const destination = resolve(fileURLToPath(new URL('../release/webview-unpacked', import.meta.url)))
if (destination !== resolve('release', 'webview-unpacked')) throw new Error('Unexpected staging path')
await rm(destination, { recursive: true, force: true })
await mkdir(destination, { recursive: true })
for (const entry of await readdir(source, { withFileTypes: true })) {
  if (entry.name === 'ui' || (entry.isFile() && /\.(exe|dll|config)$/.test(entry.name) && entry.name !== 'Microsoft.Web.WebView2.Wpf.dll')) {
    await cp(join(source, entry.name), join(destination, entry.name), { recursive: true })
  }
}
await cp(join(source, 'desktop.js'), join(destination, 'desktop.js'))
// Only the x64 loader is needed; the build output also contains x86/ARM64.
await cp(join(source, 'runtimes/win-x64/native/WebView2Loader.dll'), join(destination, 'WebView2Loader.dll'))
console.log(`Staged Windows host: ${destination}`)
