import { expect, test } from '@playwright/test'

/**
 * 주요 화면을 열어 <b>찍고, 두 가지만 확인한다.</b>
 *
 * <p>단언을 늘리지 않는다. 여기서 잡고 싶은 것은 "버튼 글자가 바뀌었나" 같은 것이 아니라
 * <b>코드만 읽어서는 안 보이는 것</b>이다 — 화면이 옆으로 밀리는지, 콘솔이 붉은지.
 * 그 둘은 실제로 이 저장소를 여러 번 괴롭힌 문제다:
 *
 * <ul>
 *   <li>가로 스크롤 — 주간 예보를 옆으로 미는 띠 때문에 페이지가 통째로 밀렸다.
 *       html에 overflow-x를 걸어도 소용없었고, 실물 폰에서야 드러났다</li>
 *   <li>혼합 콘텐츠 — 공사 이미지가 http라 콘솔이 경고로 가득 찼다.
 *       화면은 멀쩡해서 개발자 도구를 열기 전에는 몰랐다</li>
 * </ul>
 *
 * <h3>⚠️ 서버가 필요하다</h3>
 * <pre>
 * 터미널 1  cd backend  && ./gradlew bootRun --args='--spring.profiles.active=mock'
 * 터미널 2  cd frontend && npm run dev
 * 터미널 3  cd frontend && npm run ui:shot
 * </pre>
 * 배포본을 볼 때는 서버 없이 {@code PW_BASE_URL}만 주면 된다.
 */

/** 로그인 없이 열리는 화면들. 게스트가 전체 흐름을 쓸 수 있어야 한다는 규칙과 같은 목록이다 */
const SCREENS = [
  { path: '/', name: 'home' },
  { path: '/plan', name: 'plan' },
  { path: '/recommend', name: 'recommend' },
  { path: '/login', name: 'login' },
]

for (const screen of SCREENS) {
  test(`${screen.name} — 찍고 가로 스크롤·콘솔 확인`, async ({ page }, testInfo) => {
    /*
     * 콘솔의 붉은 줄을 모은다. 혼합 콘텐츠 경고는 warning으로 오므로 둘 다 본다.
     * 다만 남의 사정(지도 SDK 키 없음 등)까지 실패로 만들지 않으려고 걸러 낸다.
     */
    const complaints: string[] = []
    page.on('console', (message) => {
      if (message.type() !== 'error' && message.type() !== 'warning') {
        return
      }
      const text = message.text()
      // 지도 키가 없는 환경에서는 카카오 SDK가 스스로 불평한다. 우리 코드의 문제가 아니다.
      if (text.includes('dapi.kakao.com') || text.includes('Kakao')) {
        return
      }
      complaints.push(`[${message.type()}] ${text}`)
    })

    await page.goto(screen.path, { waitUntil: 'networkidle' })
    await testInfo.attach(`${screen.name}.png`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    })

    /*
     * ⚠️ 가로로 밀리지 않아야 한다.
     *
     * scrollWidth가 clientWidth보다 크면 페이지가 옆으로 움직인다. 1px은 반올림으로도
     * 생기므로 그만큼은 봐준다 — 실제로 문제가 됐을 때는 수십 px씩 났다(387 대 620).
     */
    const overflow = await page.evaluate(() => {
      const root = document.documentElement
      return root.scrollWidth - root.clientWidth
    })
    expect(overflow, `${screen.name}: 가로로 ${overflow}px 넘친다`).toBeLessThanOrEqual(1)

    expect(complaints, `${screen.name} 콘솔:\n${complaints.join('\n')}`).toEqual([])
  })
}
