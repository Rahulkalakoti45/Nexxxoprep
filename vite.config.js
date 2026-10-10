import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // MediaPipe is imported lazily when the interview camera starts. Pre-bundling it up front stops
  // the dev server from discovering it mid-interview and force-reloading the page.
  optimizeDeps: { include: ['@mediapipe/tasks-vision'] },
})
