import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The site is served from https://<user>.github.io/MindArchive/ in production.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/MindArchive/' : '/',
  plugins: [react()],
}))
