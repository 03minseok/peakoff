/**
 * 백엔드 응답 타입.
 *
 * 서버의 DTO(`com.peakoff.*.dto`)와 짝을 이룬다. 서버 응답 모양이 바뀌면 이 파일도 함께 고친다.
 */

/** 서버 ErrorCode enum과 같은 값. 문구가 아니라 이 코드로 분기한다. */
export type ApiErrorCode =
  | 'INVALID_REQUEST'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR'
  /** 로그인이 필요하거나 토큰이 만료됐다. 비밀번호가 틀린 경우도 여기다 */
  | 'UNAUTHORIZED'
  /** 이미 가입된 이메일 */
  | 'CONFLICT'

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

/** POST /api/courses 요청. 총점은 진단에서 받은 값을 그대로 싣는다 */
export interface SaveCourseRequest {
  name: string
  region: string
  startDate: string
  nights: number
  totalQuietness: number
  slots: CourseSlotRequest[]
}

/**
 * 서버 SavedCourseSummary. 마이페이지 목록 한 줄.
 *
 * 장소 목록이 없고 개수(placeCount)만 온다. 카드에 필요한 것이 그것뿐이라
 * 코스 10개의 장소를 전부 실어 보내면 응답만 커진다.
 */
export interface SavedCourseSummary {
  id: number
  name: string
  region: string
  regionName: string
  startDate: string
  endDate: string
  nights: number
  days: number
  totalQuietness: number
  level: CongestionLevel
  levelLabel: string
  placeCount: number
  /** 그 점수를 매긴 시각 (ISO). 저장 시점의 판단이라는 것을 화면에서 밝힐 수 있다 */
  scoredAt: string
  createdAt: string
}

/**
 * 저장된 장소 한 줄.
 *
 * placeName은 저장 시점의 이름이다. 서버가 매번 장소 API에 다시 묻지 않으므로
 * 바깥에서 그 id의 내용이 바뀌어도 저장된 코스는 흔들리지 않는다.
 * placeId는 표시에 쓰지 않는다 — "이어서 보기"로 코스를 흐름에 올릴 때 필요하다.
 */
export interface SavedPlace {
  day: number
  order: number
  placeId: string
  placeName: string
}

/** 서버 SavedCourseDetail. 요약에 장소들이 붙은 모양 */
export interface SavedCourseDetail extends Omit<SavedCourseSummary, 'placeCount'> {
  places: SavedPlace[]
}

/** 서버 MemberResponse. 비밀번호 관련 값은 어떤 형태로도 내려오지 않는다. */
export interface AuthMember {
  id: number
  email: string
  nickname: string
  /** ISO-8601 시각 */
  createdAt: string
  termsAgreedAt: string
}

/** 서버 AuthResponse. 가입과 로그인이 같은 모양을 돌려준다. */
export interface AuthResult {
  token: string
  /** 토큰 유효 기간(초). 만료 시각을 계산해 미리 로그아웃 처리하는 데 쓴다 */
  expiresInSeconds: number
  member: AuthMember
}

export interface SignupRequest {
  email: string
  password: string
  passwordConfirm: string
  nickname: string
  termsAgreed: boolean
}

export interface LoginRequest {
  email: string
  password: string
}

/**
 * 닉네임 변경. 비밀번호를 묻지 않는다 — 언제든 되돌릴 수 있는 변경이다.
 *
 * 응답은 AuthResult다. 토큰 안에 닉네임이 들어 있어 새로 발급받아야 하고,
 * 받은 토큰으로 갈아끼우지 않으면 새로고침할 때 옛 닉네임이 되살아난다.
 */
export interface ChangeNicknameRequest {
  nickname: string
}

/**
 * 비밀번호 변경. 현재 비밀번호를 함께 보낸다.
 *
 * 토큰은 "이 브라우저가 언젠가 로그인했다"는 증거일 뿐이라, 되돌릴 수 없는 일 앞에서는
 * 지금 앉아 있는 사람이 본인인지 한 번 더 확인한다.
 */
export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
  newPasswordConfirm: string
}

/** 회원 탈퇴. 계정과 저장한 코스가 함께 사라진다 */
export interface DeleteAccountRequest {
  password: string
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
