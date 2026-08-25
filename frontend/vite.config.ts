import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,

    /*
     * 같은 공유기에 붙은 <b>휴대폰에서도 열 수 있게</b> 랜에 노출한다.
     *
     * 기본값은 localhost만 듣기라 개발 PC 밖에서는 접속 자체가 안 됐다.
     * true로 두면 모든 네트워크 인터페이스를 듣고, `npm run dev`가 실행될 때
     * Network 주소(http://192.168.x.x:5173)를 함께 찍어 준다 — 그 주소를 폰에 치면 된다.
     *
     * 모바일 우선 반응형이 목표인데 정작 실물 기기로 못 봤다면 확인한 것이 아니다.
     * 브라우저의 기기 흉내내기는 화면 크기만 맞출 뿐, 실제 터치 스크롤·주소창 높이 변화·
     * 폰트 렌더링은 재현하지 않는다.
     *
     * ⚠️ 카페처럼 남과 함께 쓰는 와이파이에서는 같은 망의 다른 사람도 이 주소로 들어올 수 있다.
     * 개발 서버라 데이터가 대단할 것은 없지만, 신경 쓰이면 이 줄만 지우면 원래대로 돌아간다.
     */
    host: true,

    proxy: {
      /*
       * 개발 중 /api 요청을 Vite 개발 서버가 백엔드로 대신 전달한다.
       * 브라우저 입장에서는 같은 출처로 보이므로 CORS 설정이 필요 없다.
       *
       * <b>휴대폰에서 열어도 이 target은 그대로 localhost다.</b> 요청을 실제로 보내는 것은
       * 폰이 아니라 <b>개발 PC에서 도는 Vite</b>이고, 그 PC 기준에서 백엔드는 localhost다.
       * 여기를 폰이 보는 주소로 바꾸면 오히려 PC에서 안 된다.
       */
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
