import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router'
import type { ReactNode } from 'react'
import { useAuth } from '../state/authContext'

/**
 * 화면을 오가는 링크 한 벌과, 그것을 넓은 화면·좁은 화면에서 각각 그리는 두 컴포넌트.
 *
 * <p>닉네임을 눌러야 마이페이지로 가는 구조는 <b>눌러야 한다는 것을 알아야만</b> 동작한다.
 * 이름은 정보처럼 보이지 버튼처럼 보이지 않는다. 갈 수 있는 곳을 늘어놓으면
 * 유추할 필요가 없어진다.
 *
 * <p>두 컴포넌트가 {@code ITEMS} 하나를 공유한다. 목록을 두 벌로 적으면 메뉴를 더할 때
 * 한쪽만 고쳐진다.
 *
 * <h3>헤더에 남긴 것 (2026-09-13 갱신)</h3>
 * <pre>
 *   PEAKOFF   코스 짜기 · 코스 발견 .......... 서비스 소개 │ 마이페이지
 *             └── 하는 것(ITEMS) ──┘         └ 읽는 것 ┘   └ 계정 ┘
 * </pre>
 *
 * <p><b>"서비스 소개"는 {@code ITEMS}에 넣지 않는다.</b> 왼쪽 둘은 홈 진입 카드 둘과
 * 짝이고(나침반 = 가고 싶은 곳이 있다 · 주사위 = 없다) 둘 다 <b>하는 것</b>이다.
 * 소개는 <b>읽는 것</b>이라 같은 줄에 같은 무게로 세우면 그 짝이 깨지고, 핵심 진입점보다
 * 강조되어서도 안 된다. 오른쪽 유틸리티 자리에 두면 <b>위치가 위계를 말해</b> 준다 —
 * 아이콘도 필요 없다.
 *
 * <p><b>"홈"을 걷어냈다.</b> 왼쪽 글자가 이미 홈으로 가는 링크다(그 링크의 이름이
 * "PEAKOFF 처음으로"다). 같은 곳으로 가는 두 개가 손가락 하나 거리에 나란히 서 있었고,
 * 로고를 눌러 처음으로 가는 것은 웹에서 거의 관습이라 글자를 하나 더 둘 값을 못 한다.
 *
 * <p><b>마이페이지를 오른쪽 계정 자리로 옮겼다.</b> "왼쪽은 이동, 오른쪽 끝은 계정"이
 * 이 파일이 오래 적어 온 규칙인데, 정작 마이페이지가 이동 무리에 섞여 있었다 —
 * 계정을 찾는 사람이 두 곳을 봐야 했다.
 *
 * <p><b>넓은 화면 헤더에서 로그아웃을 걷어냈다.</b> 한 세션에 많아야 한 번 쓰는 일이
 * <b>오른쪽 끝</b>을 차지하고 있었다. 눈이 마지막으로 머무는 칸이다. 게다가 같은 것이
 * 세 곳에 있었다 — 헤더·좁은 화면 메뉴·마이페이지 아래쪽. 마이페이지 것은 경고색까지
 * 입고 있어 그쪽이 진짜 자리다. 이제 한 번 더 눌러 닿는다.
 *
 * <p>⚠️ <b>좁은 화면 메뉴에는 로그아웃이 남는다.</b> 거기는 헤더에 링크가 아예 없어,
 * 걷어내면 메뉴를 열고 마이페이지로 들어가는 두 걸음이 된다.
 *
 * <p><b>둘 중 하나는 반드시 화면에 있어야 한다.</b> 홈 화면이 {@code Layout} 밖에 있어
 * {@link HeaderNav}를 빠뜨린 적이 있는데, 그때 데스크톱에서는 이동 수단이 통째로 사라졌다.
 *
 * <h3>아래 고정 막대를 걷어낸 이유 (2026-08-25)</h3>
 * 좁은 화면에서는 화면 바닥에 붙는 막대({@code position: fixed; bottom: 0})를 썼는데,
 * <b>크롬 안드로이드에서 깨졌다.</b> 크롬은 도구막대가 나타났다 사라져도 화면이
 * 재배치되지 않도록 레이아웃 화면을 늘 큰 크기로 잡아 두는데, 그래서 도구막대가 떠 있는
 * 동안 그 바닥은 막대 뒤에 깔린다 — 아래로 쓸면 이동 막대가 브라우저 막대 뒤로 숨었다.
 *
 * <p>visualViewport로 그만큼 끌어올려 막아 봤지만, 브라우저 UI와 위치를 다투는 구조가
 * 남는 한 기기·브라우저마다 다시 깨질 자리다. <b>웹으로만 낼 서비스라 앱 흉내를 낼
 * 이유가 없어</b> 막대를 없애고 헤더 안으로 옮겼다. 헤더는 sticky라 브라우저 UI와
 * 자리를 다투지 않는다.
 */

interface Item {
  to: string
  label: string
  icon: ReactNode
}

/*
 * 아이콘은 인라인 SVG다. 이모지를 쓰면 기기마다 모양과 색이 달라져
 * 차분한 화면 톤이 깨지고, 아이콘 라이브러리를 넣으면 이거 세 개 때문에 의존성이 는다.
 * currentColor라 활성/비활성 색이 글자와 함께 바뀐다.
 *
 * <p><b>예외를 두지 않는다</b> (2026-09-02). 진입점 둘("코스 짜기"·"코스 발견")만 홈 진입
 * 카드의 그림글자(🧭·🎲)를 그대로 달아 봤는데, 색 있는 그림 둘과 검은 윤곽선 셋이 한 줄에
 * 서니 <b>메뉴 안에서 두 항목만 떠 보였다.</b> 이모지는 제 색을 갖고 있어
 * {@code currentColor}가 닿지 않는다 — 활성 상태에서 다른 항목이 틸로 물들 때
 * 그 둘만 그대로였고, 그래서 <b>선택된 것처럼 보이는 항목이 늘 둘</b> 있었다.
 *
 * <p>대신 <b>모양만 가져왔다</b> — 나침반과 주사위를 같은 규격의 선으로 다시 그렸다.
 * 홈 카드와 이어주던 것은 색이 아니라 <b>무엇을 그렸는가</b>이므로, 선으로 옮겨도 그 끈은
 * 끊기지 않는다. 한 벌로 남고 색은 글자를 따라간다.
 */
const ICON_PROPS = {
  width: 20,
  height: 20,
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

/**
 * <b>갈 곳 둘.</b> 코스를 시작하는 두 입구이고, 홈이 갈림길 카드 둘로 보여주는 그 쌍이다.
 *
 * <p>마이페이지는 여기 없다 — 계정이라 오른쪽 끝({@link HeaderAuthAction})에 선다.
 * 홈도 없다 — 왼쪽 로고가 그 일을 한다. 파일 머리말 참고.
 */
const ITEMS: Item[] = [
  {
    to: '/plan',
    /*
     * <b>나침반</b>이다 (2026-09-02). 지도 핀을 쓰다가 홈 진입 카드 "가고 싶은 곳이 있어요"의
     * 나침반으로 맞췄다 — 나침반은 <b>방향을 이미 아는 사람</b>을 가리킨다.
     *
     * 홈은 그림글자(🧭)를 쓰고 여기는 같은 모양의 선이다. 이어주는 것은 색이 아니라 모양이다.
     * 바늘이 <b>북동을 가리키는 마름모</b>라 원 안이 비지 않는다 — 원만 있으면 아래
     * "코스 발견"의 둥근 네모와 좁은 화면에서 헷갈린다.
     */
    label: '코스 짜기',
    icon: (
      <svg {...ICON_PROPS}>
        <circle cx="10" cy="10" r="6.9" />
        <path d="M13.2 6.8 11.3 11.3 6.8 13.2 8.7 8.7z" />
      </svg>
    ),
  },
  {
    /*
     * 설문 기반 코스 추천. 경주를 모르는 사람의 진입점이라 <b>코스 짜기 바로 옆</b>에 둔다.
     * 홈 카드에만 있으면 다른 화면으로 넘어간 뒤에는 돌아갈 길이 없다.
     *
     * <b>위 "코스 짜기"와 한 쌍이다</b> (2026-09-02). 반짝임을 쓰다가 홈 진입 카드의
     * 주사위로 맞췄다 — 같은 곳으로 데려가는 두 입구가 서로 다른 그림을 달고 있으면
     * 사용자가 둘을 잇지 못한다. 주사위는 "매번 다른 답이 온다"(가중 무작위)는 뜻이라
     * 이 문이 실제로 하는 일을 가리킨다.
     *
     * 눈 셋만 <b>채운다</b>({@code fill}) — 20px에서 지름 2px짜리 동그라미를 선으로 그리면
     * 획 두 개가 맞닿아 검은 점으로 뭉갠다. 채우는 색도 {@code currentColor}라
     * 나머지 획과 함께 움직인다.
     */
    to: '/recommend',
    /*
     * <b>"추천"이 아니라 "발견"이다.</b> 이 문은 매번 다른 코스를 내놓는데(가중 무작위)
     * "추천"은 늘 같은 답이 오는 것처럼 들린다. 무엇보다 서비스 전체가 이 낱말로
     * 이어진다 — 진단의 "새로운 곳 발견하기", 결과의 "새로운 여행지를 N곳 발견했어요".
     * 네비만 다른 말을 쓰면 같은 곳을 가리키는 이름이 둘이 된다.
     */
    label: '코스 발견',
    icon: (
      <svg {...ICON_PROPS}>
        <rect x="3.4" y="3.4" width="13.2" height="13.2" rx="3.2" />
        <circle cx="7.1" cy="7.1" r="1.05" fill="currentColor" stroke="none" />
        <circle cx="10" cy="10" r="1.05" fill="currentColor" stroke="none" />
        <circle cx="12.9" cy="12.9" r="1.05" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
]

/**
 * 계정 자리에 서는 항목. <b>{@code ITEMS}와 갈라 두었다</b> (2026-09-09).
 *
 * <p>넓은 화면에서는 오른쪽 끝에, 좁은 화면에서는 메뉴 목록 맨 아래에 선다.
 * 자리가 다르지만 <b>같은 문</b>이라 이름·그림을 한 곳에서 정한다.
 *
 * <p>⚠️ <b>로그인한 사람에게만 보인다.</b> 게스트가 눌러도 로그인 화면으로 튕기는데,
 * 갈 수 없는 곳을 메뉴에 세워 두는 셈이다. 게스트에게는 같은 자리에 "로그인"이 서므로
 * 들어가는 문이 사라지지도 않는다.
 */
const MY_PAGE: Item = {
  to: '/my',
  label: '마이페이지',
  icon: (
    <svg {...ICON_PROPS}>
      <circle cx="10" cy="6.8" r="3" />
      <path d="M4.2 16.8a5.8 5.8 0 0 1 11.6 0" />
    </svg>
  ),
}

/**
 * 서비스 소개. <b>{@code ITEMS}와 갈라 둔 이유는 {@link MY_PAGE}와 같다</b> — 자리가 다르다.
 *
 * <p>넓은 화면에서는 계정 자리 왼쪽에, 좁은 화면에서는 메뉴 목록에서 이동 링크와 계정
 * 사이에 선다. 읽는 곳이라 하는 곳들과 계정 사이가 제 자리다.
 *
 * <p>그림은 <b>동그라미 안의 i</b>다. {@code Alert}(동그라미 안의 !)와 획은 같고 점의
 * 자리만 위아래로 갈린다 — 저쪽은 경고, 이쪽은 알림이다. 둘이 같은 화면에 함께 서는
 * 일이 없어 이 차이로 충분하다.
 */
const ABOUT: Item = {
  to: '/about',
  label: '서비스 소개',
  icon: (
    <svg {...ICON_PROPS}>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6.6v0" />
      <path d="M10 9.4v4" />
    </svg>
  ),
}

/**
 * 좁은 화면의 헤더에 서는 메뉴 토글.
 *
 * <p>{@link HeaderNav}가 나타나는 md 아래에서만 보인다. 둘이 동시에 보이면 같은 링크가
 * 두 곳에 생겨 어디를 눌러야 하는지가 흔들린다.
 *
 * <p><b>펼침 판을 버튼 기준으로 띄운다.</b> 헤더 아래 전체 폭으로 깔 수도 있지만 그러면
 * 헤더 높이(h-14)를 이 파일이 알아야 하고, 헤더를 손볼 때마다 여기가 따라 어긋난다.
 * 버튼에 붙여 두면 헤더가 얼마나 두껍든 늘 그 바로 아래에 선다.
 *
 * <p>뒤에 깔리는 투명 판은 <b>바깥을 눌러 닫기</b> 위한 것이다. 없으면 메뉴를 닫으려고
 * 아무 데나 눌렀을 때 그 아래 버튼이 대신 눌린다.
 */
/**
 * 문 밖으로 나가는 화살표. 위 {@code ITEMS}와 같은 규격(20×20, 획 1.6)이라
 * 메뉴에서 나란히 섰을 때 굵기가 어긋나지 않는다.
 */
function LogoutIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M12.5 6.2V4.5a1 1 0 0 0-1-1H4.6a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h6.9a1 1 0 0 0 1-1v-1.7" />
      <path d="M8.8 10h7.6" />
      <path d="m14 7.6 2.4 2.4-2.4 2.4" />
    </svg>
  )
}

export function MobileMenu() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const { member, loading, logout } = useAuth()

  /*
   * 화면이 바뀌면 닫는다. 메뉴에서 고른 링크로 넘어간 뒤에도 판이 남아 있으면,
   * 새 화면 위에 옛 메뉴가 떠 있는 꼴이 된다.
   */
  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!open) {
      return
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open])

  return (
    /*
      h-full: 묶음이 헤더 높이를 그대로 받는다. 그래야 아래 펼침 판의 top-full이
      <b>버튼 아랫변이 아니라 헤더 아랫변</b>이 된다. 버튼 기준으로 두면 헤더가
      버튼보다 두꺼운 만큼(지금은 위아래 10px씩) 판이 헤더 경계선을 파고든다.
    */
    <div className="relative flex h-full items-center md:hidden">
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? '메뉴 닫기' : '메뉴 열기'}
        className="text-fg hover:bg-fill grid h-9 w-9 cursor-pointer place-items-center rounded-chip bg-transparent press"
      >
        {/* 열려 있으면 X. 같은 버튼이 여닫이라는 것을 모양으로 말한다 */}
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinecap="round"
          aria-hidden="true"
        >
          {open ? (
            <>
              <path d="M5 5 15 15" />
              <path d="M15 5 5 15" />
            </>
          ) : (
            <>
              <path d="M3.5 6h13" />
              <path d="M3.5 10h13" />
              <path d="M3.5 14h13" />
            </>
          )}
        </svg>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-20"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <nav
            id="mobile-menu"
            aria-label="주요 화면"
            className="border-line bg-surface shadow-raised absolute top-full right-0 z-30 mt-2 flex w-44 flex-col gap-0.5 rounded-[16px] border p-1.5"
          >
            {/*
              ⚠️ <b>마이페이지가 목록 끝에 붙는다.</b> 넓은 화면은 그것을 오른쪽 끝으로
              옮겼지만 여기는 옮길 자리가 없다 — 좁은 화면 헤더에는 토글뿐이라,
              메뉴 밖으로 빼면 갈 길이 사라진다. 계정이라는 것은 <b>아래 선</b>이 말한다.
            */}
            {[...ITEMS, ABOUT, ...(!loading && member ? [MY_PAGE] : [])].map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-chip px-3 py-2.5 text-[14px] no-underline transition-colors ${
                    isActive
                      ? 'bg-brand-tint text-brand-deep font-semibold'
                      : 'text-fg hover:bg-bg font-medium'
                  }`
                }
              >
                {item.icon}
                {item.label}
              </NavLink>
            ))}

            {/*
              로그아웃은 <b>가는 곳이 아니라 하는 일</b>이라 선으로 갈라 둔다.
              위 항목들과 같은 모양으로 붙여 두면 다섯 번째 화면처럼 읽힌다.

              색은 헤더의 "로그인" 링크와 같은 톤이다. 둘은 같은 자리에서 서로를 대신하는
              한 쌍이라, 하나는 조용하고 하나는 빨갛게 두면 같은 종류로 안 읽힌다.
              경고색을 입은 로그아웃은 마이페이지 아래쪽에 따로 있다.

              <b>누르면 화면을 옮기지 않는다.</b> 여기서 홈으로 보내면 코스를 편집하던 중에
              로그아웃한 사람의 작업이 통째로 날아간다. 게스트도 서비스 전체를 쓸 수 있으므로
              그 자리에 그대로 있는 편이 맞다 — 로그인은 저장을 위한 선택지이지 진입 장벽이 아니다.

              마이페이지처럼 <b>로그인해야만 볼 수 있는 화면</b>은 각자 알아서 비켜선다.
              그쪽 가드가 "있었는데 없어졌으면 홈으로"를 이미 판단한다.
            */}
            {!loading && member && (
              <>
                <span className="bg-line mx-1 my-1 h-px" aria-hidden="true" />
                <button
                  type="button"
                  onClick={logout}
                  className="text-hint hover:bg-bg hover:text-fg flex cursor-pointer items-center gap-2.5 rounded-chip bg-transparent px-3 py-2.5 text-left text-[14px] font-medium press"
                >
                  <LogoutIcon />
                  로그아웃
                </button>
              </>
            )}
          </nav>
        </>
      )}
    </div>
  )
}

/**
 * 넓은 화면의 헤더에 서는 같은 링크들.
 *
 * <p>{@link MobileMenu}가 숨는 md부터 나타난다. 둘이 동시에 보이면 같은 링크가 두 곳에 생겨
 * 어디를 눌러야 하는지가 흔들린다.
 *
 * <p><b>헤더를 직접 그리는 화면마다 넣어야 한다.</b> {@code Layout}을 쓰지 않는 홈 화면이
 * 여기에 해당한다.
 *
 * <p>여기 서는 것은 <b>갈 곳 둘</b>뿐이다. 마이페이지는 계정이라 오른쪽 끝으로,
 * 홈은 왼쪽 로고로 갔다 — 파일 머리말 참고.
 */
export function HeaderNav() {
  return (
    <nav className="hidden items-center gap-5 md:flex" aria-label="주요 화면">
      {ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `text-[13.5px] whitespace-nowrap no-underline transition-colors ${
              isActive ? 'text-fg font-semibold' : 'text-muted hover:text-fg font-medium'
            }`
          }
        >
          {item.label}
        </NavLink>
      ))}

    </nav>
  )
}

/**
 * 헤더 오른쪽, 계정 자리 <b>왼쪽</b>에 서는 소개 링크.
 *
 * <p>{@link HeaderNav}(왼쪽 이동 링크들)와 같은 글자 크기·같은 활성 표시를 쓴다.
 * 모양까지 다르게 두면 같은 종류(갈 곳)인 것을 알아볼 단서가 없어진다 —
 * 이것이 이동이 아니라 <b>읽는 곳</b>이라는 사실은 자리가 말한다.
 *
 * <p>⚠️ <b>좁은 화면에서는 서지 않는다.</b> 그쪽은 {@link MobileMenu} 안에 있다.
 * 좁은 헤더에 토글·로그인과 나란히 셋을 두면 오른쪽이 붐빈다 — 마이페이지가
 * 같은 이유로 메뉴 안에 있다.
 *
 * <p>홈은 {@code Layout}을 쓰지 않으므로 <b>홈 헤더에도 따로 넣어야 한다.</b>
 */
export function HeaderAboutLink() {
  return (
    <NavLink
      to="/about"
      className={({ isActive }) =>
        `hidden text-[13.5px] whitespace-nowrap no-underline transition-colors md:block ${
          isActive ? 'text-fg font-semibold' : 'text-muted hover:text-fg font-medium'
        }`
      }
    >
      {ABOUT.label}
    </NavLink>
  )
}

/**
 * 헤더 <b>오른쪽 끝</b>에 서는 계정 자리. 로그인 전이면 "로그인", 뒤면 "마이페이지".
 *
 * <p>둘은 같은 자리에서 서로를 대신하는 한 쌍이라 한 컴포넌트로 묶었다. 예전에는
 * 로그인 링크를 헤더마다 각자 그리고 있었는데({@code Layout}과 홈이 따로),
 * 같은 분기를 두 벌 적게 될 자리였다.
 *
 * <h3>여기 있던 로그아웃을 걷어냈다 (2026-09-09)</h3>
 * 왼쪽은 이동, 오른쪽 끝은 계정 — 자리로 종류를 나눈다는 규칙은 그대로다. 다만 그 규칙을
 * 지키는 것이 <b>로그아웃일 이유가 없었다.</b> 한 세션에 많아야 한 번 쓰는 일이 눈이
 * 마지막으로 머무는 칸을 차지했고, 정작 <b>계정으로 들어가는 문</b>인 마이페이지는
 * 이동 링크들 사이에 섞여 있었다. 둘을 맞바꾸니 규칙과 화면이 처음으로 맞는다.
 *
 * <p>로그아웃은 사라지지 않는다 — {@link MobileMenu} 안과 마이페이지 아래쪽에 있고,
 * 그중 마이페이지 것은 경고색을 입고 있어 원래 그쪽이 제 자리다.
 *
 * <h3>닉네임을 세우지 않는 이유</h3>
 * 이름은 <b>정보처럼 보이지 버튼처럼 보이지 않는다.</b> 눌러야 한다는 것을 아는 사람에게만
 * 동작하는 문이 된다. 그래서 이 자리에도 이름 대신 <b>갈 곳의 이름</b>을 적는다.
 *
 * <p><b>좁은 화면에서 마이페이지는 여기 서지 않는다.</b> 그쪽은 {@link MobileMenu} 안에
 * 있다 — 헤더에 토글과 나란히 두면 좁은 폭에서 오른쪽이 붐빈다.
 * 반면 "로그인"은 좁은 화면에도 남긴다. 아직 계정이 없는 사람에게는 그것이
 * 메뉴 안에 숨으면 안 되는 유일한 입구다.
 */
export function HeaderAuthAction() {
  const { member, loading } = useAuth()

  /*
   * 확인이 끝나기 전에는 자리만 잡아 둔다. "로그인"을 먼저 띄웠다가 로그아웃으로
   * 바뀌거나 사라지면 헤더가 깜빡인다.
   */
  if (loading) {
    return <span className="h-4 w-12" aria-hidden="true" />
  }

  if (!member) {
    return (
      <NavLink
        to="/login"
        className="text-hint hover:text-fg rounded-chip p-2 text-[13px] font-medium no-underline"
      >
        로그인
      </NavLink>
    )
  }

  /*
   * 이동 링크와 <b>같은 글자 크기·같은 활성 표시</b>를 쓴다. 갈 곳이라는 점은 왼쪽
   * 링크들과 다르지 않고, 계정이라는 것은 <b>자리</b>가 말한다 — 모양까지 다르게 두면
   * 같은 종류인 것을 알아볼 단서가 없어진다.
   */
  return (
    <NavLink
      to="/my"
      className={({ isActive }) =>
        `hidden text-[13.5px] whitespace-nowrap no-underline transition-colors md:block ${
          isActive ? 'text-fg font-semibold' : 'text-muted hover:text-fg font-medium'
        }`
      }
    >
      {MY_PAGE.label}
    </NavLink>
  )
}
