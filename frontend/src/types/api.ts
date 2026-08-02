/**
 * 백엔드 응답 타입.
 *
 * 서버의 DTO(`com.peakoff.*.dto`)와 짝을 이룬다. 서버 응답 모양이 바뀌면 이 파일도 함께 고친다.
 */

/** 서버 ErrorCode enum과 같은 값. 문구가 아니라 이 코드로 분기한다. */
export type ApiErrorCode = 'INVALID_REQUEST' | 'NOT_FOUND' | 'INTERNAL_ERROR'

/** 서버 CongestionLevel enum과 같은 값. */
export type CongestionLevel = 'CROWDED' | 'MODERATE' | 'QUIET'

/**
 * 모든 응답의 겉포장.
 *
 * 판별 유니온이라 `success`를 확인하면 그 뒤로 `data`나 `error` 중 하나만 타입에 남는다.
 * 둘 다 옵셔널인 단일 타입으로 두면 "성공인데 data가 없을 수도" 있는 상태가 표현 가능해진다.
 */
export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: { code: ApiErrorCode; message: string } }

/** 서버 PlaceResponse. imageUrl은 없는 관광지가 많아 null이 정상이다. */
export interface Place {
  id: string
  name: string
  latitude: number
  longitude: number
  categoryCode: string
  categoryName: string
  imageUrl: string | null
}

/**
 * 추천도를 이룬 항목 하나. 서버 ScoreFactor와 짝을 이룬다.
 *
 * weightPercent가 서버에서 오는 이유: 가중치는 서버에만 있어야 한다.
 * 화면에 "70%"라고 적어두면 분석 결과로 비율이 바뀔 때 한쪽만 고쳐져 두 값이 어긋난다.
 */
export interface ScoreFactor {
  label: string
  score: number
  weightPercent: number
  detail: string
}

/**
 * 서버 AlternativeResponse. reason과 factors는 화면에 반드시 함께 표시한다.
 *
 * recommendation(추천도)에는 <b>한적도가 이미 반영돼 있다.</b> 목록은 이 값 기준으로
 * 정렬돼 온다. quietness를 따로 내려주는 것은 판단의 원본 수치를 보여주기 위해서다.
 */
export interface Alternative {
  place: Place
  quietness: number
  recommendation: number
  level: CongestionLevel
  levelLabel: string
  factors: ScoreFactor[]
  reason: string
}

/** 진단 요청의 슬롯. 한적도가 없는 것이 핵심 — 점수는 서버가 매겨서 돌려준다. */
export interface CourseSlotRequest {
  day: number
  order: number
  placeId: string
}

export interface CourseDiagnosisRequest {
  /** 지역 슬러그. 예: "gyeongju" */
  region: string
  /** yyyy-MM-dd */
  startDate: string
  /** 박 수. 당일치기는 0 */
  nights: number
  slots: CourseSlotRequest[]
}

export interface DiagnosedSlot {
  day: number
  order: number
  /** 그 슬롯을 실제로 방문하는 날짜. 2일차면 시작일 다음 날 */
  visitDate: string
  place: Place
  quietness: number
  level: CongestionLevel
  levelLabel: string
}

export interface CourseDiagnosis {
  region: string
  regionName: string
  startDate: string
  endDate: string
  nights: number
  days: number
  totalQuietness: number
  totalLevel: CongestionLevel
  totalLevelLabel: string
  slots: DiagnosedSlot[]
}

export interface DateOption {
  date: string
  quietness: number
  level: CongestionLevel
  levelLabel: string
  /** 선택 날짜 대비 한적도 증가폭. 클수록 덜 붐빈다 */
  improvement: number
}

export interface DateAlternatives {
  selectedDate: string
  selectedQuietness: number
  selectedLevel: CongestionLevel
  selectedLevelLabel: string
  /** 선택한 날짜보다 나은 날이 없으면 true. 이때 options는 빈 배열 */
  alreadyQuietest: boolean
  options: DateOption[]
}
