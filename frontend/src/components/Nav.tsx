import { NavLink } from 'react-router'
import type { ReactNode } from 'react'

/**
 * 화면 아래에 붙어 다니는 이동 막대.
 *
 * <p>닉네임을 눌러야 마이페이지로 가는 구조는 <b>눌러야 한다는 것을 알아야만</b> 동작한다.
 * 이름은 정보처럼 보이지 버튼처럼 보이지 않는다. 갈 수 있는 곳을 아래에 늘어놓으면
 * 유추할 필요가 없어진다.
 *
 * <p><b>좁은 화면에서만 보인다.</b> 아래 고정 막대는 엄지가 닿는 자리를 위한 배치다.
 * 데스크톱은 포인터가 어디든 닿고 시선도 위로 가므로, 넓은 화면에서는 {@link HeaderNav}가
 * 헤더에서 같은 일을 한다.
 *
 * <p>두 컴포넌트가 {@code ITEMS} 하나를 공유한다. 목록을 두 벌로 적으면 메뉴를 더할 때
 * 한쪽만 고쳐진다.
 *
 * <p><b>둘 중 하나는 반드시 화면에 있어야 한다.</b> 홈 화면이 {@code Layout} 밖에 있어
 * {@link HeaderNav}를 빠뜨린 적이 있는데, 그때 데스크톱에서는 이동 수단이 통째로 사라졌다.
 */

/** 막대 높이(60px). 본문 아래 여백과 다른 고정 버튼의 위치가 이 값에 맞춰져 있다. */
export const BOTTOM_NAV_HEIGHT = 'h-15'

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
    label: '코스 짜기',
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M10 17.2s5.4-5 5.4-9.2a5.4 5.4 0 1 0-10.8 0c0 4.2 5.4 9.2 5.4 9.2z" />
        <circle cx="10" cy="8" r="2" />
      </svg>
    ),
  },
  {
    /*
     * 설문 기반 코스 추천. 경주를 모르는 사람의 진입점이라 <b>코스 짜기 바로 옆</b>에 둔다.
     * 홈 카드에만 있으면 다른 화면으로 넘어간 뒤에는 돌아갈 길이 없다.
     *
     * 아이콘은 반짝임 — "골라 준다"는 뜻이다. 코스 짜기(핀)와 모양이 확실히 달라야
     * 좁은 화면의 막대에서 둘이 헷갈리지 않는다.
     */
    to: '/recommend',
    label: '코스 추천',
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M10 2.8 11.6 7 15.8 8.6 11.6 10.2 10 14.4 8.4 10.2 4.2 8.6 8.4 7z" />
        <path d="M15.2 13.2 15.9 15.1 17.8 15.8 15.9 16.5 15.2 18.4 14.5 16.5 12.6 15.8 14.5 15.1z" />
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

export function BottomNav() {
  return (
    <nav
      className="border-line bg-surface fixed right-0 bottom-0 left-0 z-40 border-t md:hidden"
      aria-label="주요 화면"
    >
      {/* 아이폰 홈 인디케이터에 가리지 않게 아래를 한 겹 더 띄운다. */}
      <div
        className={`mx-auto flex w-full max-w-[430px] ${BOTTOM_NAV_HEIGHT}`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center justify-center gap-1 text-[11px] no-underline transition-colors ${
                isActive ? 'text-brand-deep font-semibold' : 'text-hint hover:text-muted font-medium'
              }`
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

/**
 * 넓은 화면의 헤더에 서는 같은 링크들.
 *
 * <p>{@link BottomNav}가 숨는 md부터 나타난다. 둘이 동시에 보이면 같은 링크가 두 곳에 생겨
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
