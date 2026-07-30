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
 * 원안 — 사용자가 직접 짜서 진단에 들고 온 코스.
 *
 * <b>날짜(plan)와 장소(days)를 함께 담는 것이 핵심이다.</b>
 * 장소만 저장하면, 사용자가 더 한적한 날짜로 옮겼을 때 원안까지 새 날짜로 다시 계산된다.
 * 그러면 "날짜를 바꿔서 얼마나 나아졌는지"가 통째로 사라진다.
 *
 * 이렇게 두면 최종 비교가 두 가지 회피 경로를 한 번에 보여준다:
 * 원안(9/12·원래 장소) → 개선안(9/14·교체한 장소).
 */
export interface TripBaseline {
  plan: TripPlan
  days: string[][]
}

/**
 * 여행 흐름 전체가 공유하는 상태.
 *
 * days는 <b>일차별 장소 ID 배열</b>이다. days[0]이 1일차이고, 배열 순서가 곧 방문 순서다.
 *
 * order를 숫자 필드로 따로 들지 않은 이유: 순서를 바꿀 때마다 모든 항목의 order를
 * 다시 매겨야 하고, 그러다 한 번이라도 어긋나면 중복되거나 빈 번호가 생긴다.
 * 배열 위치를 순서로 쓰면 자리를 바꾸는 것만으로 끝난다.
 *
 * 장소 정보 전체가 아니라 ID만 담는 이유: 이름·좌표는 서버가 가진 값이고,
 * 화면을 열 때마다 새로 받는다. 여기에 복사해두면 두 벌이 되어 언젠가 어긋난다.
 */
export interface TripState {
  plan: TripPlan | null
  days: string[][]
  baseline: TripBaseline | null
}
