import { Link, NavLink, Outlet } from 'react-router'
import { BottomNav, HeaderNav } from './BottomNav'
import { useAuth } from '../state/authContext'

/**
 * 모든 페이지가 공유하는 껍데기.
 *
 * 헤더는 화면 위에 고정하고, 본문만 스크롤한다. 모바일에서 목록을 길게 내렸을 때도
 * 현재 어떤 서비스에 있는지 잃지 않게 하려는 것이다.
 *
 * 라우트의 부모로 두면 페이지를 옮겨도 헤더가 다시 그려지지 않는다.
 */
export function Layout() {
  const { member, loading } = useAuth()

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

            {/* 넓은 화면에서는 여기, 좁은 화면에서는 아래 BottomNav.
                둘은 서로를 가려서 동시에 보이지 않는다. */}
            <HeaderNav />
          </div>

          {/*
            로그인하지 않았을 때만 이 자리를 쓴다.

            로그인한 뒤에는 닉네임을 두지 않는다. 마이페이지로 가는 길은 이미
            HeaderNav("마이페이지")와 BottomNav에 있어서, 닉네임까지 링크로 두면
            같은 곳으로 가는 문이 나란히 두 개가 된다. 마이페이지에 서 있을 때는
            눌러도 아무 일이 없어 더 어색하다. 누구로 로그인했는지는 마이페이지가 보여준다.

            확인이 끝나기 전에는 아무것도 그리지 않는다. "로그인"을 먼저 띄웠다가
            사라지면 헤더가 깜빡인다.
          */}
          {loading ? (
            <span className="h-4 w-12 flex-none" aria-hidden="true" />
          ) : member ? null : (
            <NavLink
              to="/login"
              className="text-hint hover:text-fg -mr-2 flex-none rounded-chip p-2 text-[13px] font-medium no-underline"
            >
              로그인
            </NavLink>
          )}
        </div>
      </header>

      {/* 좌우 여백은 화면이 넓어질수록 조금씩 키운다. 넓은 화면에서 내용이
          가장자리에 붙어 있으면 껍데기 안에 담겼다는 느낌이 나지 않는다.

          아래 여백(pb-24)은 BottomNav가 본문 끝을 가리지 않게 하려는 것이다.
          막대가 사라지는 md부터는 원래 값으로 돌아간다. */}
      <main className="max-w-app mx-auto w-full flex-1 px-4.5 pt-6 pb-24 md:px-6 md:pb-8 lg:px-8 lg:pt-8 lg:pb-12">
        <Outlet />
      </main>

      <BottomNav />
    </div>
  )
}
