import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'

export default defineConfig({
  root: path.resolve('experiments/pokemon-runtime-preview'),
  plugins: [vue()],
  publicDir: path.resolve('public'),
  server: { host: '127.0.0.1', port: 4181 },
  build: { outDir: path.resolve('dist/pokemon-runtime-preview'), emptyOutDir: true },
})
