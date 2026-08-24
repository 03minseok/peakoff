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

/**
 * 한적도를 매기지 못한 이유. 서버가 정한 값을 그대로 받는다.
 *
 * 둘을 갈라 받는 이유: 하나는 기다리면 생기고 하나는 생기지 않는다.
 * 같은 문구로 뭉개면 사용자가 "데이터가 부실하다"로 읽는다.
 */
export type DiagnosisGap =
  /** <b>관광지인데</b> 예측 목록에 없다. 공사가 관광지의 일부만 예측한다 */
  | 'PLACE_NOT_FORECASTED'
  /** 애초에 예측 대상 분류가 아니다 (음식점·숙박·쇼핑). gapMessage가 null로 온다 */
  | 'CATEGORY_NOT_FORECASTED'
  /** 장소는 예측 대상인데 그 날짜가 예측 범위 밖. 여행일이 다가오면 생긴다 */
  | 'DATE_OUT_OF_FORECAST'

export interface DiagnosedSlot {
  day: number
  order: number
  /** 그 슬롯을 실제로 방문하는 날짜. 2일차면 시작일 다음 날 */
  visitDate: string
  place: Place
  /** 진단하지 못한 칸은 null. 0으로 오지 않는다 — 0은 화면에서 "매우 붐빔"이다 */
  quietness: number | null
  level: CongestionLevel | null
  levelLabel: string | null
  /** 진단됐으면 null */
  gap: DiagnosisGap | null
  /**
   * 화면에 그대로 띄우는 문장. 진단됐으면 null이고, <b>할 말이 없어도 null이다.</b>
   *
   * 음식점·숙박처럼 애초에 예측 대상이 아닌 곳은 gap은 있는데 문구가 없다.
   * 그래서 화면은 gap이 아니라 <b>이 값이 있는지</b>를 보고 안내를 그린다 —
   * 나중에 공사가 음식점을 예측하기 시작해도 화면을 고치지 않는다.
   */
  gapMessage: string | null
}

export interface CourseDiagnosis {
  region: string
  regionName: string
  startDate: string
  endDate: string
  nights: number
  days: number
  /**
   * 진단된 칸만의 평균. <b>진단된 칸이 하나도 없으면 null이다</b> — 음식점만 담은 코스가 그렇다.
   *
   * 그때는 등급과 라벨도 함께 null이다. 없는 점수에 등급을 붙이면 "붐빔"이 되어,
   * 밥집만 담았다는 이유로 최악의 코스라고 말하게 된다.
   */
  totalQuietness: number | null
  totalLevel: CongestionLevel | null
  totalLevelLabel: string | null
  /** 실제로 점수가 매겨진 칸 수. 화면이 "3곳 중 0곳 기준"이라 말할 수 있게 한다 */
  diagnosedCount: number
  slots: DiagnosedSlot[]
}

/*
 * 설문 기반 코스 추천 (POST /api/courses/recommend).
 *
 * 아래 네 타입은 서버의 설문 enum과 같은 값이다. <b>각 답이 무슨 숫자를 뜻하는지는
 * 여기 없다.</b> 밀도가 몇 곳인지, 민감도가 한적도를 몇 퍼센트 반영하는지는 전부 서버에 있다.
 * 화면은 이름만 보내고 값은 모른다 — 분석 결과로 값이 바뀔 때 화면을 고치지 않기 위해서다.
 * 한적도 임계값이나 추천도 반영 비율을 서버에 둔 것과 같은 이유다.
 */

/**
 * 설문 1번 — 여행 스타일. <b>복수 선택</b>이라 배열로 보낸다.
 *
 * 공사 집중률이 예측하는 분류만 둔다. 경주 65곳의 분류가 역사·자연·문화명소뿐이라,
 * 맛집·체험·레저를 고르면 후보가 하나도 남지 않아 추천이 실패했다.
 * 밥집은 코스 편집에서 직접 담는다 — 담는 것은 막지 않고 진단에서만 빠진다.
 */
export type TravelStyle = 'HISTORY' | 'NATURE'

/** 설문 2번 — 일정 밀도. 일자별로 몇 곳을 담을지 */
export type ItineraryDensity = 'RELAXED' | 'BALANCED' | 'PACKED'

/** 설문 3번 — 혼잡 민감도. 서비스 정체성이 걸린 문항이다 */
export type CrowdSensitivity = 'POPULAR' | 'MIXED' | 'QUIET'

/** 설문 4번 — 이동수단. 후보 반경과 슬롯 간 이동거리를 정한다 */
export type Transport = 'CAR' | 'TRANSIT'

export interface CourseRecommendRequest {
  /** 지역 슬러그. 예: "gyeongju" */
  region: string
  /** yyyy-MM-dd */
  startDate: string
  /** 박 수. 당일치기는 0 */
  nights: number
  styles: TravelStyle[]
  density: ItineraryDensity
  sensitivity: CrowdSensitivity
  transport: Transport
}

/**
 * 초안의 슬롯. 진단 슬롯에 <b>왜 골랐는지</b>가 붙은 모양이다.
 *
 * {@link DiagnosedSlot}을 확장한 것이 우연이 아니다. 서버가 두 응답의 슬롯 모양을 맞춰
 * 내려주므로, 진단 화면의 타임라인 컴포넌트를 그대로 재사용할 수 있다.
 *
 * factors는 <b>개수가 고정이 아니다.</b> 각 일자의 첫 장소는 비교 대상이 없어 한적도 하나만
 * 오고, 연관 관광지 데이터가 붙으면 항목이 하나 는다. 항목 이름을 화면에 박지 말고
 * 배열을 그대로 반복해 그려야 한다.
 *
 * 점수는 <b>반드시 있다.</b> 초안은 애초에 한적도가 있는 후보 중에서만 고르기 때문에
 * 진단 불가 칸이 생길 수 없다 — 화면마다 있지도 않은 경우를 방어하지 않게 타입에서 좁혀 둔다.
 */
export interface DraftSlot extends DiagnosedSlot {
  quietness: number
  level: CongestionLevel
  levelLabel: string
  /** 이 자리에 이곳을 얼마나 미는가 (0~100). 한적도가 이미 반영돼 있다 */
  recommendation: number
  factors: ScoreFactor[]
  reason: string
}

/**
 * 설문으로 만든 코스 초안.
 *
 * <b>같은 답을 다시 보내면 다른 코스가 온다.</b> 서버가 상위 후보군에서 가중 무작위로
 * 뽑기 때문이다 — 모든 사용자에게 같은 곳을 추천하면 그곳이 새로운 혼잡지가 된다.
 */
export interface CourseDraft extends Omit<CourseDiagnosis, 'slots'> {
  /*
   * 총점이 <b>반드시 있다.</b> 초안은 한적도가 있는 후보 중에서만 고르므로
   * 진단 불가 칸이 생길 수 없다. 진단 결과와 달리 null을 방어하지 않게 좁혀 둔다.
   */
  totalQuietness: number
  totalLevel: CongestionLevel
  totalLevelLabel: string
  slots: DraftSlot[]
}

/**
 * 근처의 같은 분류 장소. <b>추천이 아니다.</b>
 *
 * 한적도를 모르는 장소(음식점·숙박)에는 추천도를 매길 수 없다 —
 * 추천도는 한적도를 가장 큰 비중으로 품는 값이기 때문이다.
 * 그래서 {@link Alternative}와 <b>일부러 다르게 생겼다.</b> 점수도 근거 문구도 없고
 * 거리만 있다. 같은 모양으로 맞춰 점수를 null로 채우면 화면이 "아직 안 온 값"으로 읽는다.
 */
export interface NearbyPlace {
  place: Place
  /** 직선 거리(km). 도로 거리가 아니다 */
  distanceKm: number
}

export interface DateOption {
  date: string
  /** 자료가 없는 날은 null */
  quietness: number | null
  level: CongestionLevel | null
  levelLabel: string | null
  /** 선택 날짜 대비 한적도 증가폭. 클수록 덜 붐빈다. 자료가 없으면 null */
  improvement: number | null
  /** 실제로 고를 수 있는 날인지. 지난 날짜와 자료 없는 날은 false */
  selectable: boolean
  gap: DiagnosisGap | null
  gapMessage: string | null
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
 * placeId는 표시에 쓰지 않는다 — "다시 진단하기"로 코스를 흐름에 올릴 때 필요하다.
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

/** 지금 붙어 있는 소셜 로그인. 주소(/oauth/callback/kakao)와 API 경로에 그대로 쓰인다 */
export type SocialProvider = 'kakao' | 'naver'

/**
 * 소셜 로그인 결과. 끝이 둘이다.
 *
 * `status`로 갈라 읽는다. `auth`의 유무로 추측하지 않는 이유는 서버 쪽 주석과 같다 —
 * 상태가 하나 늘 때 화면의 판단 기준이 조용히 어긋난다.
 */
export type SocialLoginResult =
  | { status: 'LOGGED_IN'; auth: AuthResult; link: null }
  | { status: 'LINK_REQUIRED'; auth: null; link: SocialLinkCandidate }

/**
 * 같은 이메일로 가입한 계정이 이미 있을 때 받는 정보.
 *
 * 이 단계에서는 <b>아직 로그인이 아니다.</b> 비밀번호를 확인해야 연결되고, 그때 로그인된다.
 */
export interface SocialLinkCandidate {
  /** 기존 계정의 이메일. 어느 계정과 잇는지 화면에 보여준다 */
  email: string
  /** "카카오"처럼 사람이 읽는 이름. 문구에 그대로 쓴다 */
  provider: string
  /** 비밀번호와 함께 돌려보낼 5분짜리 티켓. 이것만으로는 로그인되지 않는다 */
  linkTicket: string
}

export interface SocialLinkRequest {
  linkTicket: string
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

/**
 * 날짜를 옮기라고 권할지에 대한 서버의 판단. 위에서부터 먼저 들어맞는 것이 온다.
 *
 * 화면이 직접 판단하지 않는다 — 임계값이 서버에 있어야 분석 결과로 바뀔 때 한 곳만 고쳐진다.
 */
export type TimeOffStatus =
  /** 계산할 자료가 없다. 예측 범위 밖이거나 코스에 예측 대상 장소가 없다 */
  | 'INSUFFICIENT_DATA'
  /** 지금 일정이 이미 한적하다. 옮길 이유가 없다 */
  | 'ALREADY_QUIET'
  /** 앞뒤를 다 봐도 지금이 가장 낫다 */
  | 'CURRENT_BEST'
  /** 더 나은 날이 있지만 차이가 작다 */
  | 'MARGINAL'
  /** 옮길 만하다. 화면이 개선폭을 강조해도 되는 유일한 상태 */
  | 'RECOMMENDED'

export interface DateAlternatives {
  status: TimeOffStatus
  /** 그 판단을 사람이 읽는 문장. 화면이 그대로 띄운다 */
  statusMessage: string
  selectedDate: string
  /** 계산할 수 없으면 null */
  selectedQuietness: number | null
  selectedLevel: CongestionLevel | null
  selectedLevelLabel: string | null
  /** 가장 나은 후보. 없으면 null. 지난 날짜는 후보에서 빠진다 */
  bestDate: string | null
  bestImprovement: number | null
  /** 옮기라고 권하는 최소 개선폭. 화면에 숫자를 박지 않으려고 서버가 내려보낸다 */
  minImprovement: number
  options: DateOption[]
}
