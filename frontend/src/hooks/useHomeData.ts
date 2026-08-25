import { useEffect, useRef, useState } from 'react'
import { nextRegion } from '../constants/regions'
import { diagnoseCourse, fetchDateAlternatives, fetchPlaces } from '../services/api'
import type { CongestionLevel, DiagnosedSlot } from '../types/api'
import type { Place } from '../types/api'
import { daysFromToday, today } from '../utils/date'

/**
 * 홈 화면이 쓰는 데이터를 모은다.
 *
 * <h3>왜 진단 API로 예보를 만드는가</h3>
 * 서버에는 "장소 여러 곳의 특정 날짜 한적도"를 주는 전용 엔드포인트가 없다.
 * 대신 {@code POST /api/courses/diagnose} 가 정확히 그 일을 한다 — 슬롯마다
 * 방문 날짜를 계산해 한적도와 등급을 매겨 돌려준다. 그래서 장소 목록을
 * "하루짜리 코스"로 만들어 보내면 그날의 지역 한적도 표가 나온다.
 *
 * 주간 예보도 같은 방법이다. {@code nights=6}으로 두고 같은 장소들을 7일치 슬롯에 깔면
 * 서버가 날짜를 하루씩 밀며 계산해준다. 요청 한 번으로 7일이 전부 온다.
 *
 * <h3>왜 요청을 두 번 나누는가</h3>
 * 두 번째 요청의 표본을 첫 응답에서 뽑기 때문이다. 슬롯 상한이 50개라
 * 관광지 전체를 7일치로 깔 수 없어(23곳 × 7일 = 161), 한적도 전 구간에 걸친
 * 7곳을 골라 지역을 대표하게 한다.
 */

/**
 * 홈 화면에 세울 분류. 실제 API로 바꿀 때 신분류 코드 체계에 맞춰 이 목록만 고치면 된다.
 *
 * <p>음식점·카페·숙박은 뺀다. 홈은 "지역이 오늘 얼마나 붐비는가"를 보여주는 자리라
 * 볼거리로 대표하는 편이 읽힌다. 식당 한적도가 섞이면 지역 지표가 흐려진다.
 *
 * <p>한 이름이 아니라 목록인 이유: 서버가 볼거리를 역사·자연·체험으로 나눠 갖고 있다.
 * 설문의 "여행 스타일"이 이 분류로 후보를 고르기 때문이다.
 */
const SIGHTSEEING_CATEGORIES = new Set([
  // 신분류 코드(실데이터)
  '역사·유적',
  '자연·풍경',
  '문화·명소',
  '레저·스포츠',
  '체험',
  // 목업 카탈로그. 장소만 목업인 구간이 있어 둘 다 적어 둔다
  '체험·액티비티',
])

/**
 * 홈이 받아오는 대표 관광지 수.
 *
 * 지역 전체(경주 621곳)를 받지 않는다. 아래에서 다시 볼거리만 거르고 진단 요청 슬롯에
 * 까는데, 서버 슬롯 상한이 50이라 애초에 그만큼 받을 이유가 없다.
 */
const REPRESENTATIVE_LIMIT = 40

/**
 * "오늘의 OO"에 세우는 곳 수. 붐비는 쪽과 한적한 쪽을 <b>같은 수로</b> 뽑는다.
 *
 * <p>한쪽만 보여주면 "그래서 어쩌라고"가 된다. 붐비는 곳 옆에 한적한 곳이 같은 수로
 * 서 있어야 이 서비스가 하려는 말(피할 곳과 갈 곳)이 한 카드 안에서 완성된다.
 */
const HEADLINE_PER_SIDE = 3

/** 예보 기간. 서버가 받는 nights 상한이 6이라 7일이 최대다. */
const FORECAST_DAYS = 7

/**
 * 주간 예보의 표본 수. 7곳 × 7일 = 49로 슬롯 상한(50) 바로 아래다.
 *
 * <b>표본을 붐비는 곳으로만 채우면 안 된다.</b> 대표 명소는 한적도가 13~24라
 * 요일 보정을 곱해도 값이 14~19 사이에서만 움직여, 7일 막대가 전부 같은 높이로 보인다.
 * 한적도 전 구간에서 고르게 뽑아야 "주중이 낫다"는 차이가 화면에 드러난다.
 */
const FORECAST_SAMPLE_SIZE = 7

export interface HeadlineSpot {
  place: Place
  quietness: number
  level: CongestionLevel
  levelLabel: string
}

export interface ForecastDay {
  date: string
  /** 표본 장소들의 그날 한적도 평균 */
  quietness: number
  level: CongestionLevel
  levelLabel: string
}

export interface HomeData {
  /**
   * "오늘의 OO" 한 장. 붐비는 쪽과 한적한 쪽을 같은 수로 담는다.
   *
   * <p>두 목록으로 나눠 두는 이유: 화면이 둘 사이에 구분선과 소제목을 넣어야 하는데,
   * 한 배열로 주면 어디까지가 붐빔인지 화면이 개수를 세어 짐작해야 한다.
   * 그 개수는 장소가 모자랄 때 달라진다.
   */
  headline: { crowded: HeadlineSpot[]; quiet: HeadlineSpot[] }
  forecast: ForecastDay[]
  /** 예보 기간에서 가장 한적한 날 */
  bestDay: ForecastDay
}

export type HomeState =
  | { phase: 'loading' }
  | { phase: 'loaded'; data: HomeData }
  | { phase: 'error'; message: string }

export interface HomeFeed {
  state: HomeState
  /**
   * 다음 지역으로 <b>넘어가도 되는가.</b> 홈의 자동 넘김이 이 값을 보고 정한다.
   *
   * <p>"데이터가 있는가"가 아니라 "넘어가도 되는가"인 이유: 미리 받기가 <b>실패</b>했을 때도
   * 참이 된다. 기다려서 얻을 것이 없는데 막아 두면 자동 넘김이 통째로 멈춰
   * 고장난 지역 하나에 화면이 갇힌다 — 잠깐의 공백보다 나쁘다.
   *
   * <p>준비되지 않았는데 넘기면 사라졌다 나타난 자리에 스켈레톤이 서고,
   * 그것이 바로 없애려던 공백이다.
   */
  canAdvance: boolean
}

/** 같은 장소들을 매일 반복해 깔아 진단 요청 슬롯을 만든다. */
function slotsFor(placeIds: string[], days: number) {
  return Array.from({ length: days }, (_, dayIndex) =>
    placeIds.map((placeId, orderIndex) => ({
      day: dayIndex + 1,
      order: orderIndex + 1,
      placeId,
    })),
  ).flat()
}

/**
 * 정렬된 목록에서 양 끝을 포함해 고르게 count개를 고른다.
 *
 * 앞에서 그냥 잘라내면 붐비는 곳만, 뒤에서 자르면 한적한 곳만 담긴다.
 * 둘 다 지역 평균을 대표하지 못한다.
 */
function evenlySampled<T>(items: T[], count: number): T[] {
  if (items.length <= count) {
    return items
  }
  return Array.from(
    { length: count },
    (_, index) => items[Math.round((index * (items.length - 1)) / (count - 1))],
  )
}

/**
 * 한적도가 실제로 매겨진 슬롯.
 *
 * 서버는 예측 자료가 없는 칸을 {@code quietness: null}로 돌려준다 — 음식점처럼 예측 대상이
 * 아니거나, 그 날짜가 예측 범위 밖일 때다. 홈 화면은 <b>점수로 줄을 세우는 화면</b>이라
 * 그런 칸을 다룰 자리가 없다.
 */
type ScoredSlot = DiagnosedSlot & {
  quietness: number
  level: CongestionLevel
  levelLabel: string
}

/**
 * 점수가 매겨진 슬롯만 남긴다.
 *
 * <b>0으로 채워 넣지 않는다.</b> 0은 "매우 붐빔"으로 읽혀서, 자료가 없다는 사실이
 * "오늘 가장 붐비는 곳"이라는 거짓말로 바뀐다 — 홈 화면 맨 위에 그 장소가 올라간다.
 */
function scoredOnly(slots: DiagnosedSlot[]): ScoredSlot[] {
  return slots.filter((slot): slot is ScoredSlot => slot.quietness !== null)
}


/**
 * 지역 하나의 홈 데이터를 받아 온다. <b>상태를 건드리지 않고 값만 돌려준다.</b>
 *
 * <p>훅 밖으로 꺼낸 이유: 이 일을 <b>지금 보는 지역과 다음 지역에 각각</b> 시켜야 한다.
 * 훅 안에서 setState까지 함께 하던 시절에는 "화면에 그릴 것"과 "받아 오는 일"이 붙어 있어,
 * 미리 받아 두는 것 자체가 불가능했다 — 미리 받으면 아직 보지도 않는 지역이 화면에 얹혔다.
 *
 * <p>세 번을 <b>순서대로</b> 부른다. 뒤 요청의 입력이 앞 응답에서 나오기 때문에 겹칠 수 없다:
 * 장소 목록 → (그 장소들로) 오늘 진단 → (그 점수로 고른 표본으로) 이번 주 예보.
 * 지역이 넘어갈 때 공백이 생기던 것도 이 세 번이 다 끝나야 화면이 차기 때문이다.
 */
async function loadHomeData(region: string, signal: AbortSignal): Promise<HomeData> {
  const startDate = today()

  const places = await fetchPlaces(region, { limit: REPRESENTATIVE_LIMIT, signal })
  const spots = places.filter((place) => SIGHTSEEING_CATEGORIES.has(place.categoryName))
  if (spots.length === 0) {
    throw new Error('표시할 관광지가 없습니다.')
  }

  // ① 오늘 하루짜리 코스로 만들어 지역 전체의 오늘 한적도를 받는다.
  const todayDiagnosis = await diagnoseCourse(
    {
      region,
      startDate,
      nights: 0,
      slots: slotsFor(
        spots.map((place) => place.id),
        1,
      ),
    },
    signal,
  )

  /*
   * 붐비는 순. 한적도가 낮을수록 앞에 온다.
   *
   * 점수가 없는 곳은 여기서 뺀다. 실데이터에서는 예측 대상이 아닌 관광지가 섞여 오는데,
   * 줄을 세울 수 없는 것을 목록에 두면 어디엔가는 끼어들어야 한다.
   */
  const byCrowded = scoredOnly(todayDiagnosis.slots).sort((a, b) => a.quietness - b.quietness)
  if (byCrowded.length === 0) {
    throw new Error('오늘 예상 혼잡을 계산할 수 있는 관광지가 없습니다.')
  }

  const toHeadline = (slot: (typeof byCrowded)[number]): HeadlineSpot => ({
    place: slot.place,
    quietness: slot.quietness,
    level: slot.level,
    levelLabel: slot.levelLabel,
  })

  /*
   * 양 끝에서 같은 수만큼 가져온다.
   *
   * <b>가운데에서 만나면 안 된다.</b> 장소가 6곳보다 적으면 앞 3개와 뒤 3개가 겹쳐,
   * 같은 곳이 "붐빌 것"과 "한적할 것"에 동시에 뜬다. 화면이 스스로 모순되는데
   * 오류는 나지 않는 종류라, 여기서 반씩 나눠 자른다.
   */
  const perSide = Math.min(HEADLINE_PER_SIDE, Math.floor(byCrowded.length / 2))
  const headlineCrowded = byCrowded.slice(0, perSide).map(toHeadline)
  const headlineQuiet = [...byCrowded].reverse().slice(0, perSide).map(toHeadline)

  /*
   * ② 지역을 대표하는 7곳으로 이번 주 예보를 받는다.
   *
   * <b>진단이 아니라 날짜 대안 경로를 쓴다.</b> 진단은 장소마다 점수를 주지 날짜마다
   * 주지 않아서, 예전에는 화면이 하루치를 평균 내고 <b>그 평균에 가장 가까운 장소의
   * 등급을 빌려</b> 붙였다. 그래서 같은 36점인데 어떤 날은 보통, 어떤 날은 붐빔이 됐다 —
   * 36에 가장 가까운 장소가 41이면 그 장소의 "보통"이 따라온 것이다.
   *
   * 날짜 대안은 서버가 <b>날짜별로 평균을 내고 그 평균에 등급을 매겨</b> 돌려준다.
   * 숫자와 배지가 같은 값에서 나오므로 어긋날 수 없고, 임계값도 서버에만 남는다.
   *
   * 창의 한가운데를 오늘+3로 두는 이유: 서버는 기준일 앞뒤로 range일을 본다.
   * 가운데를 오늘로 두면 지난 날짜 절반이 딸려 오고, 오늘+3에 두면 창이 정확히
   * 오늘부터 7일이 된다.
   */
  const sample = evenlySampled(byCrowded, FORECAST_SAMPLE_SIZE)
  const half = Math.floor(FORECAST_DAYS / 2)
  const week = await fetchDateAlternatives(
    sample.map((slot) => ({ day: 1, placeId: slot.place.id })),
    daysFromToday(half),
    half,
    signal,
  )

  /*
   * 기준일은 options에 들어 있지 않다(서버가 "고른 날"로 따로 담아 보낸다).
   * 두 자리에서 온 값을 한 줄로 세워야 이번 주가 빠짐없이 그려진다.
   */
  const forecast: ForecastDay[] = [
    ...week.options,
    {
      date: week.selectedDate,
      quietness: week.selectedQuietness,
      level: week.selectedLevel,
      levelLabel: week.selectedLevelLabel,
    },
  ]
    .filter(
      (day): day is ForecastDay =>
        day.quietness !== null && day.level !== null && day.levelLabel !== null,
    )
    .sort((a, b) => a.date.localeCompare(b.date))

  if (forecast.length === 0) {
    throw new Error('이번 주 예상 혼잡을 계산하지 못했습니다.')
  }

  const bestDay = forecast.reduce((best, day) => (day.quietness > best.quietness ? day : best))

  return {
    headline: { crowded: headlineCrowded, quiet: headlineQuiet },
    forecast,
    bestDay,
  }
}

/**
 * 홈이 쓰는 데이터. <b>지금 지역과 다음 지역을 함께 받아 둔다.</b>
 *
 * <h3>왜 두 개씩인가</h3>
 * 홈은 14초마다 지역을 넘긴다. 예전에는 넘어간 <b>뒤에야</b> 새 지역을 부르기 시작했는데,
 * 한 지역을 채우려면 요청 세 번이 순서대로 돌아야 해서(장소 → 진단 → 예보) 그동안
 * 박스가 스켈레톤으로 비었다. 사라졌다 나타나는 연출이 <b>빈 화면을 여는</b> 셈이었다.
 *
 * <p>지금은 지금 지역을 그리는 동안 다음 지역을 미리 받는다. 넘어가는 순간 데이터가
 * 이미 손에 있으므로 공백이 없다. 14초는 세 요청이 끝나기에 넉넉하다.
 *
 * <p><b>세 개씩 받지 않는 이유</b>: 지역이 셋뿐이라 둘을 받으면 나머지 하나는 곧 다음 차례가
 * 되어 그때 받으면 된다. 한 번에 전부 받으면 홈에 들어오자마자 요청 아홉 개가 나가는데,
 * 그중 여섯은 사용자가 14초 안에 떠나면 버려진다.
 *
 * <h3>받아 둔 것은 버리지 않는다</h3>
 * 한 바퀴 돌아 같은 지역으로 돌아오면 캐시에 있던 것을 그대로 쓴다. 홈에 머무는 동안
 * 같은 지역을 두 번 부르지 않는다. 화면을 떠나면 함께 사라지므로 오래된 값이 남지도 않는다.
 */
export function useHomeData(region: string): HomeFeed {
  /** 지역별로 받아 둔 데이터. 이 화면에 머무는 동안만 산다 */
  const cache = useRef(new Map<string, HomeData>())
  /**
   * 지금 부르는 중인 요청.
   *
   * 이것이 없으면 같은 지역을 두 번 부른다 — 다음 지역으로 미리 부른 요청이 아직 오는 중에
   * 실제로 그 지역으로 넘어가면, 캐시에는 아직 없으므로 또 부르게 된다.
   */
  const pending = useRef(new Map<string, Promise<HomeData>>())
  /**
   * 화면을 떠날 때 끊을 손잡이. <b>지역이 넘어갈 때는 끊지 않는다.</b>
   *
   * 예전처럼 지역마다 새 컨트롤러를 만들어 정리 시점에 끊으면, 미리 받아 두던 다음 지역
   * 요청이 넘어가는 순간 함께 죽는다. 그러면 미리 받는 의미가 사라진다.
   */
  const abort = useRef<AbortController | null>(null)

  const [state, setState] = useState<HomeState>({ phase: 'loading' })
  /** 다음 지역으로 넘어가도 되는지. 화면이 이걸 보고 정한다 */
  const [canAdvance, setCanAdvance] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const abortRef = abort
    // 정리 시점에 ref를 다시 들여다보지 않도록 여기서 붙잡아 둔다.
    const inFlight = pending.current
    abortRef.current = controller
    return () => {
      controller.abort()
      abortRef.current = null
      // 끊긴 요청을 남겨두면 다시 들어왔을 때 죽은 약속을 기다린다.
      inFlight.clear()
    }
  }, [])

  useEffect(() => {
    let alive = true

    /** 캐시 → 부르는 중 → 새로 부르기 순으로 찾는다. 같은 지역을 두 번 부르지 않는다 */
    function request(target: string): Promise<HomeData> {
      const cached = cache.current.get(target)
      if (cached) {
        return Promise.resolve(cached)
      }
      const inFlight = pending.current.get(target)
      if (inFlight) {
        return inFlight
      }

      const signal = abort.current?.signal ?? new AbortController().signal
      const promise = loadHomeData(target, signal)
        .then((data) => {
          cache.current.set(target, data)
          return data
        })
        .finally(() => {
          /*
           * <b>내가 넣은 것일 때만 지운다.</b> 끊긴 요청이 뒤늦게 정리되면서 그 사이에
           * 새로 들어온 요청을 대신 지우는 일이 있다 — 개발 모드의 이중 마운트가 그 경우다.
           * 그러면 부르는 중인데 목록에는 없는 상태가 되어 같은 지역을 두 번 부른다.
           */
          if (pending.current.get(target) === promise) {
            pending.current.delete(target)
          }
        })

      pending.current.set(target, promise)
      return promise
    }

    const upcoming = nextRegion(region)

    /*
     * 이미 받아 둔 지역이면 로딩 상태를 거치지 않는다.
     *
     * 여기서 phase를 'loading'으로 되돌리면 캐시가 있어도 스켈레톤이 한 번 깜빡인다 —
     * 없애려던 공백이 딱 한 프레임짜리로 줄어든 채 그대로 남는다.
     */
    const cached = cache.current.get(region)
    if (cached) {
      setState({ phase: 'loaded', data: cached })
    } else {
      setState({ phase: 'loading' })
      request(region)
        .then((data) => {
          if (alive) {
            setState({ phase: 'loaded', data })
          }
        })
        .catch((error: unknown) => {
          if (!alive || (error instanceof DOMException && error.name === 'AbortError')) {
            return
          }
          setState({
            phase: 'error',
            message:
              error instanceof Error ? error.message : '오늘의 혼잡 정보를 불러오지 못했습니다.',
          })
        })
    }

    /*
     * 다음 지역을 미리. <b>지금 지역이 다 온 뒤에 시작하지 않는다</b> — 둘을 동시에 보내야
     * 14초 안에 둘 다 끝난다. 서로 다른 지역이라 앞뒤 관계도 없다.
     *
     * 실패는 조용히 삼킨다. 아직 보지도 않는 지역 때문에 지금 화면에 오류를 띄울 수는 없다.
     * 실제로 그 지역으로 넘어가면 캐시가 비어 있으니 그때 다시 부르고, 그때는 오류도 보인다.
     */
    setCanAdvance(cache.current.has(upcoming))
    if (upcoming !== region) {
      request(upcoming)
        .then(() => {
          if (alive) {
            setCanAdvance(true)
          }
        })
        .catch(() => {
          /*
           * 실패해도 넘길 수 있게 둔다. 여기서 막으면 지역 하나가 고장났을 때
           * 자동 넘김이 영영 멈춰 그 지역에 갇힌다.
           *
           * 넘어가면 캐시가 비어 있으니 그 지역이 다시 불리고, 그때는 오류 화면이
           * 정직하게 뜬다. 14초 뒤에는 그 다음 지역으로 넘어간다.
           */
          if (alive) {
            setCanAdvance(true)
          }
        })
    }

    return () => {
      alive = false
    }
  }, [region])

  return { state, canAdvance }
}
