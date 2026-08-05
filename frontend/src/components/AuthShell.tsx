import { Link, useNavigate } from 'react-router'
import type { ReactNode } from 'react'

interface Props {
  /** 데스크톱 좌측 패널 제목. 줄바꿈을 직접 넣을 수 있게 노드로 받는다 */
  panelTitle: ReactNode
  panelDescription: string
  children: ReactNode
  /**
   * 화면 아래에 붙어 따라오는 영역 (제출 버튼 등).
   *
   * 회원가입처럼 입력칸이 많아 스크롤이 생기는 화면에서, 버튼을 찾으러
   * 끝까지 내려가지 않아도 되게 한다.
   */
  footer?: ReactNode
}

/**
 * 로그인·회원가입이 공유하는 껍데기.
 *
 * 이 두 화면은 여행 흐름(조건 → 편집 → 진단) 바깥에 있다. 그래서 공용 {@link ./Layout}의
 * 헤더를 쓰지 않고 자기 상단 바를 갖는다 — 여기서 할 일은 "계정을 만들거나 들어가는 것"
 * 하나뿐이라, 여행 정보를 이고 다니는 헤더가 오히려 방해가 된다.
 *
 * 데스크톱에서는 좌측에 어두운 패널이 선다. 폼만 가운데 덩그러니 놓으면
 * 넓은 화면에서 빈 공간이 화면의 대부분을 차지한다.
 */
export function AuthShell({ panelTitle, panelDescription, children, footer }: Props) {
  const navigate = useNavigate()

  /**
   * 주소로 이 화면에 바로 들어온 경우 뒤로 갈 곳이 없다.
   *
   * 그때 navigate(-1)을 부르면 브라우저가 서비스 밖으로 나가버린다.
   * 리액트 라우터는 자기가 쌓은 기록의 위치를 history.state.idx에 남기므로 그걸로 가른다.
   */
  function goBack() {
    const entry = window.history.state as { idx?: number } | null
    if (entry?.idx && entry.idx > 0) {
      navigate(-1)
      return
    }
    navigate('/')
  }

  return (
    <div className="flex min-h-svh flex-col lg:flex-row">
      {/*
        데스크톱 좌측 패널. 최종 비교 화면의 히어로와 같은 어두운 면을 쓴다.
        서비스 안에서 "짙은 면 = 결론을 말하는 자리"로 읽히게 하려는 것이다.
      */}
      <aside className="bg-fg relative hidden overflow-hidden px-8.5 py-9.5 text-white lg:flex lg:w-100 lg:flex-none lg:flex-col lg:justify-between">
        <div
          className="absolute -top-17.5 -right-22.5 h-70 w-70 rounded-full bg-[rgb(14_124_134/0.28)]"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-22.5 -left-15 h-55 w-55 rounded-full bg-[rgb(14_124_134/0.14)]"
          aria-hidden="true"
        />

        <Link to="/" className="relative flex items-center gap-2.25 no-underline">
          {/* 어두운 면에서는 로고 마크도 밝은 청록으로 바꾼다. 브랜드색 그대로면 배경에 묻힌다. */}
          <span className="bg-quiet-soft relative h-5.5 w-5.5 rounded-[8px]" aria-hidden="true">
            <span className="bg-fg absolute top-1.75 left-1.75 h-2 w-2 rounded-full" />
          </span>
          <span className="text-xs font-bold tracking-[0.16em] text-white">PEAKOFF</span>
        </Link>

        <div className="relative flex flex-col gap-3.5">
          <h2 className="m-0 text-[30px] leading-[1.35] font-bold tracking-[-0.025em] text-pretty">
            {panelTitle}
          </h2>
          <p className="m-0 text-[14.5px] leading-[1.7] text-white/60 text-pretty">
            {panelDescription}
          </p>
        </div>

        <Link
          to="/"
          className="text-quiet-soft relative inline-flex items-center gap-1.75 text-sm font-semibold no-underline"
        >
          로그인 없이 둘러보기 <span aria-hidden="true">›</span>
        </Link>
      </aside>

      <div className="flex flex-1 flex-col">
        {/*
          모바일 상단 바. 데스크톱에서는 좌측 패널이 같은 역할(나가는 길)을 하므로 감춘다.
        */}
        <div className="flex h-13.5 flex-none items-center justify-between px-4 lg:hidden">
          <button
            type="button"
            onClick={goBack}
            className="text-muted hover:bg-line/50 grid h-9.5 w-9.5 cursor-pointer place-items-center rounded-chip bg-transparent text-[17px] transition-colors"
            aria-label="뒤로 가기"
          >
            ‹
          </button>
          <Link to="/" className="text-hint hover:text-fg p-2 text-[13.5px] font-medium">
            닫기
          </Link>
        </div>

        <div className="mx-auto flex w-full max-w-form flex-1 flex-col px-5.5 pb-7 lg:max-w-90 lg:justify-center lg:px-0 lg:py-10">
          {children}
        </div>

        {footer && (
          // mt-auto: 내용이 짧아 스크롤이 없을 때도 버튼이 화면 아래에 붙어 있게 한다.
          <div className="sticky bottom-0 mt-auto">
            {/* 위쪽으로 흐려지는 띠. 버튼 아래에 내용이 더 있다는 것이 이 그라데이션으로 읽힌다. */}
            <div className="from-bg/0 to-bg h-6 bg-linear-to-b" aria-hidden="true" />
            <div className="bg-bg px-5.5 pb-6">
              <div className="mx-auto w-full max-w-form lg:max-w-90">{footer}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
