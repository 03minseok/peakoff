import type {
  Alternative,
  ApiErrorCode,
  ApiResponse,
  AuthMember,
  AuthResult,
  CourseDiagnosis,
  CourseDiagnosisRequest,
  DateAlternatives,
  LoginRequest,
  Place,
  SignupRequest,
} from '../types/api'

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
  method?: 'GET' | 'POST'
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
 * GET /api/auth/me — 저장해둔 토큰이 아직 살아 있는지 확인하는 자리이기도 하다.
 *
 * 만료됐으면 UNAUTHORIZED로 실패하므로, 화면을 열 때 한 번 불러 로그아웃 처리하면 된다.
 */
export function fetchMe(signal?: AbortSignal): Promise<AuthMember> {
  return apiRequest<AuthMember>('/auth/me', { signal })
}

/** GET /api/places?region=gyeongju */
export function fetchPlaces(region: string, signal?: AbortSignal): Promise<Place[]> {
  return apiRequest<Place[]>(`/places?region=${encodeURIComponent(region)}`, { signal })
}

/** GET /api/places/{placeId}/alternatives?date=&limit= */
export function fetchAlternatives(
  placeId: string,
  date: string,
  limit = 5,
  signal?: AbortSignal,
): Promise<Alternative[]> {
  const query = new URLSearchParams({ date, limit: String(limit) })
  return apiRequest<Alternative[]>(
    `/places/${encodeURIComponent(placeId)}/alternatives?${query}`,
    { signal },
  )
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
  })
}

/**
 * GET /api/dates/alternatives?placeId=&placeId=&date=&range=
 *
 * placeId를 여러 번 붙인다. 하나만 넘기면 그 장소 기준, 코스의 장소를 전부 넘기면
 * 코스 전체 기준으로 날짜를 비교한다.
 */
export function fetchDateAlternatives(
  placeIds: string[],
  date: string,
  range = 14,
  signal?: AbortSignal,
): Promise<DateAlternatives> {
  const query = new URLSearchParams({ date, range: String(range) })
  placeIds.forEach((placeId) => query.append('placeId', placeId))
  return apiRequest<DateAlternatives>(`/dates/alternatives?${query}`, { signal })
}
