import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { setRegions } from '../constants/regions'
import { fetchRegions } from '../services/api'

/**
 * 지원 지역 목록을 받아 오고, 받은 뒤에 화면을 그린다.
 *
 * <h3>왜 기다리게 하는가</h3>
 * 지역은 <b>거의 모든 화면이 첫 줄부터 쓰는 값</b>이다. 홈은 "오늘의 경주"라고 적고,
 * 코스 짜기는 기본 지역을 골라 두고, 진단·결과는 제목에 지역명을 넣는다.
 * 목록 없이 그리면 그 자리들이 잠깐 빈 문자열로 섰다가 채워진다 —
 * 화면이 흔들리고, 무엇보다 여덟 곳에 로딩 상태를 하나씩 만들어야 한다.
 *
 * <p>기다리는 대가는 작다. 이 요청은 <b>공사를 부르지 않는다</b> — 우리가 정한 목록이라
 * 서버 메모리에서 바로 나온다.
 *
 * <h3>실패하면 목록을 지어내지 않는다</h3>
 * 예비 목록을 코드에 박아 두고 싶은 유혹이 있지만, 그러면 <b>이 파일이 다시 서버 enum의
 * 사본</b>이 된다 — 목록을 서버로 옮긴 이유가 사라진다. 게다가 이 요청이 실패했다면
 * 서버가 없다는 뜻이라 어차피 검색도 진단도 안 된다.
 * 지어낸 지역을 눌러 "지원하지 않는 지역입니다"를 만나는 것보다, 여기서 멈추고
 * 다시 시도할 길을 주는 편이 정직하다.
 */
export function RegionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  /* 다시 시도 버튼이 effect를 한 번 더 돌게 하는 값. 값 자체는 쓰지 않는다. */
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setState('loading')
    fetchRegions(controller.signal)
      .then((loaded) => {
        if (controller.signal.aborted) {
          return
        }
        /*
         * 빈 목록도 실패로 본다. 서버는 살아 있는데 지역이 없는 상태라,
         * 그대로 통과시키면 아무것도 못 하는 화면이 아무 설명 없이 뜬다.
         */
        if (loaded.length === 0) {
          setState('error')
          return
        }
        // 그리기 전에 채운다. 그리고 나서 채우면 이미 그려진 화면이 빈 이름을 든다.
        setRegions(loaded)
        setState('ready')
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setState('error')
        }
      })
    return () => controller.abort()
  }, [attempt])

  if (state === 'ready') {
    return children
  }

  return (
    <div className="text-hint flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      {state === 'loading' ? (
        /*
         * 글자를 두지 않는다. 대개 눈에 띄기 전에 끝나는 요청이라
         * "불러오는 중"이 깜빡였다 사라지는 편이 더 산만하다.
         */
        <div
          className="border-line border-t-brand h-7 w-7 animate-spin rounded-full border-2"
          role="status"
          aria-label="여행 지역을 불러오는 중"
        />
      ) : (
        <>
          <p className="text-fg text-[15px] font-semibold">여행 지역을 불러오지 못했어요</p>
          <p className="text-[13.5px] leading-relaxed">
            잠시 뒤 다시 시도해 주세요.
            <br />
            네트워크가 끊겼거나 서버가 잠깐 쉬는 중일 수 있어요.
          </p>
          <button
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
            className="border-line text-fg hover:bg-fill rounded-full border px-4 py-2 text-[13.5px] font-semibold"
          >
            다시 시도
          </button>
        </>
      )}
    </div>
  )
}
