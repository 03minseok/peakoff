import { Link, NavLink, Outlet } from 'react-router'

/**
 * 모든 페이지가 공유하는 껍데기.
 *
 * 헤더는 화면 위에 고정하고, 본문만 스크롤한다. 모바일에서 목록을 길게 내렸을 때도
 * 현재 어떤 서비스에 있는지 잃지 않게 하려는 것이다.
 *
 * 라우트의 부모로 두면 페이지를 옮겨도 헤더가 다시 그려지지 않는다.
 */
export function Layout() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="bg-bg border-line sticky top-0 z-10 h-14 border-b">
        {/*
          헤더 안쪽도 본문과 같은 폭으로 묶는다. 이렇게 하지 않으면 데스크톱에서
          로고만 화면 왼쪽 끝에 붙어 본문과 어긋난다.
        */}
        <div className="max-w-app mx-auto flex h-full items-center justify-between gap-2 px-4">
          <Link
            to="/"
            className="text-brand-strong text-lg font-bold tracking-tight no-underline"
          >
            PEAKOFF
          </Link>

          {/*
            로그인은 구석에 작게 둔다. 버튼처럼 강조하면 게스트가
            "먼저 로그인해야 하나" 하고 멈칫한다.
          */}
          <NavLink
            to="/login"
            className="text-muted hover:text-fg -mr-2 rounded-md p-2 text-[13px] no-underline"
          >
            로그인
          </NavLink>
        </div>
      </header>

      <main className="max-w-app mx-auto w-full flex-1 px-4 pt-6 pb-8">
        <Outlet />
      </main>
    </div>
  )
}
