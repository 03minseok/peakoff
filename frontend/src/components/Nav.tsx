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
  /** 정확히 그 경로일 때만 켜진다. "/"처럼 모든 경로의 앞부분인 경우에 필요하다 */
  end?: boolean
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
 * 끊기지 않는다. 다섯이 한 벌로 남고 색은 글자를 따라간다.
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

const ITEMS: Item[] = [
  {
    to: '/',
    label: '홈',
    end: true,
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M3.2 8.8 10 3.5l6.8 5.3V16a1 1 0 0 1-1 1h-3.4v-4.6H7.6V17H4.2a1 1 0 0 1-1-1z" />
      </svg>
    ),
  },
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
  {
    to: '/my',
    label: '마이페이지',
    icon: (
      <svg {...ICON_PROPS}>
        <circle cx="10" cy="6.8" r="3" />
        <path d="M4.2 16.8a5.8 5.8 0 0 1 11.6 0" />
      </svg>
    ),
  },
]

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
        className="text-fg hover:bg-fill grid h-9 w-9 cursor-pointer place-items-center rounded-[11px] bg-transparent transition-colors"
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
            {ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-[11px] px-3 py-2.5 text-[14px] no-underline transition-colors ${
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
                  className="text-hint hover:bg-bg hover:text-fg flex cursor-pointer items-center gap-2.5 rounded-[11px] bg-transparent px-3 py-2.5 text-left text-[14px] font-medium transition-colors"
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
 */
export function HeaderNav() {
  return (
    <nav className="hidden items-center gap-5 md:flex" aria-label="주요 화면">
      {ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
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
 * 헤더 <b>오른쪽 끝</b>에 서는 인증 버튼. 로그인 전이면 "로그인", 뒤면 "로그아웃".
 *
 * <p>둘은 같은 자리에서 서로를 대신하는 한 쌍이라 한 컴포넌트로 묶었다. 예전에는
 * 로그인 링크를 헤더마다 각자 그리고 있었는데({@code Layout}과 홈이 따로), 로그아웃을
 * 더하면서 같은 분기를 두 벌 적게 될 자리였다.
 *
 * <h3>로그아웃이 마이페이지 옆이 아닌 이유</h3>
 * 처음에는 {@link HeaderNav}의 링크들 끝에 붙였는데, 그러면 <b>가는 곳들 사이에
 * 하는 일이 하나 끼어</b> 다섯 번째 화면처럼 읽혔다. 세로선으로 갈라도 줄은 하나였다.
 * 왼쪽은 이동, 오른쪽 끝은 계정 — 자리로 종류를 나누는 편이 선 하나보다 분명하다.
 *
 * <p><b>좁은 화면에서 로그아웃은 여기 서지 않는다.</b> 그쪽은 {@link MobileMenu} 안에
 * 있다 — 헤더에 토글과 나란히 두면 좁은 폭에서 오른쪽이 붐빈다.
 * 반면 "로그인"은 좁은 화면에도 남긴다. 아직 계정이 없는 사람에게는 그것이
 * 메뉴 안에 숨으면 안 되는 유일한 입구다.
 */
export function HeaderAuthAction() {
  const { member, loading, logout } = useAuth()

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

  return (
    <button
      type="button"
      onClick={logout}
      className="text-hint hover:text-fg hidden cursor-pointer rounded-chip bg-transparent p-2 text-[13px] font-medium whitespace-nowrap transition-colors md:block"
    >
      로그아웃
    </button>
  )
}
