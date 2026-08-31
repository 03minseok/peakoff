/**
 * 서비스가 지원하는 지역 하나. `GET /api/regions`가 준다.
 *
 * <b>화면이 목록을 들고 있지 않다.</b> 예전에는 constants/regions.ts가 서버 enum을
 * 복사하고 있어서, 한쪽만 고치면 화면에는 보이는데 서버가 거절했다.
 *
 * 법정동 코드는 오지 않는다 — 화면이 코드 체계에 묶이면 공사가 코드를 개편할 때
 * 양쪽을 다 고쳐야 한다. 실제로 광주·전남이 통합되며 코드가 바뀌었다.
 */
export interface RegionOption {
  /** 요청에 쓰는 값. `?region=yeosu` */
  slug: string
  /** 화면에 쓰는 짧은 이름. "여수" */
  name: string
  /** 시도 이름. "전라남도" — 목록에서 같은 이름을 가릴 보조 설명으로도 쓴다 */
  province: string
  /**
   * 무엇을 치면 이 지역이 나오는가. <b>서버가 미리 이어 준다.</b>
   * 화면이 조립하면 "무엇으로 검색되는가"가 화면 규칙이 되어,
   * 나중에 별칭을 붙일 때 서버와 화면을 함께 고쳐야 한다.
   */
  searchText: string
}

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
  /**
   * 공공데이터에 닿지 못했다. <b>우리 잘못이 아니라 남의 사정이라 기다리면 낫는다.</b>
   *
   * INTERNAL_ERROR와 갈라 받는 이유: 500은 "서버가 깨졌다"이고 이것은 "지금은 안 되지만
   * 곧 된다"이다. 화면이 같은 말로 뭉개면 사용자가 다시 시도할 이유를 알 수 없다.
   */
  | 'EXTERNAL_UNAVAILABLE'

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
 * 홈의 "이번 주 한적한 곳" 한 줄. 서버 QuietSpotResponse와 짝을 이룬다.
 *
 * <p><b>장소와 날짜가 한 몸이다.</b> 같은 곳이라도 날짜마다 값이 달라서, 날짜 없이는
 * "한적하다"를 말할 수 없다. {@code date}는 앞으로 7일 중 <b>가장 한적한 하루</b>다.
 *
 * <p>지역이 슬러그와 이름 둘 다 오는 이유: 이름은 카드에 적을 것이고, 슬러그는
 * "이 장소로 여행가기"가 여행 조건 화면에 넘길 값이다. 이름으로 슬러그를 되찾게 두면
 * 표기가 바뀌는 순간 그 길이 끊긴다.
 */
export interface QuietSpot {
  place: Place
  region: string
  regionName: string
  date: string
  quietness: number
  level: CongestionLevel
  levelLabel: string
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

/**
 * 왜 이런 대안 목록이 나왔는가. 서버 PlaceOffStatus.
 *
 * <b>빈 목록이 비는 이유가 여럿이라 필요해졌다.</b> 원래 자리가 이미 한적해서 비는 것과
 * 대신할 곳을 못 찾아서 비는 것은 사용자에게 정반대의 소식인데, 같은 빈 화면으로 뭉개면
 * 둘 다 "이 서비스는 데이터가 부실하다"로 읽힌다.
 */
export type PlaceOffStatus =
  | 'RECOMMENDED'
  | 'ALREADY_QUIET'
  /** 더 한적한 곳을 찾긴 했는데 전부 이미 그 날 코스에 담겨 있다 */
  | 'ALL_CANDIDATES_IN_COURSE'
  | 'NO_MEANINGFUL_IMPROVEMENT'
  | 'NO_VALID_CANDIDATE'
  | 'ORIGIN_NOT_FORECASTED'

/**
 * 서버 AlternativesResponse. 후보 목록과 <b>그 목록이 나온 이유</b>가 한 덩어리다.
 *
 * 서버는 원래 장소보다 `minQuietnessGain`점 이상 한적한 곳만 담는다. 하한이 없으면
 * 더 붐비는 곳도 대안으로 나가, 붐빔을 피하라는 서비스가 더 붐비는 곳을 권하게 된다.
 *
 * ⚠️ `minQuietnessGain`을 화면에 숫자로 박아두지 말 것. 분석 결과로 기준이 바뀌면
 * 설명과 실제가 어긋난다 — 날짜 대안의 `minImprovement`와 같은 이유다.
 */
/**
 * 후보를 어디서 가져왔는가. 서버 CandidateSource.
 *
 * ⚠️ 이 값을 화면에 그대로 쓰지 말 것. 사용자에게 필요한 것은 "REGIONAL_FALLBACK"이 아니라
 * 그 장소가 왜 나왔는지이고, 각 후보의 `reason`이 이미 출처에 맞는 말을 담고 있다.
 */
export type CandidateSource = 'RELATED' | 'REGIONAL_FALLBACK'

export interface Alternatives {
  status: PlaceOffStatus
  /** 목록이 비었으면 null */
  source: CandidateSource | null
  /** 화면에 그대로 띄우는 문구. 추천이 있으면 null이다 — 목록 자체가 답이다 */
  statusMessage: string | null
  /** 원래 장소의 그 날 한적도. 모르면 null */
  originQuietness: number | null
  /** 대안으로 권하려면 필요한 최소 개선폭. 서버가 정한다 */
  minQuietnessGain: number
  alternatives: Alternative[]
}

/**
 * 서버 ForecastWindowResponse. 예측이 닿는 기간.
 *
 * <b>고르지 못하게 하는 상한이 아니다.</b> 여행은 미리 계획하는 것이라 창 밖 날짜로도
 * 코스를 짤 수 있다. 이 값은 "그 날짜는 지금 진단이 비어 나온다"를 <b>미리</b> 알려주는 데 쓴다.
 *
 * lastDate가 null이면 안내를 그리지 않는다 — 목업으로 도는 동안이 그렇다(날짜 제한이 없다).
 */
export interface ForecastWindow {
  /** 서버 시계 기준 오늘. 화면 시계로 계산하면 자정 무렵에 하루가 어긋난다 */
  firstDate: string
  lastDate: string | null
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
  /**
   * 총점을 <b>숫자로 보여줘도 되는가.</b> 서버가 판단한다(진단 2곳 이상 · 진단율 50% 이상).
   *
   * ⚠️ 이 값이 false여도 `totalQuietness`에는 값이 들어 있다. **저장에 쓰라고 남긴 것**이지
   * 화면에 띄우라는 뜻이 아니다 — 관광지 셋 중 하나만 진단된 코스에서 그 하나를
   * "코스 총점"이라 부르면 설명할 수 없다.
   *
   * 거짓이면 숫자 대신 `levelCounts` 요약을 편다.
   */
  totalPresentable: boolean
  /** 실제로 점수가 매겨진 칸 수. 총점의 분자 */
  diagnosedCount: number
  /**
   * 공사가 예측하기로 되어 있는 분류의 칸 수. 총점의 분모.
   * 음식점·숙박·쇼핑은 빠진다 — "관광지 3곳 중 2곳 기준"의 3이 이 값이다.
   */
  forecastTargetCount: number
  /** 등급별 칸 수. 총점을 못 보여줄 때 대신 펴는 요약 */
  levelCounts: LevelCounts
  slots: DiagnosedSlot[]
}

/**
 * 등급별 칸 수. 평균이 아니라 <b>사실의 나열</b>이라, 근거가 얇아도 정직하다.
 */
export interface LevelCounts {
  quiet: number
  moderate: number
  crowded: number
  /** 관광지인데 예측 자료가 없다. 날짜를 바꿔도 없다 */
  notForecasted: number
  /** 관광지인데 그 날짜가 예측 범위 밖. 기다리면 생긴다 */
  outOfForecastDate: number
  /** 애초에 예측 대상 분류가 아니다 (음식점·숙박·쇼핑) */
  notTargeted: number
}

/*
 * 설문 기반 코스 추천 (POST /api/courses/recommend).
 *
 * 아래 네 타입은 서버의 설문 enum과 같은 값이다. <b>각 답이 무슨 숫자를 뜻하는지는
 * 여기 없다.</b> 밀도가 몇 곳인지, 민감도가 한적도를 몇 퍼센트 반영하는지는 전부 서버에 있다.
 * 화면은 이름만 보내고 값은 모른다 — 분석 결과로 값이 바뀔 때 화면을 고치지 않기 위해서다.
 * 한적도 임계값이나 추천도 반영 비율을 서버에 둔 것과 같은 이유다.
 */

/*
 * ⚠️ 2026-08-27에 문항 둘을 걷어냈다 — 여행 스타일과 이동수단.
 *
 * 둘 다 같은 증상이었다. 고른 답이 후보를 걸러서, 좁게 고르면 코스가 비었다.
 * 스타일은 제주시에서 역사만 고르면 후보가 3곳(서귀포 2곳)이었고,
 * 이동수단은 대중교통을 고르면 반경 8km 밖이 통째로 잘렸다.
 *
 * 설문에서 무언가를 고르게 하려면 어느 답을 골라도 코스가 나와야 한다.
 * 고른 대가로 결과가 비는 문항은 선택지가 아니라 함정이다.
 *
 * 지금은 서버가 코스에 어울리지 않는 분류만 빼고(음식점·숙박·축제·리조트),
 * 거리 제한은 넉넉한 쪽 하나로 고정한다.
 */

/** 설문 1번 — 일정 밀도. 일자별로 몇 곳을 담을지 */
export type ItineraryDensity = 'RELAXED' | 'BALANCED' | 'PACKED'

/** 설문 2번 — 혼잡 민감도. 서비스 정체성이 걸린 문항이다 */
export type CrowdSensitivity = 'POPULAR' | 'MIXED' | 'QUIET'

export interface CourseRecommendRequest {
  /** 지역 슬러그. 예: "gyeongju" */
  region: string
  /** yyyy-MM-dd */
  startDate: string
  /** 박 수. 당일치기는 0 */
  nights: number
  density: ItineraryDensity
  sensitivity: CrowdSensitivity
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
  /**
   * 앞 장소에서의 거리. 예: "대릉원에서 1.2km"
   *
   * 그 날 <b>첫 장소</b>는 잴 거리가 없어 "하루를 시작하는 곳"이 온다.
   * 분류와 한적도는 여기 담기지 않는다 — 카드가 이미 글자와 배지로 보여준다.
   */
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
  /**
   * 진단에서 받은 총점. <b>진단되지 않은 코스는 null</b>이고 그대로 보낸다.
   * 0으로 채우면 서버가 "매우 붐빔"인 코스로 저장한다.
   */
  totalQuietness: number | null
  /** 홈의 "다른 사람들의 여행"에 보일지. 저장 화면의 토글이 정한다 */
  isPublic: boolean
  /**
   * 그 총점이 몇 곳을 근거로 한 값인지. 진단 응답에서 받은 값을 그대로 보낸다.
   *
   * 점수만 남기면 나중에 열었을 때 <b>근거가 얇은 점수와 두꺼운 점수가 같은 무게로</b>
   * 나란히 선다. 화면에 숫자를 못 띄우는 코스도 저장은 되므로(그게 맞다) 더 필요하다 —
   * 숫자를 감추는 대신 맥락을 붙이는 쪽을 골랐기 때문이다.
   */
  diagnosedCount: number
  forecastTargetCount: number
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
  /**
   * 저장 시점의 총점. <b>없을 수 있다.</b>
   *
   * 두 경우이고 사용자에게 뜻이 다르다 — 여행일이 예측 창 밖이라 <b>아직</b> 없거나,
   * 밥집만 담아 <b>영영</b> 없거나. 둘 다 저장은 된다. 저장은 재료를 남기는 일이고
   * 점수는 있으면 함께 남기는 것이다.
   */
  totalQuietness: number | null
  level: CongestionLevel | null
  levelLabel: string | null
  placeCount: number
  /**
   * 그 총점을 매긴 칸 수와 예측 대상 관광지 수.
   *
   * ⚠️ **이 컬럼이 생기기 전에 저장한 코스는 null이다.** 그때는 숫자만 보여주고
   * "몇 곳 중 몇 곳"을 말하지 않는다 — 모르는 것을 0으로 채우면
   * "근거가 하나도 없는 점수"라는 거짓말이 된다.
   */
  diagnosedCount: number | null
  forecastTargetCount: number | null
  /** 그 점수를 매긴 시각 (ISO). 총점이 없으면 이것도 null이다 — 매긴 적이 없으니까 */
  scoredAt: string | null
  createdAt: string
  /**
   * 홈의 "다른 사람들의 여행"에 나가는가.
   *
   * <b>목록에 표시하려고 받는 값이 아니다.</b> "수정하기"로 들어가 다시 저장할 때
   * 저장 시트의 공개 토글을 <b>지금 값</b>으로 채우기 위해 받는다. 없으면 기본값(켜짐)으로
   * 돌아가, 비공개로 둔 코스가 고치는 것만으로 공개된다.
   */
  isPublic: boolean
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

/**
 * 장소 하나의 읽을거리. <b>둘 다 없을 수 있다.</b>
 *
 * <p>overview에는 <b>{@code <br>} 같은 HTML 조각이 섞여 온다</b> — 공사가 그렇게 준다.
 * innerHTML로 넣지 말 것. 우리가 만든 문자열이 아니다.
 */
export interface PlaceDescription {
  address: string | null
  overview: string | null
}

/** 남의 코스에 담긴 장소 한 곳. placeId는 관광지 식별자이지 코스 식별자가 아니다 */
export interface PublicPlace {
  day: number
  order: number
  placeId: string
  name: string
}

/**
 * 남이 저장한 코스의 <b>익명</b> 요약. 홈의 "다른 사람들의 여행"에 쓴다.
 *
 * <b>코스 id가 없다.</b> 남의 코스를 번호로 가리켜 하나씩 여는 통로가 생기지 않는다.
 *
 * <p>이름은 <b>나온다.</b> 대신 저장 화면이 "홈에 보일 수 있다"고 알려주므로,
 * 사용자가 알고 짓는다 — 감추는 것보다 알리는 쪽이 정직하다.
 *
 * <p>대신 <b>장소는 전부 온다.</b> 카드를 눌러 펼쳐 볼 수 있는데, 상세를 따로 부르는 대신
 * 목록 응답이 내용을 이미 들고 있다 — 주소 없이 내용만 오는 셈이라 위 원칙이 그대로 유지되고,
 * 누를 때 추가 호출도 없다. 카드에 보이는 앞 세 곳은 화면이 잘라 쓴다.
 */
export interface PublicCourse {
  /**
   * 저장한 사람의 닉네임. 카드 제목이 <b>"챔석님의 경주"</b>로 서는 데 쓴다.
   *
   * <p>⚠️ <b>코스 이름은 오지 않는다.</b> 예전에는 그것이 제목이었는데, 사용자가 지은
   * 이름은 저마다 문법이 달라("엄마 생신 여행" · "경주 2일") 카드 다섯이 한 목록으로
   * 읽히지 않았다. 구분은 이제 사람이 한다.
   */
  nickname: string
  region: string
  /** 정식 이름("경상북도 경주시"). 제목에는 아래 짧은 이름을 쓴다 */
  regionName: string
  /** 짧은 이름("경주"). 앞을 잘라 만들지 않는다 — 표기 규칙은 서버가 정한다 */
  regionShortName: string
  startDate: string
  endDate: string
  nights: number
  days: number
  totalQuietness: number
  level: CongestionLevel
  levelLabel: string
  /** 담긴 순서(일차·순번)대로 전부 */
  places: PublicPlace[]
  createdAt: string
}

/**
 * 찜한 장소 하나. 서버 FavoritePlaceResponse와 짝을 이룬다.
 *
 * <p>⚠️ <b>한적도가 없다.</b> 찜은 날짜가 없는 표시라("언젠가 가고 싶다") 어느 날 기준으로
 * 재야 할지 정해지지 않는다. 날짜 없이 점수를 붙이면 화면이 재지 않은 것을 말하게 된다.
 *
 * @param placeName 찜한 시점의 이름. 목록을 열 때 공사를 다시 부르지 않으려고 서버가 남겨 둔다
 */
export interface FavoritePlace {
  /**
   * 지금의 장소. <b>좌표까지 든 온전한 값이다.</b>
   *
   * <p>이 값이 있어야 찜해 둔 곳으로 시작한 코스에서 그 칸이 <b>이름</b>으로 보인다 —
   * 코스는 id만 들고 다니고, 화면은 {@code placeCache}로 이름과 좌표를 되살린다.
   *
   * <p>⚠️ null일 수 있다. 지역을 모르는 찜에는 서버가 담지 않는다(찾으려면 공사 호출이
   * 목록을 열 때마다 나간다). 그런 찜에는 "여행가기" 문도 서지 않으므로 되살릴 일이 없다.
   */
  place: Place | null
  placeId: string
  placeName: string
  /**
   * ⚠️ <b>null일 수 있다.</b> 이 칸이 서버에 생기기 전에 찜한 곳이 그렇다 —
   * 마이그레이션 도구가 없어 새 칸은 null을 허용해야 했다(FavoritePlace 주석).
   * 화면은 그 줄을 비워 그린다. 다시 찜하면 채워진다.
   */
  categoryName: string | null
  /** 대표 이미지. <b>없을 수 있다</b> — 그때는 이름 첫 글자를 대신 세운다 */
  imageUrl: string | null
  /**
   * 이 곳이 든 지역. <b>"이 장소로 여행가기"가 이 값을 쓴다.</b>
   *
   * <p>⚠️ null일 수 있다 — 이 칸이 생기기 전에 찜했거나, 서버가 지역을 못 찾은 장소다.
   * 그때는 화면이 그 문을 세우지 않는다. 지역을 모르는 채 코스를 열면 그 장소는
   * 검색으로도 찾을 수 없는 칸이 된다.
   */
  region: string | null
  /** 화면에 적을 짧은 지역 이름("경주"). region이 null이면 함께 null이다 */
  regionName: string | null
  createdAt: string
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
