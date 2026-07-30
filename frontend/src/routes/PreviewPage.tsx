import { useEffect, useState } from 'react'
import { CongestionBadge } from '../components/CongestionBadge'
import { ApiRequestError, fetchPlaces } from '../services/api'

/**
 * 개발용 확인 페이지. 서비스 흐름에 포함되지 않는다.
 *
 * 공통 컴포넌트가 실제로 어떻게 보이는지와 백엔드 연결이 살아 있는지를 한 화면에서 본다.
 * 화면 구현이 끝나면 이 파일과 라우트를 함께 지운다.
 */
export function PreviewPage() {
  const [connection, setConnection] = useState('확인 중…')

  useEffect(() => {
    const controller = new AbortController()

    fetchPlaces('gyeongju', controller.signal)
      .then((places) => setConnection(`연결됨 · 경주 ${places.length}곳`))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
        setConnection(
          error instanceof ApiRequestError ? `실패 · ${error.message}` : '실패 · 알 수 없는 오류',
        )
      })

    return () => controller.abort()
  }, [])

  return (
    <section>
      <h1 className="text-fg text-xl font-semibold">공통 컴포넌트 확인</h1>

      <h2 className="text-muted mt-6 mb-2 text-[13px] font-semibold">한적도 배지</h2>
      <div className="flex flex-wrap items-center gap-2">
        <CongestionBadge level="QUIET" quietness={82} />
        <CongestionBadge level="MODERATE" quietness={54} />
        <CongestionBadge level="CROWDED" quietness={12} />
      </div>

      <h2 className="text-muted mt-6 mb-2 text-[13px] font-semibold">점수 없이</h2>
      <div className="flex flex-wrap items-center gap-2">
        <CongestionBadge level="QUIET" />
        <CongestionBadge level="MODERATE" size="sm" />
        <CongestionBadge level="CROWDED" size="sm" label="매우 붐빔" />
      </div>

      <h2 className="text-muted mt-6 mb-2 text-[13px] font-semibold">백엔드 연결</h2>
      <p className="text-sm">{connection}</p>
    </section>
  )
}
