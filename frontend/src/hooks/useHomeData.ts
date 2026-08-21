import { useEffect, useState } from 'react'
import { diagnoseCourse, fetchPlaces } from '../services/api'
import type { CongestionLevel, DiagnosedSlot } from '../types/api'
import type { Place } from '../types/api'
import { today } from '../utils/date'

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

/** "지금 한적한 곳" 카드 수. */
const QUIET_COUNT = 4

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

export interface QuietSpot {
  place: Place
  quietness: number
  level: CongestionLevel
  levelLabel: string
  /**
   * 근거 문구.
   *
   * <b>계산한 것만 말한다.</b> "함께 많이 찾는 곳" 같은 표현은 연관 관광지 데이터가
   * 붙기 전까지 쓸 수 없다. 지금 손에 있는 것은 같은 날 두 장소의 예상 혼잡뿐이라,
   * 그 비교만 문장으로 만든다.
   */
  reason: string
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
  quiet: QuietSpot[]
  forecast: ForecastDay[]
  /** 예보 기간에서 가장 한적한 날 */
  bestDay: ForecastDay
}

export type HomeState =
  | { phase: 'loading' }
  | { phase: 'loaded'; data: HomeData }
  | { phase: 'error'; message: string }

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

/** 혼잡도(100 - 한적도) 비율. "붐비는 곳의 몇 % 수준인지"를 말하는 데 쓴다. */
function crowdRatioPercent(quietness: number, referenceQuietness: number): number {
  const crowd = 100 - quietness
  const referenceCrowd = 100 - referenceQuietness
  if (referenceCrowd <= 0) {
    return 100
  }
  return Math.max(1, Math.round((crowd / referenceCrowd) * 100))
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

function averageQuietness(slots: ScoredSlot[]): number {
  return slots.reduce((sum, slot) => sum + slot.quietness, 0) / slots.length
}

/**
 * 평균값에 해당하는 등급을 고른다.
 *
 * 평균은 서버가 매기지 않은 값이라 등급이 딸려오지 않는다. 그렇다고 화면에서
 * {@code quietness >= 70 ? '한적'} 식으로 판정하면 <b>임계값이 서버와 화면 두 곳에 생긴다.</b>
 * 분석 결과로 기준이 바뀔 때 한쪽만 고쳐지는 사고가 나므로, 평균과 가장 가까운 값을 가진
 * 슬롯의 등급을 빌려 쓴다. 임계값은 계속 서버에만 남는다.
 */
function levelNearest(slots: ScoredSlot[], target: number): ScoredSlot {
  return slots.reduce((closest, slot) =>
    Math.abs(slot.quietness - target) < Math.abs(closest.quietness - target) ? slot : closest,
  )
}

export function useHomeData(region: string): HomeState {
  const [state, setState] = useState<HomeState>({ phase: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    const startDate = today()

    async function load() {
      const places = await fetchPlaces(region, { limit: REPRESENTATIVE_LIMIT, signal: controller.signal })
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
        controller.signal,
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

      // 근거 문구의 비교 대상. 오늘 가장 붐비는 곳이다.
      const busiest = byCrowded[0]

      /*
       * 아래 카드 목록은 위 headline에 이미 선 곳을 건너뛴다.
       *
       * 같은 이름이 한 화면에 두 번 나오면 두 번째는 읽히지 않고, "왜 또 나오지"만 남는다.
       * 위는 훑는 목록이고 아래는 사진·근거까지 붙는 자세한 카드라 역할이 다른데,
       * 대상까지 같으면 그 차이가 전해지지 않는다.
       */
      const shownIds = new Set(headlineQuiet.map((spot) => spot.place.id))

      const quiet: QuietSpot[] = [...byCrowded]
        .reverse()
        .filter((slot) => !shownIds.has(slot.place.id))
        .slice(0, QUIET_COUNT)
        .map((slot) => ({
          place: slot.place,
          quietness: slot.quietness,
          level: slot.level,
          levelLabel: slot.levelLabel,
          reason: `같은 날 예상 혼잡은 ${busiest.place.name}의 ${crowdRatioPercent(
            slot.quietness,
            busiest.quietness,
          )}% 수준`,
        }))

      // ② 지역을 대표하는 7곳을 7일치로 깔아 주간 예보를 받는다.
      const sample = evenlySampled(byCrowded, FORECAST_SAMPLE_SIZE)
      const weekDiagnosis = await diagnoseCourse(
        {
          region,
          startDate,
          nights: FORECAST_DAYS - 1,
          slots: slotsFor(
            sample.map((slot) => slot.place.id),
            FORECAST_DAYS,
          ),
        },
        controller.signal,
      )

      const forecast: ForecastDay[] = Array.from({ length: FORECAST_DAYS }, (_, index) => {
        const daySlots = scoredOnly(weekDiagnosis.slots).filter((slot) => slot.day === index + 1)
        const average = Math.round(averageQuietness(daySlots))
        const representative = levelNearest(daySlots, average)
        return {
          date: daySlots[0].visitDate,
          quietness: average,
          level: representative.level,
          levelLabel: representative.levelLabel,
        }
      })

      const bestDay = forecast.reduce((best, day) =>
        day.quietness > best.quietness ? day : best,
      )

      setState({
        phase: 'loaded',
        data: {
          headline: { crowded: headlineCrowded, quiet: headlineQuiet },
          quiet,
          forecast,
          bestDay,
        },
      })
    }

    setState({ phase: 'loading' })
    load().catch((error: unknown) => {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }
      setState({
        phase: 'error',
        message:
          error instanceof Error ? error.message : '오늘의 혼잡 정보를 불러오지 못했습니다.',
      })
    })

    return () => controller.abort()
  }, [region])

  return state
}
