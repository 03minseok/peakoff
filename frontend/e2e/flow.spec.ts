import { expect, test, type Page } from '@playwright/test'

/**
 * 게스트가 서비스를 한 바퀴 도는 길을 실제로 걷는다.
 *
 * <p>조건 입력 → 장소 담기 → 진단 → 대안 교체 → 원안과 맞대기 → 저장.
 * {@code screens.spec.ts}가 <b>화면이 떠 있나</b>를 보는 도구라면 이 파일은
 * <b>길이 이어져 있나</b>를 본다. 화면 하나하나는 멀쩡한데 그 사이의 버튼이 끊어져 있으면
 * 저쪽은 전부 초록인데 사용자는 아무 데도 못 간다.
 *
 * <h3>왜 필요한가</h3>
 * 심사 당일에 이 길이 끊기면 그것으로 끝이다. 점수를 올리는 장치가 아니라
 * <b>사고를 막는 보험</b>이다. 실제로 오늘 이 길에서 두 번 걸렸다 — 저장 코스 카드의
 * "상세 보기"가 눌리지 않았고(press의 transform), 결과 화면이 원안 없이 로딩에 갇혔다.
 *
 * <h3>⚠️ CI에 넣지 않는다</h3>
 * {@code screens.spec.ts}와 같은 이유다. 이 길은 공사 예측 자료에 기대고 있어서, 공사가
 * 흔들리면 우리 코드가 멀쩡해도 붉어진다. <b>우리 코드 밖의 일로 PR이 붉어지면 검사 자체를
 * 믿지 않게 된다.</b> 손으로 부를 때만 돈다 — {@code npm run ui:flow}.
 *
 * <h3>⚠️ 단언을 늘리지 말 것</h3>
 * 여기서 확인하는 것은 <b>다음 걸음으로 갈 수 있나</b>이지 글자가 무엇인가가 아니다.
 * 문구 단언을 채워 넣으면 카피를 고칠 때마다 이 파일이 깨지고, 그러면 아무도 안 돌린다.
 *
 * ⚠️ 흐름이라 <b>순서가 있다</b>. serial이므로 앞 단계가 깨지면 뒤는 건너뛴다 —
 * 그게 맞다. 코스를 못 담았는데 진단을 확인해 봐야 알아낼 것이 없다.
 */

/**
 * 내 컴퓨터 밖의 서버를 보고 있는가.
 *
 * <p>⚠️ {@code PW_BASE_URL}이 있는지로 재지 않는다 — 로컬을 다른 포트로 띄워 볼 때도 그 값을
 * 쓰기 때문이다. 여기서 가리려는 것은 "배포본에 시험 계정을 만들지 않는다"이므로
 * <b>주소가 내 컴퓨터인지</b>를 본다.
 */
const REMOTE = /^https?:\/\/(?!localhost|127\.0\.0\.1)/i.test(process.env.PW_BASE_URL ?? '')

/** 진단·대안은 공사 응답을 기다린다. 캐시가 비어 있으면 첫 호출이 몇 초 걸린다 */
const SLOW = 60_000

const REGION = '경주'
const DAY1 = ['불국사', '첨성대', '대릉원']
const DAY2 = ['석굴암', '황리단길']

test.describe.configure({ mode: 'serial' })

test.describe('게스트가 한 바퀴 돈다', () => {
  let page: Page
  /**
   * 시험이 만든 계정. <b>실패해도 치우기 위해</b> 밖에 둔다.
   *
   * <p>정리를 시험 안에 두었더니 중간에 깨진 회차가 계정과 코스를 그대로 남겼다 —
   * 고치는 동안 남긴 것이 홈의 "요즘 저장된 여행"에 그대로 떴다. 치우는 일은 확인하려는
   * 것이 아니므로 결과와 무관하게 돈다.
   */
  let created: { password: string } | null = null

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage()
  })

  test.afterAll(async () => {
    if (created) {
      await removeAccount(page, created.password)
    }
    await page.close()
  })

  test('1. 조건을 넣으면 코스 편집으로 간다', async () => {
    await page.goto('/plan')
    await page.getByPlaceholder('지역 검색 (예: 여수, 강원)').fill(REGION)
    await page.getByRole('option').first().click()
    // ⚠️ 기간은 기본값이 없다. 고르지 않으면 아래 버튼이 잠긴 채다 — 일부러 그렇게 두었다.
    await page.getByText('2일', { exact: true }).click()
    await page.getByRole('button', { name: /코스 짜러 가기/ }).click()
    await expect(page).toHaveURL(/\/course/)
  })

  test('2. 장소를 담으면 진단으로 갈 수 있다', async () => {
    for (const keyword of DAY1) {
      await add(page, keyword)
    }
    await page.getByRole('button', { name: /Day 2/ }).click()
    for (const keyword of DAY2) {
      await add(page, keyword)
    }
    // 버튼 이름이 담은 개수를 들고 있다. 다섯이 아니면 어딘가 안 담긴 것이다.
    await page.getByRole('button', { name: /코스 진단하기 · 5곳/ }).click()
    await expect(page).toHaveURL(/\/diagnosis/)
  })

  test('3. 진단이 칸마다 점수를 매긴다', async () => {
    await expect(
      page.getByRole('button', { name: '최종 코스 확인하기' }),
      '진단이 끝나지 않았다 — 공사 자료가 안 왔을 수 있다',
    ).toBeVisible({ timeout: SLOW })
    // 한 칸이라도 진단됐으면 배지가 선다. 전부 "자료 없음"이면 이 길의 의미가 없다.
    await expect(page.getByText(/한적 지수 \d+/).first()).toBeVisible()
  })

  test('4. 대안 시트에서 다른 곳으로 바꾼다', async () => {
    const open = page.getByRole('button', { name: '새로운 곳 발견하기' }).first()
    await expect(open, '대안을 여는 버튼이 없다').toBeVisible()
    await open.click()

    const sheet = page.getByRole('dialog')
    await expect(sheet, '대안 시트가 열리지 않았다').toBeVisible()

    /*
      ⚠️ <b>후보가 없을 수 있다.</b> 서버는 원래 자리보다 뚜렷하게 한적한 곳만 담으므로,
      이미 한적한 장소에서는 빈 목록이 정상이다(그때는 왜 비었는지가 시트에 적힌다).
      그것까지 실패로 세면 이 시험이 공사 자료 상태에 흔들린다 — 있으면 눌러 보고, 없으면
      "이유가 적혀 있나"까지만 본다.
    */
    const pick = sheet.getByRole('button', { name: '이곳으로 가볼래요' }).first()
    await pick.or(sheet.getByText(/찾지 못했어요|이미|없어요/).first()).first().waitFor({ timeout: SLOW })

    if (await pick.count()) {
      await pick.click()
      await expect(sheet).toBeHidden()
      await expect(page.getByText('교체함').first(), '교체 표시가 안 뜬다').toBeVisible()
    } else {
      test.info().annotations.push({ type: 'note', description: '대안 후보가 없어 교체는 건너뛰었다' })
      await sheet.getByRole('button', { name: /그대로 둘게요|✕/ }).first().click()
    }
  })

  test('5. 최종 결과가 원안과 맞댄다', async () => {
    await page.getByRole('button', { name: '최종 코스 확인하기' }).click()
    await expect(page).toHaveURL(/\/result/)
    // 결과 화면은 진단 둘(원안·개선안)을 기다린다. 하나라도 안 오면 여기서 멈춘다.
    await expect(page.getByText('최종 동선'), '결과 화면이 그려지지 않았다').toBeVisible({ timeout: SLOW })
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('6. 게스트가 저장하려 하면 로그인으로 안내하고 코스는 남는다', async () => {
    await page.getByRole('button', { name: /저장/ }).first().click()
    await expect(page).toHaveURL(/\/login/)
    // ⚠️ 여기서 코스가 사라지면 로그인하고 돌아와도 저장할 것이 없다.
    const trip = await page.evaluate(() => sessionStorage.getItem('peakoff.trip'))
    expect(trip, '로그인으로 보내면서 짜던 코스를 잃었다').toBeTruthy()
  })

  test('7. 회원이 저장하면 마이페이지에 뜬다', async () => {
    test.skip(REMOTE, '배포본에는 시험 계정을 만들지 않는다')

    const email = `flow-${Date.now()}@peakoff.test`
    const password = 'Peakoff!2026'
    created = { password }
    await page.goto('/signup')
    await page.locator('input[type=email]').fill(email)
    await page.locator('input[type=password]').first().fill(password)
    await page.locator('input[type=password]').nth(1).fill(password)
    await page.locator('#signup-nickname').fill('흐름시험')
    // 약관은 진짜 checkbox가 아니라 버튼이다. "전체 동의"가 필수 항목을 한 번에 켠다.
    await page.getByRole('button', { name: '전체 동의' }).click()
    await page.locator('button[type=submit]').click()
    await expect(page).not.toHaveURL(/\/signup/, { timeout: 20_000 })

    await page.goto('/result')
    await expect(page.getByText('최종 동선')).toBeVisible({ timeout: SLOW })
    await page.getByRole('button', { name: /저장/ }).first().click()
    const sheet = page.getByRole('dialog')
    await expect(sheet).toBeVisible()
    await sheet.getByPlaceholder(/예: /).fill('흐름 시험 코스')
    await sheet.getByRole('button', { name: /저장/ }).last().click()
    /*
      ⚠️ 시트가 닫히지 않는다. 저장을 마치면 <b>같은 시트가 확인 화면으로 바뀌고</b>
      "여행에 담기"·"마이페이지에서 보기"를 편다 — 담고 싶은 순간이 저장한 그 순간이라서다.
      닫히기를 기다리면 영영 안 온다.
    */
    await expect(
      sheet.getByRole('heading', { name: /저장했어요/ }),
      '저장 확인이 뜨지 않았다',
    ).toBeVisible({ timeout: 20_000 })

    await page.goto('/my')
    await expect(page.getByText('흐름 시험 코스'), '저장한 코스가 마이페이지에 없다').toBeVisible({
      timeout: 20_000,
    })
  })
})

/** 검색해서 첫 결과를 담는다. 검색은 지역 안으로 제한돼 있어 첫 결과가 대개 그 장소다 */
async function add(page: Page, keyword: string) {
  await page.getByPlaceholder('가고 싶은 곳을 검색해 보세요').fill(keyword)
  const first = page.getByRole('button', { name: '추가' }).first()
  await first.waitFor({ timeout: 20_000 })
  await first.click()
}

/**
 * 시험이 만든 계정을 지운다. 계정을 지우면 담긴 코스도 함께 사라진다.
 *
 * <p>화면으로 지우면 탈퇴 흐름의 모든 단계에 시험이 매달린다 — 그쪽이 바뀔 때마다 이 파일이
 * 깨진다. 지우는 것은 <b>정리</b>이지 확인하려는 것이 아니므로 API로 곧장 부른다.
 */
async function removeAccount(page: Page, password: string) {
  const token = await page.evaluate(() => {
    const raw = localStorage.getItem('peakoff.auth')
    return raw ? (JSON.parse(raw) as { token?: string }).token : null
  })
  if (!token) {
    return
  }
  await page.request.delete('/api/auth/me', {
    data: { password },
    headers: { Authorization: `Bearer ${token}` },
  })
}
