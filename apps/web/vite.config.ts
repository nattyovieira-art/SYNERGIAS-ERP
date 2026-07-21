import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function releaseId(): string {
  const raw = process.env.SYNERGIAS_RELEASE_ID || 'LOCAL'
  return raw.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 48) || 'LOCAL'
}

export default defineConfig({
  base: '/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name]-[hash]-${releaseId()}.js`,
        chunkFileNames: `assets/[name]-[hash]-${releaseId()}.js`,
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name || 'asset'
          if (name.endsWith('.css')) {
            return `assets/[name]-[hash]-${releaseId()}[extname]`
          }
          return 'assets/[name]-[hash][extname]'
        },
      },
    },
  },
})
