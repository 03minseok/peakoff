import { useEffect, useState } from 'react'
import { CongestionBadge } from '../components/CongestionBadge'
import { defaultRegionSlug, regionNameOf } from '../constants/regions'
import { ApiRequestError, fetchPlaces, fetchQuotas } from '../services/api'
import type { QuotaSummary } from '../types/api'

/**
 * 개발용 확인 페이지. 서비스 흐름에 포함되지 않는다.
 *
 * 공통 컴포넌트가 실제로 어떻게 보이는지와 백엔드 연결이 살아 있는지를 한 화면에서 본다.
 * 화면 구현이 끝나면 이 파일과 라우트를 함께 지운다.
 */
export function PreviewPage() {
  const [connection, setConnection] = useState('확인 중…')
  /**
   * 오늘 공사 API 호출 수. 심사에서 "실제로 공사 API를 부르나요?"에 이 화면을 열어 답한다 —
   * 규칙 1(공사 OpenAPI 실호출)의 증거가 인증키 호출 이력이고, 그 이력을 숫자로 보여주는 자리다.
   * 못 받아오면 null이고 그 줄은 비운다. 한도는 서버가 가정한 값을 그대로 적는다(화면이 박지 않는다).
   */
  const [quota, setQuota] = useState<QuotaSummary | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    fetchQuotas(controller.signal)
      .then(setQuota)
      .catch(() => setQuota(null))
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    fetchPlaces(defaultRegionSlug(), { limit: 30, signal: controller.signal })
      .then((places) => setConnection(`연결됨 · ${regionNameOf(defaultRegionSlug())} ${places.length}곳`))
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
      {/*
        오늘 공사 API 호출 수 — 운영·심사용 계기판. API별로 늘 같은 순서로 서고,
        안 부른 것도 0으로 선다("안 불렀다"가 보여야 한다). 비율은 서버가 가정한 한도 기준.
      */}
      {quota && (
        <>
          <h2 className="text-muted mt-6 mb-2 text-[13px] font-semibold">
            오늘 공사 API 호출 · {quota.date}
          </h2>
          <p className="text-fg text-sm">
            전체 <span className="font-mono font-semibold">{quota.totalAllApis}</span>회
            <span className="text-hint"> · 가정 한도 {quota.assumedDailyLimit.toLocaleString()}회 기준</span>
          </p>
          <ul className="mt-2 flex flex-col gap-1 text-[13px]">
            {quota.apis.map((row) => (
              <li key={row.api} className="flex items-baseline justify-between gap-3">
                <span className="text-muted">{row.api}</span>
                <span className="font-mono">
                  {row.total}회
                  {row.failure > 0 && <span className="text-crowded-deep"> (실패 {row.failure})</span>}
                  <span className="text-hint"> · {row.percentOfAssumedLimit}%</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
