import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'
import { randomBytes } from 'node:crypto'

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  const nonce = randomBytes(18).toString('base64')
  return {
    base: './',
    html: command === 'serve' ? { cspNonce: nonce } : undefined,
    server: {
      host: '127.0.0.1', port: 5173, strictPort: true,
      watch: { ignored: ['**/.tools/**', '**/release/**', '**/dist-electron/**', '**/native/**/bin/**', '**/native/**/obj/**', '**/test-results/**'] },
    },
    plugins: [
      {
        name: 'dev-csp',
        transformIndexHtml(html) {
          return command === 'serve' ? html.replace("script-src 'self'", `script-src 'self' 'nonce-${nonce}'`) : html
        },
      },
      react(),
      babel({ presets: [reactCompilerPreset()] }),
    ],
  }
})
