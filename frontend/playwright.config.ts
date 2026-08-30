import { defineConfig, devices } from '@playwright/test'

/**
 * 화면을 <b>실제로 열어 보기 위한</b> 설정. 회귀 테스트 묶음이 아니다.
 *
 * <h3>왜 넣었나</h3>
 * 지금까지 화면 문제는 전부 사람이 폰으로 열어 보고 알려줘야 알 수 있었다 —
 * 가로 스크롤, 하단 막대가 도구막대에 가리는 것, 시트를 열면 sticky가 튀는 것.
 * 코드만 읽어서는 안 보이는 것들이라 고치는 데 여러 번 오갔다.
 *
 * <p>여기서 하는 일은 <b>열어서 찍는 것</b>까지다. 단언(assert)을 쌓아 두지 않는 이유:
 * 마감까지 3주인데 깨지기 쉬운 시험이 늘면 그것을 고치는 데 시간이 간다.
 * CLAUDE.md도 "테스트 코드는 요청할 때만"이라고 정해 두었다.
 *
 * <h3>⚠️ CI에서 돌리지 않는다</h3>
 * {@code .github/workflows/ci.yml}에 넣지 않았다. 브라우저를 받는 데만 수백 MB가 들고,
 * 실제 데이터에 기대는 화면이라 공사 API 상태에 따라 결과가 흔들린다.
 * PR을 붉게 만드는 원인이 우리 코드가 아닌 곳에 생기면 검사 자체를 믿지 않게 된다.
 *
 * <h3>두 폭으로 본다</h3>
 * 이 서비스는 <b>모바일 우선 390px</b> 기준으로 설계하고 데스크톱에서 깨지지 않게 한다
 * (CLAUDE.md 디자인 규칙). 그래서 390과 1280 둘 다 찍는다 — 한쪽만 보면
 * 반응형에서 갈리는 것들(사진 배너↔썸네일, 두 칸 배치, 스위치)을 놓친다.
 */
export default defineConfig({
  testDir: './e2e',

  /* 화면을 열어 보는 용도라 한 번에 하나씩 돈다. 여럿이 동시에 뜨면 스크린샷 순서가 섞인다 */
  workers: 1,
  fullyParallel: false,

  /* 실패해도 다시 시도하지 않는다. 여기서 실패는 "고쳐야 할 것"이지 "떨림"이 아니어야 한다 */
  retries: 0,

  use: {
    /*
     * 기본은 로컬 개발 서버. 배포본을 보려면 이렇게 부른다:
     *   PW_BASE_URL=https://peakoff-kr.vercel.app npm run ui:shot
     */
    baseURL: process.env.PW_BASE_URL ?? 'http://localhost:5173',
    /* 실패한 것만 흔적을 남긴다. 전부 남기면 폴더가 금방 커진다 */
    trace: 'retain-on-failure',
  },

  /*
   * ⚠️ 둘 다 <b>크로미움</b>이다. iPhone 계열 서술자를 쓰면 WebKit을 받아야 하는데,
   * 브라우저 하나가 수백 MB라 꼭 필요한 것만 둔다.
   *
   * <p>안드로이드 쪽을 고른 것은 취향이 아니다 — 이 저장소가 실제로 겪은 모바일 문제가
   * <b>크롬 안드로이드</b>의 것이었다(도구막대가 여닫히며 하단 고정 막대를 가리는 문제,
   * CLAUDE.md 모바일 규칙). 재현하려는 환경에 맞춘다.
   *
   * <p>폭 390은 우리가 설계 기준으로 삼은 값이다.
   */
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 } } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
  ],
})
