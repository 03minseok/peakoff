import { useState } from 'react'
import { fetchPlaceDescription } from '../services/api'

/**
 * 장소 소개를 <b>펼칠 때만</b> 불러 보여주는 줄.
 *
 * <h3>왜 미리 받아두지 않는가</h3>
 * 소개글은 지역 카탈로그(목록 API)에 없고 상세 조회에만 있어서 <b>장소마다 공사를 한 번씩</b>
 * 부른다. 코스 목록을 그릴 때 미리 받으면 담긴 곳 수만큼 호출이 나가는데, 그 모양이
 * 2026-08-26 한도 소진 사고였다(하루치를 39분에 태웠다).
 *
 * <p>서버가 6시간 캐시로 받쳐 두지만 캐시가 빈 첫 조회는 그대로 나가므로,
 * <b>사용자가 읽겠다고 누른 것만</b> 부른다. 한 번 받으면 이 컴포넌트가 들고 있어
 * 접었다 펴도 다시 부르지 않는다.
 *
 * <h3>⚠️ 소개글에 HTML 조각이 섞여 온다</h3>
 * 공사가 {@code <br>}을 넣어 준다. <b>innerHTML로 넣지 않는다</b> — 우리가 만든 문자열이
 * 아니라서다. 줄바꿈만 살리고 나머지 태그는 걷어낸 뒤 글자로 그린다.
 */
interface Props {
  placeId: string
  /** 여는 버튼에 붙일 이름. "OO 설명 보기"로 읽힌다 */
  placeName: string
}

type State =
  | { phase: 'closed' }
  | { phase: 'loading' }
  | { phase: 'loaded'; address: string | null; overview: string | null }
  | { phase: 'error' }

/**
 * 공사가 준 소개글을 화면에 쓸 수 있는 글자로 옮긴다.
 *
 * <p>{@code <br>}만 줄바꿈으로 살리고 나머지 태그는 지운다. 태그를 그대로 두면 글 안에
 * "&lt;br&gt;"이 보이고, 그렇다고 innerHTML로 넣으면 남이 준 문자열을 그대로 실행하는 셈이다.
 *
 * <p>연달아 나오는 빈 줄은 하나로 줄인다 — 원문에 {@code <br><br><br>}이 흔하다.
 */
function toPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function PlaceDescription({ placeId, placeName }: Props) {
  const [state, setState] = useState<State>({ phase: 'closed' })

  async function open() {
    // 이미 받아 뒀으면 다시 부르지 않는다. 접었다 펴는 것은 요청이 아니다.
    if (state.phase === 'loaded') {
      return
    }
    setState({ phase: 'loading' })
    try {
      const description = await fetchPlaceDescription(placeId)
      setState({ phase: 'loaded', ...description })
    } catch {
      setState({ phase: 'error' })
    }
  }

  const open_ = state.phase !== 'closed'

  return (
    <div className="mt-2">
      {/*
        여는 버튼과 접는 버튼이 같은 자리에 선다. 열려 있을 때 "접기"로 글자만 바뀐다 —
        버튼이 두 개면 열고 나서 여는 버튼이 어디로 갔는지 눈이 찾는다.
      */}
      <button
        type="button"
        className="text-brand-deep hover:text-brand -mx-1 cursor-pointer rounded-chip bg-transparent px-1 py-0.5 text-[12.5px] font-semibold"
        aria-expanded={open_}
        onClick={() => (open_ ? setState({ phase: 'closed' }) : void open())}
      >
        {open_ ? '접기' : '설명 보기'}
      </button>

      {state.phase === 'loading' && (
        <p className="text-hint m-0 mt-1.5 text-[12.5px]">불러오는 중…</p>
      )}

      {state.phase === 'error' && (
        <p className="text-hint m-0 mt-1.5 text-[12.5px]">
          설명을 불러오지 못했어요.
        </p>
      )}

      {state.phase === 'loaded' && (
        <div className="bg-bg rounded-ui mt-1.5 flex flex-col gap-1.5 px-3.5 py-3">
          {state.address && (
            <p className="text-hint m-0 text-[12px]">{state.address}</p>
          )}

          {/*
            whitespace-pre-line으로 원문의 줄바꿈을 살린다. 공사 소개글은 문단이 나뉘어 있고,
            그것을 뭉개면 500자가 한 덩어리가 되어 읽히지 않는다.
          */}
          {state.overview ? (
            <p className="m-0 text-[12.5px] leading-[1.7] whitespace-pre-line text-pretty">
              {toPlainText(state.overview)}
            </p>
          ) : (
            /*
              주소는 있는데 소개글이 없을 수 있다. 그때 아무 말도 안 하면 펼친 사람이
              "덜 불러왔나" 하고 다시 누른다 — 없다는 것도 답이다.
            */
            <p className="text-hint m-0 text-[12.5px]">
              아직 소개글이 없는 곳이에요.
            </p>
          )}
        </div>
      )}

      {/* 스크린리더가 버튼만으로 무엇이 열리는지 알 수 있게 이름을 붙여 둔다 */}
      <span className="sr-only">{placeName} 설명</span>
    </div>
  )
}
