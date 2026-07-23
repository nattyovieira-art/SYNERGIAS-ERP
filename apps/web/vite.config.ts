import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

function releaseId(): string {
  const raw = process.env.SYNERGIAS_RELEASE_ID || 'LOCAL'
  return raw.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 48) || 'LOCAL'
}

function privateFilesGuard() {
  const forbidden = ['auth-config.php', 'email-config.php', 'config.local.php', 'inter.local.php']
  return {
    name: 'synergias-private-files-guard',
    buildStart() {
      const exposed = forbidden.filter((name) => existsSync(resolve(process.cwd(), 'public/api', name)))
      if (exposed.length > 0) {
        throw new Error(`Arquivos privados dentro de public/api: ${exposed.join(', ')}`)
      }
    },
  }
}

export default defineConfig({
  base: '/',
  plugins: [react(), privateFilesGuard()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name]-[hash]-${releaseId()}.js`,
        chunkFileNames: `assets/[name]-[hash]-${releaseId()}.js`,
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name || 'asset'
          if (name.endsWith('.css')) return `assets/[name]-[hash]-${releaseId()}[extname]`
          return 'assets/[name]-[hash][extname]'
        },
      },
    },
  },
})
