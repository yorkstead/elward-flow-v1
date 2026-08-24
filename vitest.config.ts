import { defineConfig } from 'vitest/config'
import path from 'path'
import { loadEnv } from 'vite'

export default defineConfig({
  test: {
    environment: 'node',
    exclude: ['**/node_modules/**', '**/dist/**', '**/tests/e2e/**'],
    env: {
      NODE_ENV: 'test',
      APP_URL: 'http://localhost:3000',
      AUTH_SECRET: '123456789012345678901234567890123456',
      DATABASE_URL:
        'postgresql://postgres:postgres@localhost:5432/elward_flow_test',
      MINIO_ENDPOINT: 'http://localhost:9000',
      MINIO_REGION: 'us-east-1',
      MINIO_ACCESS_KEY: 'minioadmin',
      MINIO_SECRET_KEY: 'minioadmin',
      MINIO_BUCKET: 'elward-flow-test',
      ...loadEnv('development', process.cwd(), ''),
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})
