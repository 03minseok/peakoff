import { Link, Outlet } from 'react-router'
import { BrandLockup } from './BrandMark'
import { HeaderAuthAction, HeaderNav, MobileMenu } from './Nav'

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
      <header className="bg-surface border-line sticky top-0 z-10 h-14 border-b">
        {/*
          헤더 안쪽도 본문과 같은 폭으로 묶는다. 이렇게 하지 않으면 데스크톱에서
          로고만 화면 왼쪽 끝에 붙어 본문과 어긋난다.
        */}
        <div className="max-w-app mx-auto flex h-full items-center justify-between gap-2 px-4 md:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2.5">
            <Link to="/" className="flex-none no-underline" aria-label="PEAK OFF 처음으로">
              <BrandLockup />
            </Link>

            {/* 넓은 화면에서는 여기, 좁은 화면에서는 헤더 오른쪽 토글 메뉴.
                둘은 서로를 가려서 동시에 보이지 않는다. */}
            <HeaderNav />
          </div>

          {/*
            헤더 오른쪽 끝. 좁은 화면에서는 <b>메뉴 토글</b>이 여기 서고, 그 왼쪽에
            계정 버튼(로그인/로그아웃)이 붙는다. md부터는 토글이 숨고 HeaderNav가 대신한다.

            로그인한 뒤에도 닉네임은 두지 않는다. 마이페이지로 가는 길은 이미 이동 메뉴에
            있어서, 닉네임까지 링크로 두면 같은 곳으로 가는 문이 나란히 두 개가 된다.
            누구로 로그인했는지는 마이페이지가 보여준다.

            -mr-2는 묶음에 준다. 그래야 좁은 화면에서는 토글이, 넓은 화면에서는
            계정 버튼이 각각 헤더 가장자리에 붙는다.
          */}
          <div className="-mr-2 flex flex-none items-center gap-1 self-stretch">
            <HeaderAuthAction />
            <MobileMenu />
          </div>
        </div>
      </header>

      {/* 좌우 여백은 화면이 넓어질수록 조금씩 키운다. 넓은 화면에서 내용이
          가장자리에 붙어 있으면 껍데기 안에 담겼다는 느낌이 나지 않는다.

          아래 고정 막대를 걷어내면서 그것을 피하려던 여백(pb-24)도 함께 뺐다. */}
      <main className="max-w-app mx-auto w-full flex-1 px-4.5 pt-6 pb-8 md:px-6 lg:px-8 lg:pt-8 lg:pb-12">
        <Outlet />
      </main>
    </div>
  )
}
