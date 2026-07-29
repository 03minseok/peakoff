/**
 * 여행 조건. 1단계 화면에서 정하고 이후 모든 단계가 참조한다.
 *
 * 서버의 CourseDiagnosisRequest와 필드 이름을 맞췄다. 진단을 호출할 때
 * 슬롯 목록만 얹으면 그대로 보낼 수 있어, 중간 변환 코드가 필요 없다.
 */
export interface TripPlan {
  /** 지역 슬러그. 예: "gyeongju" */
  region: string
  /** yyyy-MM-dd */
  startDate: string
  /** 박 수 */
  nights: number
}

/**
 * 여행 흐름 전체가 공유하는 상태.
 *
 * 지금은 조건만 담지만, 다음 단계에서 코스 슬롯 목록이 여기에 붙는다.
 */
export interface TripState {
  plan: TripPlan | null
}
