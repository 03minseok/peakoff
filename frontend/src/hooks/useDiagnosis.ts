import { useEffect, useMemo, useState } from 'react'
import { ApiRequestError, diagnoseCourse } from '../services/api'
import type { CourseDiagnosis, CourseSlotRequest } from '../types/api'
import type { TripPlan } from '../state/tripTypes'

/** days[일차][순서] 구조를 서버가 받는 평평한 슬롯 목록으로 편다. */
export function toSlots(days: string[][]): CourseSlotRequest[] {
  return days.flatMap((placeIds, dayIndex) =>
    placeIds.map((placeId, orderIndex) => ({
      day: dayIndex + 1,
      order: orderIndex + 1,
      placeId,
    })),
  )
}

export type DiagnosisState =
  /** 진단할 코스가 없다 (조건 미입력, 원안 미확정 등) */
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'loaded'; diagnosis: CourseDiagnosis }
  | { phase: 'error'; message: string }

/**
 * 코스 하나를 진단한다.
 *
 * 훅으로 뺀 이유: 최종 비교 화면이 <b>원안과 개선안을 각각</b> 진단해야 한다.
 * 같은 호출 로직을 두 벌 쓰면 한쪽만 고치는 사고가 난다.
 *
 * days가 바뀌면 자동으로 다시 진단한다. 대안을 교체했을 때 별도 버튼 없이
 * 결과가 갱신되는 것이 이 덕분이다.
 */
export function useDiagnosis(plan: TripPlan | null, days: string[][] | null): DiagnosisState {
  const [state, setState] = useState<DiagnosisState>({ phase: 'idle' })

  const slots = useMemo(() => (days ? toSlots(days) : []), [days])

  useEffect(() => {
    if (!plan || slots.length === 0) {
      setState({ phase: 'idle' })
      return
    }

    const controller = new AbortController()
    setState({ phase: 'loading' })

    diagnoseCourse(
      { region: plan.region, startDate: plan.startDate, nights: plan.nights, slots },
      controller.signal,
    )
      .then((diagnosis) => setState({ phase: 'loaded', diagnosis }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
        setState({
          phase: 'error',
          message: error instanceof ApiRequestError ? error.message : '진단하지 못했습니다.',
        })
      })

    return () => controller.abort()
  }, [plan, slots])

  return state
}
