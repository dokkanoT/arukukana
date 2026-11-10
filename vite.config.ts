import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    // 対象は純粋なロジック（暗号・距離計算）。Node には Web Crypto があるのでブラウザ環境は要らない
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
