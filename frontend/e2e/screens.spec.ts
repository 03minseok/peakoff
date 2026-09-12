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
 *
 * <h3>배포본에는 하나를 더 본다 — 내용이 실제로 왔는가</h3>
 * 배포 워크플로의 스모크가 서버 쪽에서 "200인데 빈" 배포를 잡는다면, 이쪽은 <b>화면 쪽</b>에서
 * 같은 것을 본다. 이 서비스는 공사가 침묵해도 죽지 않고 지역이 조용히 빠지는 구조라,
 * 화면이 멀쩡히 뜨고 콘솔이 조용해도 <b>정작 카드가 하나도 없을 수</b> 있다.
 *
 * <p>⚠️ {@code PW_BASE_URL}이 있을 때만 본다. 로컬은 목업 서버이거나 서버가 없을 수 있어
 * 거기서까지 내용을 요구하면 "열어 보는 도구"가 "시험 묶음"이 된다(위 규칙).
 * 단언은 화면마다 <b>하나</b>다 — 홈은 한적한 곳 카드가 하나라도 섰는지, 데이터 화면은
 * 백엔드 연결 타일이 "연결됨"인지. 그 둘이 공사 자료와 서버가 실제로 이어졌다는 뜻이다.
 */

/** 로그인 없이 열리는 화면들. 게스트가 전체 흐름을 쓸 수 있어야 한다는 규칙과 같은 목록이다 */
const SCREENS = [
  { path: '/', name: 'home' },
  { path: '/plan', name: 'plan' },
  { path: '/recommend', name: 'recommend' },
  { path: '/login', name: 'login' },
  { path: '/about', name: 'about' },
  { path: '/data', name: 'data' },
]

/** 배포본을 보는 중인가. 로컬 dev 서버를 가리키면 내용 검사는 건너뛴다 */
const LIVE = Boolean(process.env.PW_BASE_URL)

/**
 * 화면마다 "내용이 왔다"를 뜻하는 표식 하나. 없는 화면은 검사하지 않는다.
 *
 * <p>홈의 표식이 찜 버튼인 이유: "이번 주 한적한 곳" 카드마다 붙고, 그 카드는 공사 집중률
 * 예측이 실제로 들어와야만 선다. 글자를 찾지 않는 것은 문구가 바뀌어도 이 시험이
 * 따라 깨지지 않게 하려는 것이다 — 접근성 이름은 문구보다 오래 간다.
 */
const CONTENT: Partial<Record<string, (page: import('@playwright/test').Page) => Promise<void>>> = {
  home: async (page) => {
    await expect(
      page.getByRole('button', { name: /찜하기$|찜 취소$/ }).first(),
      'home: 한적한 곳 카드가 하나도 없다 — 공사 자료가 안 들어왔을 수 있다',
    ).toBeVisible({ timeout: 15_000 })
  },
  data: async (page) => {
    await expect(
      page.getByText('연결됨', { exact: true }),
      'data: 백엔드 연결 타일이 "연결됨"이 아니다',
    ).toBeVisible({ timeout: 15_000 })
  },
}

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

    /*
     * 찍기 전에 한 번 끝까지 훑어 내려갔다 올라온다.
     *
     * 소개 화면(/about)은 스크롤해 들어온 절만 나타난다(useInView). fullPage 캡처는
     * 화면을 실제로 넘기지 않으므로, 훑지 않으면 <b>접힌 구간이 통째로 빈 채</b> 찍힌다 —
     * "화면이 떠 있나"를 보는 도구가 뜬 화면을 못 보게 된다. 사용자가 하는 일을
     * 그대로 하고 찍는다. 다른 화면에는 아무 영향이 없다.
     *
     * smooth scroll(index.css)이 켜져 있으면 scrollTo가 미끄러져 다 못 가므로 instant로 간다.
     */
    await page.evaluate(async () => {
      const step = Math.max(200, window.innerHeight * 0.7)
      const bottom = document.documentElement.scrollHeight
      for (let y = 0; y < bottom; y += step) {
        window.scrollTo({ top: y, behavior: 'instant' })
        await new Promise((r) => setTimeout(r, 40))
      }
      window.scrollTo({ top: 0, behavior: 'instant' })
    })
    // 등장 전환(640ms + stagger)이 끝나길 기다린다
    await page.waitForTimeout(1100)

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

    // 배포본에서만. 위 두 검사와 달리 <b>서버와 공사 자료</b>가 있어야 통과한다.
    if (LIVE) {
      await CONTENT[screen.name]?.(page)
    }
  })
}
