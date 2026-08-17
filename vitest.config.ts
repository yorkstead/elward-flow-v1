import { defineConfig } from 'vitest/config'
import path from 'node:path'
import { loadEnvConfig } from '@next/env'

loadEnvConfig(process.cwd(), true)
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup-env.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    fileParallelism: false,
    coverage: { provider: 'v8', reporter: ['text', 'html'] },
  },
})
