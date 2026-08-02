import { Link, NavLink, Outlet } from 'react-router'
import { REGIONS } from '../constants/regions'
import { useTrip } from '../state/tripContext'
import { formatDateRange, formatDuration } from '../utils/date'

/**
 * 모든 페이지가 공유하는 껍데기.
 *
 * 헤더는 화면 위에 고정하고, 본문만 스크롤한다. 모바일에서 목록을 길게 내렸을 때도
 * 현재 어떤 서비스에 있는지 잃지 않게 하려는 것이다.
 *
 * 라우트의 부모로 두면 페이지를 옮겨도 헤더가 다시 그려지지 않는다.
 */
export function Layout() {
  const { state } = useTrip()
  const plan = state.plan
  const regionName = REGIONS.find((region) => region.slug === plan?.region)?.name

  return (
    <div className="flex min-h-svh flex-col">
      <header className="bg-surface border-line sticky top-0 z-10 h-14 border-b">
        {/*
          헤더 안쪽도 본문과 같은 폭으로 묶는다. 이렇게 하지 않으면 데스크톱에서
          로고만 화면 왼쪽 끝에 붙어 본문과 어긋난다.
        */}
        <div className="max-w-app mx-auto flex h-full items-center justify-between gap-2 px-4 md:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2.5">
            <Link
              to="/"
              className="flex flex-none items-center gap-2 no-underline"
              aria-label="PEAKOFF 처음으로"
            >
              {/* 로고 마크. 붐빔 속 한 점의 여백 — 서비스 이름과 같은 뜻이다. */}
              <span className="bg-brand relative h-5 w-5 rounded-[7px]" aria-hidden="true">
                <span className="bg-surface absolute top-1.5 left-1.5 h-2 w-2 rounded-full" />
              </span>
              <span className="text-fg text-xs font-bold tracking-[0.16em]">PEAKOFF</span>
            </Link>

            {/*
              조건을 정한 뒤에는 헤더가 "지금 무슨 여행을 보고 있는지"를 함께 들고 간다.
              화면을 옮겨 다니는 동안 날짜를 다시 확인하러 뒤로 갈 일이 없어진다.
              좁은 화면에서는 자리가 없어 감춘다.
            */}
          </div>

          {/*
            로그인은 구석에 작게 둔다. 버튼처럼 강조하면 게스트가
            "먼저 로그인해야 하나" 하고 멈칫한다.
          */}
          <NavLink
            to="/login"
            className="text-hint hover:text-fg -mr-2 flex-none rounded-chip p-2 text-[13px] font-medium no-underline"
          >
            로그인
          </NavLink>
        </div>
      </header>

      {/* 좌우 여백은 화면이 넓어질수록 조금씩 키운다. 넓은 화면에서 내용이
          가장자리에 붙어 있으면 껍데기 안에 담겼다는 느낌이 나지 않는다. */}
      <main className="max-w-app mx-auto w-full flex-1 px-4.5 pt-6 pb-8 md:px-6 lg:px-8 lg:pt-8 lg:pb-12">
        <Outlet />
      </main>
    </div>
  )
}
