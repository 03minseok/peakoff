import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // 개발 중 /api 요청을 Vite 개발 서버가 백엔드로 대신 전달한다.
      // 브라우저 입장에서는 같은 출처(localhost:5173)로 보이므로 CORS 설정이 필요 없다.
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
