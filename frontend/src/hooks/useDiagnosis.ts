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
  /** 첫 진단. 보여줄 이전 결과가 아직 없다 */
  | { phase: 'loading' }
  /**
   * 다시 진단 중인데 <b>이전 결과를 들고 있다.</b>
   *
   * <p>이 상태가 없으면 장소를 교체할 때마다 화면이 통째로 사라진다.
   * 이 앱의 핵심 루프가 "붐비는 곳 → 교체 → 총점이 오르는 걸 확인"인데,
   * 교체하는 순간 비교 대상이던 총점이 눈앞에서 없어지면 확인할 것이 남지 않는다.
   * 스크롤도 맨 위로 튀고, 지도는 새 인스턴스로 다시 그려진다.
   */
  | { phase: 'refreshing'; diagnosis: CourseDiagnosis }
  | { phase: 'loaded'; diagnosis: CourseDiagnosis }
  | { phase: 'error'; message: string }

/**
 * 지금 화면에 그릴 수 있는 진단 결과. 없으면 null.
 *
 * <p>{@code loaded}와 {@code refreshing}을 같게 다룬다 — 다시 계산하는 동안에도
 * 직전 결과는 여전히 유효한 화면이다.
 */
export function currentDiagnosis(state: DiagnosisState): CourseDiagnosis | null {
  return state.phase === 'loaded' || state.phase === 'refreshing' ? state.diagnosis : null
}

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
    /*
     * 이미 결과가 있으면 그것을 든 채 refreshing으로 넘어간다.
     * 여기서 loading으로 덮으면 화면이 비므로, 첫 진단일 때만 loading이다.
     */
    setState((previous) =>
      previous.phase === 'loaded' || previous.phase === 'refreshing'
        ? { phase: 'refreshing', diagnosis: previous.diagnosis }
        : { phase: 'loading' },
    )

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
