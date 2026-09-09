import type {
  PlaceDescription,
  ForecastWindow,
  Alternatives,
  ApiErrorCode,
  ApiResponse,
  AuthMember,
  AuthResult,
  ChatAnswer,
  ChatLines,
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
  FavoritePlace,
  PublicCourse,
  SharedCourse,
  Place,
  Trip,
  QuietSpot,
  RegionOption,
  SaveCourseRequest,
  SavedCourseDetail,
  SavedCourseSummary,
  SignupRequest,
  SocialLinkRequest,
  SocialLoginResult,
  SocialProvider,
  QuotaSummary,
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

/**
 * 네트워크 자체가 끊긴 경우와 <b>제때 답이 오지 않은 경우</b>. 서버가 준 코드가 아니라 따로 구분한다.
 *
 * <p>`TIMEOUT`을 `NETWORK_ERROR`와 가르는 이유: 연결이 끊긴 것과 서버가 붙잡고 있는 것은
 * 사용자가 할 일이 다르다. 앞은 네트워크를 보라는 말이고, 뒤는 잠시 뒤 다시 눌러 보라는 말이다.
 */
export type RequestErrorCode = ApiErrorCode | 'NETWORK_ERROR' | 'TIMEOUT'

/**
 * 이 시간 안에 답이 오지 않으면 실패로 다룬다.
 *
 * <h3>왜 필요한가</h3>
 * 서버가 <b>연결은 받고 답을 주지 않으면</b> `fetch`는 영영 끝나지 않는다. 그 약속을 기다리는
 * 화면은 로딩 상태에 그대로 멈춘다 — 오류 화면도, 다시 시도 버튼도 나오지 않는다.
 * 실제로 재현했고, 모든 화면이 그랬다. 지역 목록을 받는 자리가 특히 나쁘다: 그 응답이 오기
 * 전에는 `RegionProvider`가 앱을 통째로 붙잡고 있어 <b>서비스 전체가 흰 화면</b>이 된다.
 *
 * <h3>왜 15초인가</h3>
 * 캐시가 더운 상태의 실측(2026-09-09)에서 가장 느린 것이 대안 추천 <b>1.8초</b>였고
 * 나머지는 전부 0.4초 아래였다(장소 검색 15ms · 진단 6ms · 설문 추천 0.3초 · 홈 34ms).
 * 캐시가 빈 첫 요청과 느린 회선을 넉넉히 덮으면서, 멈춘 서버를 붙잡고 기다리는 시간은
 * 사람이 견딜 수 있는 선이다. <b>정상 응답을 끊는 일이 없어야 한다</b> — 시간 제한이
 * 멀쩡한 기능을 죽이면 없느니만 못하다.
 */
const DEFAULT_TIMEOUT_MS = 15_000

/*
 * ⚠️ 챗봇용 35초 제한이 여기 있었는데 <b>걷어냈다</b> (2026-09-09).
 *
 * 모델을 두 번 차례로 부르느라 한 요청이 8.5~9.4초였고, 그래서 기본값을 못 썼다.
 * 지금은 카드와 문장을 <b>두 요청으로 갈랐다</b> — 각각은 모델을 한 번만 부르므로
 * 기본 15초 안에 넉넉히 들어온다(서버가 의도 추출에 10초, 문장에 5초를 준다).
 * 예외를 두지 않는 편이 낫다: 값이 크면 정말 멈춘 서버도 그만큼 붙잡고 있게 된다.
 */

export class ApiRequestError extends Error {
  code: RequestErrorCode

  /**
   * 몇 초 뒤에 다시 되는지. 429일 때만 채워진다.
   *
   * <b>서버만 아는 값이다.</b> 화면이 짐작해 잠그면 너무 일찍 풀려 다시 막히거나
   * 너무 늦게 풀려 쓸 수 있는데 막아 둔다. 서버가 준 초를 그대로 센다.
   */
  retryAfterSeconds?: number

  constructor(code: RequestErrorCode, message: string, retryAfterSeconds?: number) {
    super(message)
    this.name = 'ApiRequestError'
    this.code = code
    this.retryAfterSeconds = retryAfterSeconds
  }
}

interface RequestOptions {
  signal?: AbortSignal
  // PUT은 코스 수정 하나가 쓴다. PATCH와 갈라 둔 이유는 그쪽은 일부만 고치는데
  // 코스 수정은 이름·날짜·장소를 통째로 갈아끼우기 때문이다.
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  /** 이 요청만 다른 시간 제한을 쓸 때. 비우면 {@link DEFAULT_TIMEOUT_MS} */
  timeoutMs?: number
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
  const { signal, method = 'GET', body, timeoutMs = DEFAULT_TIMEOUT_MS } = options

  const headers: Record<string, string> = {}
  if (body) {
    headers['Content-Type'] = 'application/json'
  }
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`
  }

  /*
   * 시간 제한과 호출부의 취소를 <b>하나로 합친다.</b>
   *
   * 둘은 뜻이 다르다 — 호출부의 signal은 "화면이 떠났으니 그만"이고, 여기 시계는
   * "서버가 답을 안 준다"이다. 그래서 어느 쪽이 끊었는지 기억해 두어야 한다({@code timedOut}).
   * 시간 초과를 취소로 다루면 아래에서 AbortError로 올라가고, 호출부는 그것을
   * "화면이 떠난 것"으로 알고 <b>조용히 무시한다</b> — 고치려던 흰 화면이 그대로 남는다.
   *
   * ⚠️ {@code AbortSignal.any}로 합치지 않는다. 사파리 17.4·파이어폭스 124부터라
   * 조금 오래된 폰에서 그대로 터진다. 심사위원의 기기를 고를 수 없다.
   */
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  const abortByCaller = () => controller.abort()
  // 이미 취소된 signal은 이벤트가 다시 오지 않는다. 그때는 시작하기 전에 끊는다.
  if (signal?.aborted) {
    controller.abort()
  }
  signal?.addEventListener('abort', abortByCaller)
  const stopWatching = () => {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abortByCaller)
  }

  /** 끊긴 요청이 시간 초과였는지 호출부의 취소였는지 가른다. */
  function abortedError(error: unknown, fallback: ApiRequestError): Error {
    if (timedOut) {
      return new ApiRequestError(
        'TIMEOUT',
        '서버가 제때 답하지 않았어요.\n잠시 후 다시 시도해 주세요.',
      )
    }
    // 요청 취소는 오류가 아니므로 그대로 올려보내 호출부가 무시하게 한다.
    if (error instanceof DOMException && error.name === 'AbortError') {
      return error
    }
    return fallback
  }

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      signal: controller.signal,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch (error) {
    stopWatching()
    throw abortedError(error, new ApiRequestError('NETWORK_ERROR', '서버에 연결할 수 없습니다.'))
  }

  /*
   * 본문 읽기도 시계 안에 둔다. 서버가 <b>헤더만 주고 본문에서 멈추는</b> 경우가 있는데,
   * 그때 위 fetch는 이미 성공한 뒤라 여기서 막히면 화면은 똑같이 영영 기다린다.
   * fetch에 넘긴 signal이 본문 읽기까지 따라가므로 시계를 아직 끄지 않는다.
   */
  let raw: string
  try {
    raw = await response.text()
  } catch (error) {
    stopWatching()
    throw abortedError(
      error,
      new ApiRequestError('INTERNAL_ERROR', '서버 응답을 해석할 수 없습니다.'),
    )
  }
  stopWatching()

  /*
   * ⚠️ <b>본문 없는 응답을 실패로 만들지 않는다.</b>
   *
   * 예전에는 곧바로 {@code response.json()}을 불렀다. {@code 204 No Content}처럼 본문이
   * 비어 오면 파싱이 터지고, 그것이 {@code INTERNAL_ERROR}가 되어 <b>서버가 제대로 처리한
   * 일이 화면에서는 실패로</b> 보였다. 여행 삭제가 그랬다 — 서버는 지웠는데 화면은
   * 그대로 있다가 새로고침해야 사라졌다.
   *
   * <p>DELETE에 본문 없이 204를 주는 것은 흔한 REST 관례이고, 우리 서버가 지금은
   * 봉투를 실어 보내더라도 <b>화면이 그 약속에 매달릴 이유가 없다.</b> 서버를 고쳐도
   * 옛 빌드가 돌고 있으면 같은 증상이 되살아난다.
   *
   * <p>대신 <b>실패한 응답의 빈 본문은 그대로 실패</b>다. 502를 조용히 성공으로
   * 넘기면 화면이 아무 일 없었다는 듯 서 있게 된다.
   */
  if (raw.trim() === '') {
    if (!response.ok) {
      /*
       * 상태 코드를 문구에 적지 않는다. 이 메시지는 그대로 화면 알림이 되는데,
       * "서버가 502로 응답했습니다"는 사용자가 할 수 있는 일이 없는 말이다.
       * 숫자는 콘솔에 이미 남는다.
       */
      throw new ApiRequestError('INTERNAL_ERROR', '서버 응답을 해석할 수 없습니다.')
    }
    return undefined as T
  }

  let payload: ApiResponse<T>
  try {
    payload = JSON.parse(raw) as ApiResponse<T>
  } catch {
    // 서버가 죽어 프록시가 HTML 오류 페이지를 돌려주는 경우 등
    throw new ApiRequestError('INTERNAL_ERROR', '서버 응답을 해석할 수 없습니다.')
  }

  if (!payload.success) {
    throw new ApiRequestError(
      payload.error.code,
      payload.error.message,
      retryAfterOf(response),
    )
  }
  return payload.data
}

/** POST /api/auth/signup — 가입 즉시 로그인 상태가 된다(토큰이 함께 온다). */
/**
 * Retry-After 헤더를 초로 읽는다.
 *
 * ⚠️ <b>같은 출처라야 읽힌다.</b> 개발은 Vite 프록시가, 배포는 Vercel rewrite가
 * /api를 대신 전달하므로 브라우저에게는 같은 출처다 — 다른 도메인으로 직접 부르면
 * 이 헤더가 CORS에 막혀 사라지고, 버튼이 영영 안 풀리거나 곧바로 풀린다.
 */
function retryAfterOf(response: Response): number | undefined {
  const raw = response.headers.get('Retry-After')
  if (!raw) {
    return undefined
  }
  const seconds = Number.parseInt(raw, 10)
  return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined
}

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
/**
 * GET /api/regions
 *
 * 서비스가 지원하는 지역 전부. <b>앱이 뜰 때 한 번만</b> 부른다 —
 * 공사를 부르지 않는 서버 메모리 조회라 빠르고, 목록이 세션 중에 바뀌지 않는다.
 *
 * 화면이 이 목록을 상수로 들고 있지 않은 이유는 {@link RegionOption} 주석에 적어 두었다.
 */
export function fetchRegions(signal?: AbortSignal): Promise<RegionOption[]> {
  return apiRequest<RegionOption[]>('/regions', { signal })
}

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
 * GET /api/favorites — 내가 찜한 곳. 최근에 찜한 것부터.
 *
 * <p>로그인이 필요하다. 게스트가 부르면 401이므로 화면이 부르지 않는다.
 */
export function fetchFavorites(signal?: AbortSignal): Promise<FavoritePlace[]> {
  return apiRequest<FavoritePlace[]>('/favorites', { signal }).then((favorites) => {
    /*
     * 장소가 서버에서 들어오는 길목이라 여기서도 기억해 둔다.
     *
     * <p>찜해 둔 곳으로 코스를 시작하면 그 칸은 id만 남는데, 편집 화면은 캐시에서
     * 이름과 좌표를 되살린다 — 기억해 두지 않으면 그 자리가 <b>숫자 id로 보인다.</b>
     * 실제로 그랬다.
     */
    rememberPlaces(favorites.map((favorite) => favorite.place).filter((place) => place !== null))
    return favorites
  })
}

/**
 * PUT/DELETE /api/favorites/{placeId} — 찜하고 푼다.
 *
 * <p><b>둘 다 멱등이다.</b> 이미 찜한 곳을 또 찜하거나 찜하지 않은 곳을 취소해도 성공한다 —
 * 하트 하나로 토글하는 자리라 같은 요청이 두 번 가는 일이 실제로 생긴다(연타·두 탭).
 */
export function addFavorite(placeId: string, signal?: AbortSignal): Promise<void> {
  return apiRequest<void>(`/favorites/${encodeURIComponent(placeId)}`, {
    method: 'PUT',
    signal,
  })
}

export function removeFavorite(placeId: string, signal?: AbortSignal): Promise<void> {
  return apiRequest<void>(`/favorites/${encodeURIComponent(placeId)}`, {
    method: 'DELETE',
    signal,
  })
}

/**
 * GET /api/places/quiet-week?limit=
 *
 * 지역을 가리지 않고, 앞으로 7일 안에 한적할 것으로 예측된 곳들.
 * 곳마다 <b>그 기간 중 가장 한적한 하루</b>가 함께 온다.
 *
 * <p>⚠️ <b>순서는 점수 순이 아니라 뽑힌 순서다.</b> 서버가 매번 가중 무작위로 고르므로
 * 같은 요청에 다른 답이 온다 — 홈에 뜨는 곳이 늘 같으면 그곳이 새로운 혼잡지가 되기
 * 때문이다. 화면이 받은 뒤 다시 정렬하면 그 장치가 통째로 죽는다.
 *
 * <p>한적 등급인 곳만 오므로 <b>요청보다 적게 올 수 있다.</b> 자리를 채우려고
 * 보통인 곳을 섞지 않는 편이 목록의 이름과 맞는다.
 */
export function fetchQuietSpots(limit = 3, signal?: AbortSignal): Promise<QuietSpot[]> {
  return apiRequest<QuietSpot[]>(`/places/quiet-week?limit=${limit}`, { signal }).then(
    (spots) => {
      // 장소가 서버에서 들어오는 길목이라 여기서도 기억해 둔다. 상세 시트가 id로 찾는다.
      rememberPlaces(spots.map((spot) => spot.place))
      return spots
    },
  )
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
/**
 * GET /api/places/{id}/description — 장소 하나의 주소와 소개글.
 *
 * ⚠️ <b>목록에서 부르지 말 것.</b> 소개글은 지역 카탈로그에 없고 상세 조회에만 있어
 * 장소마다 공사를 한 번씩 부른다 — N곳이면 N번이고, 그 모양이 2026-08-26 한도 소진
 * 사고였다. 사용자가 "설명 보기"를 누른 것만 부른다.
 *
 * 서버가 6시간 캐시로 받쳐 두지만 캐시가 빈 첫 조회는 그대로 나간다.
 * 주소도 소개글도 없을 수 있다 — 404가 아니라 둘 다 null로 온다.
 */
export function fetchPlaceDescription(
  placeId: string,
  signal?: AbortSignal,
): Promise<PlaceDescription> {
  return apiRequest<PlaceDescription>(`/places/${placeId}/description`, { signal })
}

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
export async function fetchRecentCourses(
  limit = 4,
  signal?: AbortSignal,
): Promise<PublicCourse[]> {
  const courses = await apiRequest<PublicCourse[]>(`/courses/recent?limit=${limit}`, { signal })

  /*
   * 장소가 서버에서 들어오는 길목이라 여기서도 기억해 둔다.
   *
   * <p>남의 코스를 베껴 편집 화면으로 가면 그 칸이 <b>숫자 id로 보였다.</b> 코스는 id만
   * 들고 다니고 화면이 캐시에서 이름·좌표를 되살리는데, 남의 코스는 그 브라우저가
   * 검색한 적이 없어 되살릴 것이 없었다. 실제로 그랬다.
   *
   * <p>⚠️ <b>화면이 아니라 여기서 부른다.</b> 베끼는 자리에서 부르면 그 화면에서만
   * 고쳐지고, 같은 목록을 쓰는 다음 화면에서 또 숫자가 뜬다 — 위 rememberFromResponse
   * 주석이 경계하는 그 버그다.
   *
   * <p>카탈로그에서 사라진 장소는 place가 null이라 걸러 낸다.
   */
  rememberPlaces(
    courses.flatMap((course) => course.places.map((place) => place.place)).filter((place) => place !== null),
  )
  return courses
}

/** GET /api/courses — 내가 저장한 코스 목록. 최근 저장한 것이 먼저 온다 */

/** GET /api/trips — 내 여행 전부. 최근 만든 것이 위로 온다 */
export function fetchTrips(signal?: AbortSignal): Promise<Trip[]> {
  return apiRequest<Trip[]>('/trips', { signal })
}

/** POST /api/trips — 이름만으로 만든다. 코스는 만들고 나서 담는다 */
export function createTrip(name: string): Promise<Trip> {
  return apiRequest<Trip>('/trips', { method: 'POST', body: { name } })
}

/**
 * POST /api/trips/{id}/courses — 여행 맨 뒤에 담는다.
 * 담고 난 여행 전체가 돌아오므로 목록을 다시 조회하지 않아도 된다.
 */
export function addCourseToTrip(tripId: number, courseId: number): Promise<Trip> {
  return apiRequest<Trip>(`/trips/${tripId}/courses`, { method: 'POST', body: { courseId } })
}

/** DELETE /api/trips/{id}/courses/{courseId} — 여행에서만 뺀다. 저장 목록에는 남는다 */
export function removeCourseFromTrip(tripId: number, courseId: number): Promise<Trip> {
  return apiRequest<Trip>(`/trips/${tripId}/courses/${courseId}`, { method: 'DELETE' })
}

/** DELETE /api/trips/{id} — 묶음만 지운다. 담겨 있던 코스는 그대로 남는다 */
export function deleteTrip(tripId: number): Promise<void> {
  return apiRequest<void>(`/trips/${tripId}`, { method: 'DELETE' })
}

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
 * POST /api/courses/{id}/share — 공유 링크의 열쇠(토큰)를 받는다. 두 번 눌러도 같은 토큰이다.
 *
 * 완성 주소는 {@link shareUrlOf}가 만든다 — 어느 배포본(운영·프리뷰·로컬)에서 눌렀는지는
 * 화면만 알기 때문에 서버는 토큰만 준다.
 */
export async function shareSavedCourse(courseId: number, signal?: AbortSignal): Promise<string> {
  const response = await apiRequest<{ token: string }>(`/courses/${courseId}/share`, {
    method: 'POST',
    signal,
  })
  return response.token
}

/** 공유 토큰 → 이 배포본의 주소. 라우트 `s/:token`(App.tsx)과 한 몸이다 */
export function shareUrlOf(token: string): string {
  return `${window.location.origin}/s/${token}`
}

/**
 * GET /api/courses/shared/{token} — 공유 링크로 코스를 본다. 로그인 없이.
 *
 * ⚠️ {@link fetchRecentCourses}와 같은 이유로 장소를 캐시에 심는다 — 안 심으면 "이 코스로
 * 짜보기"로 편집 화면에 간 뒤 칸이 숫자 id로 뜬다. 받은 사람의 브라우저는 그 장소를 검색한 적이 없다.
 */
export async function fetchSharedCourse(token: string, signal?: AbortSignal): Promise<SharedCourse> {
  const course = await apiRequest<SharedCourse>(`/courses/shared/${encodeURIComponent(token)}`, {
    signal,
  })
  rememberPlaces(course.places.map((place) => place.place).filter((place) => place !== null))
  return course
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

/* ─────────────────────────── 여행지 추천 챗봇 ─────────────────────────── */

/**
 * 챗봇을 켤 수 있는지 묻는다.
 *
 * 화면이 <b>처음 뜰 때 한 번만</b> 부른다. 꺼져 있으면 입력창 대신 설문으로 안내하는데,
 * 그 판단을 매번 다시 하면 사용자가 글을 치는 도중에 화면이 바뀔 수 있다.
 */
/**
 * 챗봇을 그릴지, 그리고 <b>어느 기간을 본다고 적을지</b>.
 *
 * basis를 여기서 함께 받는 이유: 머리글은 답을 받기 <b>전에</b> 서는 줄이라
 * 답에 실린 기간으로는 채울 수 없다. 기간의 원천은 서버 한 곳이다.
 */
export function fetchChatStatus(
  signal?: AbortSignal,
): Promise<{ enabled: boolean; basis?: string }> {
  return apiRequest<{ enabled: boolean; basis?: string }>('/chat/status', { signal })
}

/**
 * 질문을 던져 지역 카드를 받는다.
 *
 * ⚠️ <b>같은 질문이라도 매번 다른 지역이 올 수 있다.</b> 서버가 자격을 갖춘 후보 안에서
 * 균등 무작위로 뽑기 때문이다 — 늘 같은 셋을 보여주면 그곳이 새로운 혼잡지가 된다.
 * 그래서 화면은 받은 답을 <b>상태에 담아 두고</b>, 다시 그려질 때 다시 묻지 않는다.
 */
export function askRegionChat(question: string, signal?: AbortSignal): Promise<ChatAnswer> {
  return apiRequest<ChatAnswer>('/chat/regions', {
    method: 'POST',
    body: { question },
    signal,
  })
}

/**
 * POST /api/chat/regions/lines — 카드에 얹을 **더 나은 문장**만 따로 받는다.
 *
 * 카드는 이미 템플릿 문장으로 완결돼 있으므로 이 요청은 **늦거나 실패해도 된다.**
 * 부르는 쪽은 실패를 조용히 삼키고 카드를 그대로 둔다.
 *
 * 서버가 앞 답을 기억하지 않으므로 문장을 쓰는 데 필요한 것을 화면이 되돌려 보낸다.
 * ⚠️ 되돌려 보낸 값으로 카드의 숫자가 다시 그려지지는 않는다 — 돌아오는 것은 문장뿐이다.
 */
export function fetchChatLines(
  question: string,
  interest: string | null,
  regions: { slug: string; quietShare: number | null }[],
  signal?: AbortSignal,
): Promise<ChatLines> {
  return apiRequest<ChatLines>('/chat/regions/lines', {
    method: 'POST',
    body: { question, interest, regions },
    signal,
  })
}

/**
 * GET /api/quotas — 오늘 공사 OpenAPI 호출 수.
 *
 * <p>읽기 전용이고 로그인 없이 열린다. 호출 이력 자체가 공모전 규칙 1의 증거라
 * 감출 이유가 없고, 값도 개인과 무관한 집계다.
 */
export function fetchQuotas(signal?: AbortSignal): Promise<QuotaSummary> {
  return apiRequest<QuotaSummary>('/quotas', { signal })
}
