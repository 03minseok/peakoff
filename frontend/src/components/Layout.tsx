import { Link, NavLink, Outlet } from 'react-router'
import './Layout.css'

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
    <div className="layout">
      <header className="layout-header">
        <div className="layout-header-inner">
          <Link to="/" className="brand">
            PEAKOFF
          </Link>

          {/*
            로그인은 구석에 작게 둔다. 게스트가 그냥 지나칠 수 있어야 하며,
            눈에 띄게 만들면 "로그인해야 쓰는 서비스"로 읽힌다.
          */}
          <NavLink to="/login" className="header-login">
            로그인
          </NavLink>
        </div>
      </header>

      <main className="layout-main">
        <Outlet />
      </main>
    </div>
  )
}
