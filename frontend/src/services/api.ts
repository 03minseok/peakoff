import type {
  Alternative,
  ApiErrorCode,
  ApiResponse,
  CourseDiagnosis,
  CourseDiagnosisRequest,
  DateAlternatives,
  Place,
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
 * 공통 호출 처리.
 *
 * 성공하면 `data`만 꺼내 돌려주고, 실패하면 {@link ApiRequestError}를 던진다.
 * 호출하는 쪽이 매번 `success`를 확인하지 않아도 되게 하려는 것이다.
 */
async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { signal, method = 'GET', body } = options

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      signal,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
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

/** GET /api/places?region=gyeongju */
export function fetchPlaces(region: string, signal?: AbortSignal): Promise<Place[]> {
  return request<Place[]>(`/places?region=${encodeURIComponent(region)}`, { signal })
}

/** GET /api/places/{placeId}/alternatives?date=&limit= */
export function fetchAlternatives(
  placeId: string,
  date: string,
  limit = 5,
  signal?: AbortSignal,
): Promise<Alternative[]> {
  const query = new URLSearchParams({ date, limit: String(limit) })
  return request<Alternative[]>(
    `/places/${encodeURIComponent(placeId)}/alternatives?${query}`,
    { signal },
  )
}

/** POST /api/courses/diagnose */
export function diagnoseCourse(
  course: CourseDiagnosisRequest,
  signal?: AbortSignal,
): Promise<CourseDiagnosis> {
  return request<CourseDiagnosis>('/courses/diagnose', {
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
  return request<DateAlternatives>(`/dates/alternatives?${query}`, { signal })
}
