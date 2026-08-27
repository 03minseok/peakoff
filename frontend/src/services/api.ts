import type {
  ForecastWindow,
  Alternatives,
  ApiErrorCode,
  ApiResponse,
  AuthMember,
  AuthResult,
  ChangeNicknameRequest,
  ChangePasswordRequest,
  CourseDiagnosis,
  CourseDiagnosisRequest,
  CourseDraft,
  CourseRecommendRequest,
  DateAlternatives,
  DeleteAccountRequest,
  LoginRequest,
  NearbyPlace,
  PublicCourse,
  Place,
  SaveCourseRequest,
  SavedCourseDetail,
  SavedCourseSummary,
  SignupRequest,
  SocialLinkRequest,
  SocialLoginResult,
  SocialProvider,
} from '../types/api'
import { rememberPlaces } from './placeCache'

/**
 * 백엔드 호출을 한곳에 모은다.
 *
 * 컴포넌트가 fetch를 직접 부르면 URL과 응답 해석이 화면 곳곳에 흩어진다.
 * 그러면 서버 응답 모양이 바뀔 때 고칠 곳을 전부 찾아다녀야 한다.
 *
 * 경로가 `/api`로 시작하는 상대 경로인 것이 중요하다. 절대 URL(`http://localhost:8080`)을 쓰면
 * 브라우저가 교차 출처로 보고 CORS가 필요해진다. 상대 경로면 개발 중에는 Vite 프록시가,
 * 배포 후에는 같은 도메인이 처리하므로 양쪽 다 CORS가 필요 없다.
 */
const BASE_URL = '/api'

/** 네트워크 자체가 끊긴 경우. 서버가 준 코드가 아니므로 따로 구분한다. */
export type RequestErrorCode = ApiErrorCode | 'NETWORK_ERROR'

export class ApiRequestError extends Error {
  code: RequestErrorCode

  constructor(code: RequestErrorCode, message: string) {
    super(message)
    this.name = 'ApiRequestError'
    this.code = code
  }
}

interface RequestOptions {
  signal?: AbortSignal
  // PUT은 코스 수정 하나가 쓴다. PATCH와 갈라 둔 이유는 그쪽은 일부만 고치는데
  // 코스 수정은 이름·날짜·장소를 통째로 갈아끼우기 때문이다.
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
}

/**
 * 지금 로그인한 사용자의 토큰.
 *
 * 모듈 변수로 둔 이유: 토큰을 호출마다 인자로 넘기면 화면 곳곳에서 그 값을 들고 다녀야 하고,
 * 한 군데라도 빠뜨리면 "가끔 로그인이 안 먹는" 상태가 된다. 여기 한 곳에 두면
 * 모든 요청이 자동으로 실어 보낸다.
 *
 * 저장소에서 읽고 쓰는 일은 {@link ../state/authStorage} 가 맡는다. 이 파일은 값을 들고만 있다.
 */
let authToken: string | null = null

/** 로그인·로그아웃 시 호출한다. null을 넣으면 이후 요청에 토큰이 실리지 않는다. */
export function setAuthToken(token: string | null): void {
  authToken = token
}

/**
 * 공통 호출 처리.
 *
 * 성공하면 `data`만 꺼내 돌려주고, 실패하면 {@link ApiRequestError}를 던진다.
 * 호출하는 쪽이 매번 `success`를 확인하지 않아도 되게 하려는 것이다.
 */
async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { signal, method = 'GET', body } = options

  const headers: Record<string, string> = {}
  if (body) {
    headers['Content-Type'] = 'application/json'
  }
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`
  }

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      signal,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch (error) {
    // 요청 취소는 오류가 아니므로 그대로 올려보내 호출부가 무시하게 한다.
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }
    throw new ApiRequestError('NETWORK_ERROR', '서버에 연결할 수 없습니다.')
  }

  let payload: ApiResponse<T>
  try {
    payload = (await response.json()) as ApiResponse<T>
  } catch {
    // 서버가 죽어 프록시가 HTML 오류 페이지를 돌려주는 경우 등
    throw new ApiRequestError('INTERNAL_ERROR', '서버 응답을 해석할 수 없습니다.')
  }

  if (!payload.success) {
    throw new ApiRequestError(payload.error.code, payload.error.message)
  }
  return payload.data
}

/** POST /api/auth/signup — 가입 즉시 로그인 상태가 된다(토큰이 함께 온다). */
export function signup(request: SignupRequest, signal?: AbortSignal): Promise<AuthResult> {
  return apiRequest<AuthResult>('/auth/signup', { method: 'POST', body: request, signal })
}

/** POST /api/auth/login */
export function login(request: LoginRequest, signal?: AbortSignal): Promise<AuthResult> {
  return apiRequest<AuthResult>('/auth/login', { method: 'POST', body: request, signal })
}

/**
 * GET /api/auth/oauth/{provider}/authorize — 사용자를 보낼 로그인 창 주소를 받는다.
 *
 * 주소를 화면에서 조립하지 않는 이유: client_id와 redirect_uri가 서버 설정과 화면 코드
 * 두 곳에 존재하게 된다. 배포하면서 한쪽만 바뀌면 카카오가 KOE006으로 거절하는데,
 * 그때 원인이 어느 쪽인지 찾느라 시간을 쓴다. 값은 서버 한 곳에만 둔다.
 */
export function fetchAuthorizeUrl(
  provider: SocialProvider,
  state: string,
  signal?: AbortSignal,
): Promise<{ authorizeUrl: string }> {
  return apiRequest<{ authorizeUrl: string }>(
    `/auth/oauth/${provider}/authorize?state=${encodeURIComponent(state)}`,
    { signal },
  )
}

/**
 * POST /api/auth/oauth/{provider} — 인가 코드를 로그인으로 바꾼다.
 *
 * 인가 코드는 <b>한 번만</b> 쓸 수 있다. 같은 코드로 두 번 부르면 두 번째는 실패하므로,
 * 호출하는 쪽이 중복 호출을 막아야 한다(개발 모드의 이중 실행 포함).
 *
 * state까지 보내는 것은 네이버 사정이다. 네이버는 인가 코드를 토큰으로 바꿀 때도 그 값을
 * 요구한다. 서버가 판단에 쓰지는 않는다 — 우리가 시작한 로그인인지 확인하는 일은 여전히
 * 화면(consumeState)이 하고, 서버는 받은 값을 네이버에 되돌려줄 뿐이다.
 */
export function socialLogin(
  provider: SocialProvider,
  code: string,
  state: string,
  signal?: AbortSignal,
): Promise<SocialLoginResult> {
  return apiRequest<SocialLoginResult>(`/auth/oauth/${provider}`, {
    method: 'POST',
    body: { code, state },
    signal,
  })
}

/**
 * POST /api/auth/oauth/link — 비밀번호를 확인하고 기존 계정에 연결한다.
 *
 * 성공하면 그대로 로그인 상태가 된다(토큰이 온다).
 */
export function linkSocialAccount(
  request: SocialLinkRequest,
  signal?: AbortSignal,
): Promise<AuthResult> {
  return apiRequest<AuthResult>('/auth/oauth/link', { method: 'POST', body: request, signal })
}

/**
 * GET /api/auth/me — 저장해둔 토큰이 아직 살아 있는지 확인하는 자리이기도 하다.
 *
 * 만료됐으면 UNAUTHORIZED로 실패하므로, 화면을 열 때 한 번 불러 로그아웃 처리하면 된다.
 */
export function fetchMe(signal?: AbortSignal): Promise<AuthMember> {
  return apiRequest<AuthMember>('/auth/me', { signal })
}

/**
 * PATCH /api/auth/me/nickname
 *
 * 새 토큰이 함께 온다. 호출한 쪽은 반드시 그 토큰으로 갈아끼워야 한다 —
 * 옛 토큰에는 옛 닉네임이 박혀 있어서, 그대로 두면 새로고침할 때 되살아난다.
 */
export function changeNickname(
  request: ChangeNicknameRequest,
  signal?: AbortSignal,
): Promise<AuthResult> {
  return apiRequest<AuthResult>('/auth/me/nickname', {
    method: 'PATCH',
    body: request,
    signal,
  })
}

/**
 * PATCH /api/auth/me/password
 *
 * 토큰은 바뀌지 않는다. 담긴 내용(회원 번호·닉네임)이 그대로이기 때문이다.
 * 현재 비밀번호가 틀리면 UNAUTHORIZED로 실패한다.
 */
export function changePassword(
  request: ChangePasswordRequest,
  signal?: AbortSignal,
): Promise<void> {
  return apiRequest<void>('/auth/me/password', { method: 'PATCH', body: request, signal })
}

/** DELETE /api/auth/me — 계정과 저장한 코스를 함께 지운다. 되돌릴 수 없다 */
export function deleteAccount(
  request: DeleteAccountRequest,
  signal?: AbortSignal,
): Promise<void> {
  return apiRequest<void>('/auth/me', { method: 'DELETE', body: request, signal })
}

/*
 * 장소가 서버에서 들어오는 <b>모든 길목</b>에서 기억해 둔다.
 *
 * 화면마다 부르게 두면 새 화면을 만들 때 빠뜨리고, 빠뜨린 자리에서만 장소 이름이
 * 숫자로 보이는 찾기 어려운 버그가 된다. 코스에는 장소 id만 담기므로
 * "그 id가 누구인지"는 누군가 반드시 들고 있어야 한다(placeCache 참고).
 */
function remember<T extends Place>(places: T[]): T[] {
  rememberPlaces(places)
  return places
}

/** 진단·초안 응답은 장소가 슬롯 안에 들어 있다. 겉모양만 다르고 하는 일은 같다. */
function rememberSlots<T extends { slots: { place: Place }[] }>(response: T): T {
  rememberPlaces(response.slots.map((slot) => slot.place))
  return response
}

/**
 * GET /api/places?region=&keyword=&limit=
 *
 * 이름으로 장소를 찾는다. 검색 범위는 그 지역 안이다.
 *
 * keyword를 비우면 그 지역의 <b>대표 관광지</b>가 인기 순으로 온다. 검색 전 빈 화면에
 * 쓰는 목록이다 — 경주를 모르는 사용자는 빈 검색창 앞에서 첫 글자를 치지 못한다.
 *
 * 지역 전체를 받지 않는 이유: 경주만 621곳이고 지역이 늘면 수천 곳이 된다.
 * 화면에 늘어놓을 수 있는 양이 아니다.
 *
 * ⚠️ 대표 목록의 순서는 <b>인기 순</b>이지 추천 순이 아니다. 인기 장소는 붐비는 장소이므로
 * 이 순서를 추천 근거로 쓰면 오버투어리즘 과제와 어긋난다.
 */
export function fetchPlaces(
  region: string,
  options: { keyword?: string; limit?: number; signal?: AbortSignal } = {},
): Promise<Place[]> {
  const query = new URLSearchParams({ region })
  if (options.keyword) {
    query.set('keyword', options.keyword)
  }
  if (options.limit !== undefined) {
    query.set('limit', String(options.limit))
  }
  return apiRequest<Place[]>(`/places?${query}`, { signal: options.signal }).then(remember)
}

/**
 * GET /api/places/{placeId}/alternatives?date=&limit=
 *
 * 목록만이 아니라 <b>왜 그런 목록인지</b>를 함께 받는다. 서버가 개선폭 하한을 두기 때문에
 * 빈 목록이 흔하고, 빈 이유가 매번 다른 소식이다.
 */
export function fetchAlternatives(
  placeId: string,
  date: string,
  limit = 5,
  excludePlaceIds: string[] = [],
  signal?: AbortSignal,
): Promise<Alternatives> {
  const query = new URLSearchParams({ date, limit: String(limit) })
  // 이미 그 날 코스에 담긴 곳은 고를 수 없다. 서버가 뽑기 전에 빼면 Pool이 낭비되지 않는다.
  for (const id of excludePlaceIds) {
    query.append('exclude', id)
  }
  return apiRequest<Alternatives>(
    `/places/${encodeURIComponent(placeId)}/alternatives?${query}`,
    { signal },
  ).then((result) => {
    // 대안으로 교체하면 그 장소가 코스에 들어간다. 여기서 기억해 두지 않으면
    // 코스 편집 화면이 교체된 장소를 모른 채로 id만 들고 있게 된다.
    rememberPlaces(result.alternatives.map((alternative) => alternative.place))
    return result
  })
}

/**
 * GET /api/places/{placeId}/nearby — 근처의 같은 분류 장소.
 *
 * <b>대안 추천과 다른 함수인 이유</b>: 돌려주는 것이 다르다. 저쪽은 점수와 근거가 붙은
 * 추천이고 여기는 거리라는 사실뿐이다. 날짜를 받지 않는 것도 그래서다 —
 * 날짜에 따라 달라지는 값이 하나도 없다.
 *
 * 캐시하지 않는다. 무작위가 섞이지 않아 같은 요청이면 늘 같은 답이 온다.
 */
export function fetchNearby(
  placeId: string,
  limit = 5,
  signal?: AbortSignal,
): Promise<NearbyPlace[]> {
  const query = new URLSearchParams({ limit: String(limit) })
  return apiRequest<NearbyPlace[]>(
    `/places/${encodeURIComponent(placeId)}/nearby?${query}`,
    { signal },
  ).then((nearby) => {
    // 고르면 코스에 들어간다. 여기서 기억해 두지 않으면 편집 화면이 그 장소를 모른다.
    rememberPlaces(nearby.map((one) => one.place))
    return nearby
  })
}

/** POST /api/courses/diagnose */
export function diagnoseCourse(
  course: CourseDiagnosisRequest,
  signal?: AbortSignal,
): Promise<CourseDiagnosis> {
  return apiRequest<CourseDiagnosis>('/courses/diagnose', {
    method: 'POST',
    body: course,
    signal,
  }).then(rememberSlots)
}

/**
 * POST /api/courses/recommend — 설문 답으로 코스 초안을 받는다.
 *
 * 게스트도 부를 수 있다. 경주를 모르는 사용자의 진입점이라 로그인 뒤에 두면
 * 그 자체가 장벽이 된다.
 *
 * <b>같은 요청을 다시 보내면 다른 코스가 온다.</b> 서버가 상위 후보군에서 가중 무작위로
 * 뽑기 때문이다. 화면의 "다시 뽑기"가 이 성질에 기대고 있다 — 캐시하면 안 된다.
 */
export function recommendCourse(
  request: CourseRecommendRequest,
  signal?: AbortSignal,
): Promise<CourseDraft> {
  return apiRequest<CourseDraft>('/courses/recommend', {
    method: 'POST',
    body: request,
    signal,
  }).then(rememberSlots)
}

/**
 * POST /api/courses — 코스를 계정에 저장한다.
 *
 * totalQuietness는 진단에서 받은 값을 그대로 싣는다. 서버가 방금 내려준 답이라
 * 저장할 때 다시 계산하지 않는다.
 */
export function saveCourse(
  request: SaveCourseRequest,
  signal?: AbortSignal,
): Promise<SavedCourseDetail> {
  return apiRequest<SavedCourseDetail>('/courses', { method: 'POST', body: request, signal })
}

/**
 * PUT /api/courses/{id} — 이미 저장한 코스를 고쳐 쓴다.
 *
 * 마이페이지의 "수정하기"로 들어온 저장이다. 본문은 {@link saveCourse}와 같은 모양이고,
 * 지역만 서버가 무시한다 — 지역을 바꾸려면 조건 화면부터 다시 시작해야 한다.
 *
 * <p>이 길이 없던 동안에는 수정해 들어온 코스도 POST로 떨어져, 한 번 고칠 때마다
 * <b>목록에 비슷한 코스가 하나씩 쌓였다.</b>
 */
export function updateCourse(
  courseId: number,
  request: SaveCourseRequest,
  signal?: AbortSignal,
): Promise<SavedCourseDetail> {
  return apiRequest<SavedCourseDetail>(`/courses/${courseId}`, {
    method: 'PUT',
    body: request,
    signal,
  })
}

/**
 * GET /api/courses/recent — 다른 사람들이 최근에 저장한 코스 (익명).
 *
 * 로그인 없이 부를 수 있다. 로그인 상태면 서버가 내 코스를 빼고 준다.
 */
export function fetchRecentCourses(limit = 4, signal?: AbortSignal): Promise<PublicCourse[]> {
  return apiRequest<PublicCourse[]>(`/courses/recent?limit=${limit}`, { signal })
}

/** GET /api/courses — 내가 저장한 코스 목록. 최근 저장한 것이 먼저 온다 */
export function fetchSavedCourses(signal?: AbortSignal): Promise<SavedCourseSummary[]> {
  return apiRequest<SavedCourseSummary[]>('/courses', { signal })
}

/** GET /api/courses/{id} — 담긴 장소까지. 남의 코스를 물으면 NOT_FOUND */
export function fetchSavedCourse(
  courseId: number,
  signal?: AbortSignal,
): Promise<SavedCourseDetail> {
  return apiRequest<SavedCourseDetail>(`/courses/${courseId}`, { signal })
}

/** DELETE /api/courses/{id} */
export function deleteSavedCourse(courseId: number, signal?: AbortSignal): Promise<void> {
  return apiRequest<void>(`/courses/${courseId}`, { method: 'DELETE', signal })
}

/**
 * GET /api/dates/alternatives?slot=1:장소&slot=2:장소&date=&range=
 *
 * `일차:장소ID` 형식으로 여러 번 붙인다. 하나만 넘기면 그 장소 기준, 코스의 방문을
 * 전부 넘기면 코스 전체 기준으로 날짜를 비교한다.
 *
 * 장소만 넘기지 않고 <b>일차를 함께</b> 넘기는 이유: 2일차 장소는 시작일이 아니라
 * 그 다음 날에 간다. 일차가 빠지면 서버가 모든 곳을 시작일 하루로 계산해,
 * 여러 날 일정에서 진단 화면과 다른 숫자가 나온다.
 *
 * 일차와 장소를 배열 두 개로 나누지 않는 이유: 길이나 순서가 어긋나면 오류 없이
 * 조용히 엉뚱한 날짜로 계산된다. 한 문자열에 묶으면 짝이 깨질 수 없다.
 *
 * @param visits day와 placeId를 가진 방문 목록. `toSlots()`의 결과를 그대로 넣을 수 있다
 */
/**
 * 예측이 닿는 기간. 날짜를 고르는 화면이 <b>코스를 짜기 전에</b> 안내하려고 부른다.
 *
 * <p>실패해도 화면을 막지 않는다 — 안내가 없을 뿐 날짜는 고를 수 있다.
 * 부르는 쪽에서 조용히 삼킨다.
 */
export function fetchForecastWindow(signal?: AbortSignal): Promise<ForecastWindow> {
  return apiRequest<ForecastWindow>('/dates/forecast-window', { signal })
}

export function fetchDateAlternatives(
  visits: { day: number; placeId: string }[],
  date: string,
  range = 3,
  signal?: AbortSignal,
): Promise<DateAlternatives> {
  const query = new URLSearchParams({ date, range: String(range) })
  visits.forEach((visit) => query.append('slot', `${visit.day}:${visit.placeId}`))
  return apiRequest<DateAlternatives>(`/dates/alternatives?${query}`, { signal })
}
