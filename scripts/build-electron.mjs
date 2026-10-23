import { build } from 'esbuild'
import { pathToFileURL } from 'node:url'

export const mainOptions = {
  entryPoints: ['electron/main.ts'], outfile: 'dist-electron/main.js', bundle: true,
  platform: 'node', format: 'esm', target: 'node22', external: ['electron'], sourcemap: true,
}
export const preloadOptions = {
  entryPoints: ['electron/preload.ts'], outfile: 'dist-electron/preload.cjs', bundle: true,
  platform: 'node', format: 'cjs', target: 'node22', external: ['electron'], sourcemap: true,
}
export async function buildElectron() {
  await Promise.all([build(mainOptions), build(preloadOptions)])
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await buildElectron()
