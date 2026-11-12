import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // PWA：ホーム画面に追加できるようにし、アプリ本体を端末に置いておく
    VitePWA({
      // 新しい版を公開したら、次に開いたときに自動で入れ替える（「更新しますか」は出さない）
      registerType: 'autoUpdate',
      // ホーム画面に追加したときの名前・色・アイコン
      manifest: {
        name: 'アルクカナ',
        short_name: 'アルクカナ',
        description: 'その場所に着いたときだけ開ける手紙。いつもの帰り道を、1ミリ良くする。',
        lang: 'ja',
        start_url: '/',
        scope: '/',
        // ブラウザの枠（アドレスバー）を出さず、アプリのように開く
        display: 'standalone',
        background_color: '#0F1118',
        theme_color: '#0F1118',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          // 端を丸く切り抜かれてもよいアイコン（絵は中央に寄せてある）
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      // マニフェストに書いていないアイコンも、端末に置く対象に入れる
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      workbox: {
        // 端末に置くのはアプリ本体（HTML・JS・CSS）とアイコンだけ。アイコンは上の指定で入る。
        // 地図タイル・フォント・Firestore は別のサーバーなので、ここには入らない
        globPatterns: ['**/*.{js,css,html}'],
        // JS が 1 本で約 2.1MB あり、既定の上限（2MB）を少し超えるので 3MB に上げる
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
    }),
  ],
  test: {
    // 対象は純粋なロジック（暗号・距離計算）。Node には Web Crypto があるのでブラウザ環境は要らない
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
