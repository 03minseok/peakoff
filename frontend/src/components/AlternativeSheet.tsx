import { useEffect, useRef, useState } from 'react'
import { ApiRequestError, fetchAlternatives, fetchNearby } from '../services/api'
import { rememberSwapEvidence } from '../services/swapEvidence'
import { alternativesFor, forgetAlternatives } from '../services/alternativeCache'
import type { Alternative, CongestionLevel, NearbyPlace } from '../types/api'
import { ChevronRight } from './icons'
import { CongestionBadge } from './CongestionBadge'
import { LEVEL_SOLID } from './levelStyles'
import { formatMonthDay } from '../utils/date'
import { withJosa } from '../utils/josa'
import { useScrollLock } from '../hooks/useScrollLock'

/**
 * 원래 자리가 그날 어떤지 한 마디로. 배지의 등급 이름(한적·보통·붐빔)을 <b>문장에 넣을 수
 * 있는 꼴</b>로 바꾼 것이다.
 *
 * <p>등급 자체를 새로 만들지 않는다 — 서버가 정한 세 단계를 그대로 쓰고 어미만 붙인다.
 * 여기서 "조금 붐벼요"와 "많이 붐벼요"를 임의로 가르면 화면이 서버가 재지 않은 것을
 * 말하게 된다.
 */
const LEVEL_PHRASE: Record<CongestionLevel, string> = {
  QUIET: '한적할 것 같아요',
  MODERATE: '조금 붐빌 것 같아요',
  CROWDED: '많이 붐빌 것 같아요',
}

/**
 * 한 번에 보여줄 대안 수. <b>이 숫자가 추천 분산의 세기를 정한다.</b>
 *
 * <h3>왜 8에서 줄였나 (2026-08-26)</h3>
 * 서버는 자격 후보들 중에서 가중 무작위로 이만큼을 뽑는다. 그런데 <b>요청 수가 후보 수보다
 * 크거나 같으면 전부 뽑히므로 뽑기가 고를 것이 없다</b> — 실측상 자격 후보가 8곳 이하인
 * 자리가 89.2%였다. 분산 장치가 대부분의 장소에서 아무 일도 하지 않고 있었다.
 *
 * <p>같은 자리를 40번씩 불러 실제로 재 봤다(서귀포해양도립공원·가새기오름·경주 동부
 * 사적지대·협재해수욕장, 자격 후보 10~20곳):
 *
 * <pre>
 *   요청 8 → 1등이 같은 곳으로 나온 비율 95~100%
 *   요청 5 → 90~98%   (거의 나아지지 않는다)
 *   요청 3 → 68~82%
 * </pre>
 *
 * <p>5는 8과 다를 바가 없어서 3으로 내렸다. 후보 수를 넘지 않아야 뽑기가 일한다.
 *
 * <h3>정렬을 걷어내고서야 실제로 일했다</h3>
 * 3으로 내린 것만으로는 부족했다. <b>뽑은 뒤 추천도 순으로 다시 정렬</b>하고 있어서,
 * 최고점이 뽑히기만 하면 언제나 맨 위로 올라왔기 때문이다. 서버에서 그 정렬을 걷어내자
 * 위 표의 68~82%가 <b>38~42%</b>로 내려갔다.
 *
 * <p>지금 화면이 하는 정렬은 <b>구간 단위뿐</b>이다({@link tierRank}) — 점수로 줄
 * 세우지 않으므로 분산이 살아 있고, 카드에 적힌 문구와 순서가 어긋나지도 않는다.
 * 자세한 사정은 {@code CLAUDE.md}의 "추천 분산".
 */
const ALTERNATIVE_COUNT = 3

interface Props {
  /** 교체 대상 장소 */
  originName: string
  originPlaceId: string
  /**
   * 지금 이 자리의 한적도와 등급. <b>둘 다 null이면 시트가 다른 모드로 열린다.</b>
   *
   * 후보를 절대 점수로만 보여주면 "이게 지금보다 나은가"를 사용자가 암산해야 한다.
   * 특히 원래 자리가 이미 한적한 경우, 후보 중에 더 붐비는 곳이 섞여 있을 수 있다.
   *
   * <b>null인 경우</b>: 음식점·숙박처럼 공사가 예측하지 않는 장소다. 한적도를 모르면
   * 추천도를 매길 수 없으므로(추천도는 한적도를 가장 크게 품는 값이다) 추천 대신
   * <b>가까운 같은 분류 장소</b>를 거리만 붙여 보여준다.
   */
  originQuietness: number | null
  originLevel: CongestionLevel | null
  /** 그 자리를 방문하는 날짜. 같은 후보라도 날짜에 따라 한적도가 다르다 */
  visitDate: string
  /**
   * 여행 지역 이름(경주·제주시·서귀포시). <b>제목이 이 말로 범위를 밝힌다.</b>
   *
   * <p>후보는 언제나 이 지역 안에서만 나온다(검색·대안 모두 지역으로 잠겨 있다).
   * 그러면서 제목은 "다른 곳"이라고만 말해, 어디까지 뒤진 결과인지 화면이 밝히지 않았다 —
   * 이미 지키고 있는 약속을 말하지 않고 있었던 셈이다.
   *
   * <p>⚠️ 슬러그를 넘기지 않는다. {@code regionNameOf}는 모르는 슬러그에 빈 문자열을
   * 주므로, 여기서 다시 조회하면 이 컴포넌트가 그 빈 값을 처리할 책임까지 지게 된다.
   * 이름을 받아 두면 비었는지 한 번만 보면 된다.
   */
  regionName: string
  /**
   * 이미 <b>여행에</b> 담겨 있는 장소들. 후보에서 빼야 같은 곳이 두 번 들어가지 않는다.
   *
   * <p>⚠️ <b>그 날치가 아니라 전체다.</b> 한때 해당 일차만 넘겨서, Day 1에 담은 곳이
   * Day 2 추천에 떴다. 서버로도 보내고 받은 목록에서도 한 번 더 거른다 —
   * 서버가 걸러 주더라도 화면이 들고 있는 코스가 더 최신일 수 있다.
   */
  excludePlaceIds: string[]
  /**
   * 여행 조건(지역·시작일·기간) 열쇠.
   *
   * 서버가 대안을 <b>가중 무작위</b>로 뽑기 때문에, 같은 자리를 다시 물으면 다른 답이 온다.
   * 시트를 닫았다 열 때마다 목록이 바뀌면 되돌아갈 후보를 찾지 못하므로 화면이 결과를
   * 들고 있는다. 이 값이 바뀌면(날짜를 옮기는 등) 들고 있던 것을 버린다.
   */
  planKey: string
  onClose: () => void
  onSelect: (placeId: string) => void
}

/**
 * 불러온 결과.
 *
 * 대안과 근처 장소를 <b>한 배열로 합치지 않는다.</b> 대안에는 점수와 근거가 있고
 * 근처 장소에는 거리뿐이라, 합치면 어느 쪽이든 절반이 빈 항목이 된다.
 * 화면은 그 빈 자리를 "아직 안 온 값"으로 읽는다.
 */
type LoadState =
  | { phase: 'loading' }
  | {
      phase: 'loaded'
      alternatives: Alternative[]
      emptyMessage: string | null
    }
  | { phase: 'nearby'; nearby: NearbyPlace[] }
  | { phase: 'error'; message: string }

/**
 * 거리 표기.
 *
 * 1km 미만은 미터로 적는다 — "0.4km"보다 "420m"가 걸어갈 만한 거리인지 판단하기 쉽다.
 * 10m 단위로 끊는 것은 직선거리라 그보다 정밀하게 말할 근거가 없어서다.
 */
function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round((km * 1000) / 10) * 10}m`
  }
  return `${km.toFixed(1)}km`
}

/**
 * 추천도 구간의 경계. <b>실측 분포에서 가져온 값이지 임의로 고른 수가 아니다.</b>
 *
 * <p>배포 서버에서 3개 지역 60곳의 대안 150건을 받아 재 보니
 * {@code 범위 25~80 · 중앙 53 · 사분위 46 / 54 / 64}였다
 * (docs/OPEN_DECISIONS.md 16번). 이 둘은 그 <b>1분위수와 3분위수</b>다 —
 * 대략 상위 25% / 가운데 50% / 하위 25%로 갈린다.
 *
 * <p>임의의 수(70/50 같은)를 쓰지 않은 이유: 추천도는 구조상 100이 나올 수 없어
 * ({@code 0.7 × 한적도 + 0.3 × 근접도}, 한적도 100과 거리 0km가 동시에 성립해야 한다)
 * 실측 최고가 80이다. 100점 만점 감각으로 경계를 잡으면 <b>거의 모든 후보가 최하 구간</b>에
 * 몰려 문구가 아무것도 가르지 못한다. 그 오해를 풀려고 넣는 문구가 오해를 그대로 옮기는 셈이다.
 */
const TIER_GOOD_MIN = 64
const TIER_FAIR_MIN = 46

/**
 * 추천도를 <b>말 한 마디로</b> 옮긴다.
 *
 * <h3>왜 숫자를 전면에서 내렸나</h3>
 * 추천도 62를 사람은 100점 만점으로 읽는다. 그런데 이 값은 만점이 80쯤인 척도라
 * 중앙값 53이 낙제로 보이고, "그럼 왜 이걸 추천했지?"가 된다. 실제로는
 * <b>150건이 예외 없이 개선폭 하한(5점)을 통과했고 향상폭 중앙값이 22점</b>이었다 —
 * 낮은 점수도 지금 자리보다는 한적하다.
 *
 * <p>⚠️ 그렇다고 숫자를 지우지 않는다. 항목별 점수·반영 비율과 함께
 * <b>펼쳐보기 안</b>에 그대로 있다(CLAUDE.md 추천도 구성 내역).
 * <b>사용자는 문구로 읽고, 심사위원은 펴서 근거를 본다.</b>
 *
 * <h3>⚠️ "지금"이라고 쓰지 않는다</h3>
 * 상위 구간 문구가 한때 <b>"지금 가기 좋아요"</b>였다(2026-08-30에 고침).
 * 여기서 다루는 것은 지금이 아니라 {@code visitDate} — 예측 창이 앞으로 24~29일이라
 * <b>대개 미래 날짜다.</b> "지금 가기 좋다"고 하면 오늘의 이야기로 읽히고,
 * 그러면 <b>이 카드의 모든 숫자가 오늘 것으로 오해된다.</b>
 *
 * <p>"이날"이 가리키는 날은 시트 머리글이 이미 적어 두었다
 * ("9월 5일은 많이 붐빌 것 같아요"). 화면 안에서 말이 이어진다.
 *
 * <p>홈 카드에서 "오늘의 여행"을 걷어낸 것, 시트 머리글에 "오늘은"을 쓰지 않는 것과
 * 같은 규칙이다 — <b>화면이 시점을 틀리게 말하면 그 아래 숫자들도 같이 의심받는다.</b>
 *
 * <h3>⚠️ 가장 낮은 구간에는 말을 붙이지 않는다 (null)</h3>
 * 하위 25%에 어울리는 <b>정직한 칭찬이 없다.</b> "그럭저럭"류는 깎아내리는 말이고,
 * 좋게 말하면 없는 것을 지어낸다. 그래서 <b>말을 하지 않고 수식만 남긴다</b> —
 * 숫자는 그대로 보이므로 감추는 것이 아니고, 화면이 하지 않을 말을 억지로 하지도 않는다.
 *
 * <p>그 카드는 이름부터 시작해 한 겹 조용해진다. 상위 후보와 <b>무게가 갈리는 것
 * 자체가 신호</b>다 — 세 카드를 나란히 놓으면 어디에 말이 붙었는지가 먼저 보인다.
 *
 * <h3>말을 고른 기준</h3>
 * 별점(★)을 쓰지 않는다. 추천도는 <b>장소의 평점이 아니라 관계값</b>이고
 * ("그 자리에 얼마나 맞는가"), 별은 관습적으로 평점으로 읽혀 우리가 재지 않은 것을
 * 말하게 된다.
 *
 * <h3>맨 위 구간에만 반짝임을 붙인다 (2026-09-01)</h3>
 * "이날 가기 좋아요"와 "이런 곳도 있어요"가 <b>글자만으로는 잘 안 갈렸다.</b> 둘 다
 * 같은 색·같은 크기의 짧은 칭찬이라, 카드를 훑을 때 어느 쪽이 위인지 읽어야 알았다.
 *
 * <p><b>둘 다에 붙이지 않는다.</b> 개수로 세기(✨✨ / ✨)를 해 봤다가 걷어냈다 —
 * 개수가 곧 등급이 되면 <b>척도로 읽히기 시작한다.</b> 위의 "별점을 쓰지 않는다"가
 * 막으려던 것이 정확히 그것이다. 하나만 붙이면 세는 것이 아니라 <b>있고 없고</b>가 되어,
 * "맨 위 구간에만 표시가 붙는다"는 뜻이 그대로 남는다.
 *
 * <p>아래 구간이 <b>말은 그대로 두고 표시만 없는 것</b>도 같은 규칙의 연장이다.
 * 최하 구간이 문구 자체를 갖지 않는 것처럼, 여기서도 <b>덜어내는 것으로</b> 층을 가른다 —
 * 깎아내리는 말을 새로 지어내지 않는다.
 *
 * <p><b>글자 뒤에 붙인다.</b> 앞에 두면 카드에서 <b>가장 먼저 읽히는 것이 반짝임</b>이
 * 된다 — 이 카드는 이름부터 읽혀야 하고 구간 문구조차 그다음이다. 뜻을 나르지 않는
 * 장식이 첫 자리를 가져가면 목록이 다시 "무엇이 제일 반짝이나"를 고르는 화면이 된다
 * (숫자를 전면에서 내린 이유와 같다).
 *
 * <p>반짝임은 <b>장식</b>이라 화면 낭독기에서는 감춘다({@code aria-hidden}).
 * 뜻은 앞의 말이 이미 전부 담고 있다.
 *
 * <p>⚠️ <b>언젠가 서버로 옮길 값이다.</b> 반영 비율이 바뀌면 분포가 통째로 움직이는데,
 * 경계를 화면이 들고 있으면 따라오지 않는다 — 반영 비율을 서버가 내려보내는 것과
 * 같은 이유다. 지금은 계산 로직을 건드리지 않기로 해 화면에 둔다.
 */
function tierPhrase(recommendation: number): { mark: string | null; text: string } | null {
  if (recommendation >= TIER_GOOD_MIN) return { mark: '✨', text: '이날 가기 좋아요' }
  if (recommendation >= TIER_FAIR_MIN) return { mark: null, text: '이런 곳도 있어요' }
  return null
}

/**
 * 구간의 서열. 낮을수록 위에 선다.
 *
 * <h3>왜 구간으로만 줄 세우나 (2026-08-30)</h3>
 * 서버는 <b>뽑은 결과를 점수순으로 다시 세우지 않는다.</b> 그렇게 하면 최고점이 언제나
 * 1등이 되어 추천 분산이 죽기 때문이다 — 실측에서 1등 고정률이 38~42%에서
 * <b>68~82%로 뛰었다</b>(CLAUDE.md "추천 분산"). 같은 대안이 모두에게 1등으로
 * 나가면 그곳이 새로운 혼잡지가 된다(2차 오버투어리즘).
 *
 * <p>그런데 구간 문구를 화면에 세우면서 <b>새 문제가 생겼다.</b> 문구는 눈에 보이므로
 * 순서가 뒤집히면 고장으로 읽힌다:
 *
 * <pre>
 *   (문구 없음)        45
 *   이날 가기 좋아요    66   ← 아래가 더 좋아 보인다
 * </pre>
 *
 * 점수 82 아래 79가 서는 것은 티가 안 났지만(비슷한 수), 말은 다르다.
 * 실측상 맨 위가 최고점이 아닌 자리가 <b>22곳 중 7곳(32%)</b>이었다.
 *
 * <h3>구간까지만 세우면 둘 다 지켜진다</h3>
 * <b>정렬 기준이 곧 화면에 보이는 값</b>이 된다(CLAUDE.md) — 줄 세운 것이 점수가 아니라
 * 카드에 적힌 문구 그 자체다. 그러면서 <b>같은 구간 안에서는 뽑힌 순서가 그대로 남는다.</b>
 * {@code Array.prototype.sort}가 안정 정렬(ES2019~)이라 공짜로 따라온다.
 *
 * <p>세 후보가 같은 구간이면 <b>정렬이 아무 일도 하지 않는다</b> — 상위 Pool에서 뽑은
 * 셋이라 흔한 경우다. 분산이 죽는 것은 점수순 정렬이지 구간 정렬이 아니다.
 *
 * <p>⚠️ <b>점수순으로 되돌리지 말 것.</b> 구간이 같으면 71점이 66점 아래 설 수 있는데,
 * 그것이 의도다. 두 카드가 화면에서 <b>같은 말을 하고 있으므로</b> 순서가 설명을
 * 어기지 않는다.
 */
function tierRank(recommendation: number): number {
  if (recommendation >= TIER_GOOD_MIN) return 0
  if (recommendation >= TIER_FAIR_MIN) return 1
  return 2
}

/**
 * 대안 후보를 보여주는 패널.
 *
 * 모바일에서는 아래에서 올라오는 시트, 1024px부터는 화면 가운데 모달이다.
 * 좁은 화면에서는 엄지가 닿는 아래쪽에서 올라오는 편이 자연스럽고,
 * 넓은 화면에서는 아래에 붙은 시트가 화면 한쪽에만 몰려 어색해진다.
 * 마크업은 하나로 두고 정렬·모서리·그림자만 클래스로 갈랐다.
 *
 * 후보마다 <b>추천 근거를 반드시 함께</b> 보여준다. 점수만 나열하면 사용자는
 * 왜 이곳이 추천됐는지 알 수 없고, 서비스가 데이터를 어떻게 썼는지도 드러나지 않는다.
 */
export function AlternativeSheet({
  originName,
  originPlaceId,
  originQuietness,
  originLevel,
  visitDate,
  regionName,
  excludePlaceIds,
  planKey,
  onClose,
  onSelect,
}: Props) {
  const [load, setLoad] = useState<LoadState>({ phase: 'loading' })
  const panelRef = useRef<HTMLDivElement>(null)

  /**
   * 점수를 매길 수 없는 자리인가.
   *
   * 진단 화면이 한적도를 넘겨주지 못했다는 뜻이고, 그런 장소는 음식점·숙박처럼
   * 공사 예측 대상이 아니다. 추천 대신 <b>가까운 같은 분류 장소</b>를 보여준다.
   */
  const nearbyMode = originQuietness === null || originLevel === null

  /**
   * 다시 뽑아 달라고 요청한 횟수.
   *
   * 이 값이 바뀔 때만 새로 뽑는다. 화면이 다시 그려지는 것과 사용자가 새 추천을 원하는 것은
   * 다른 일이라, 둘을 구분하지 않으면 목록이 제멋대로 바뀐다.
   */
  const [redrawCount, setRedrawCount] = useState(0)

  // 시트가 화면을 다 덮지 않아 아래로 뒤 화면이 비친다 — 잠그지 않으면 그 부분이 따로 스크롤된다.
  // ⚠️ body가 아니라 html에 건다 — 그래야 sticky가 얼지 않는다(useScrollLock 주석).
  useScrollLock()
  useEffect(() => {
    const controller = new AbortController()

    /*
     * 근처 장소는 <b>캐시하지 않는다.</b> 대안 캐시(alternativesFor)는 서버가 매번 다르게
     * 뽑는 것을 붙잡아 두려고 있는 장치인데, 여기에는 무작위가 없어 같은 요청이면 늘 같은 답이다.
     */
    const request = nearbyMode
      ? fetchNearby(originPlaceId, 8, controller.signal).then((result) => {
          const selectable = result.filter(
            (item) => !excludePlaceIds.includes(item.place.id),
          )
          setLoad({ phase: 'nearby', nearby: selectable })
        })
      : alternativesFor(planKey, originPlaceId, visitDate, () =>
          fetchAlternatives(
            originPlaceId,
            visitDate,
            ALTERNATIVE_COUNT,
            excludePlaceIds,
            controller.signal,
          ),
        ).then((result) => {
          // 이미 그 날에 담긴 곳은 고를 수 없으므로 아예 보여주지 않는다.
          /*
           * 구간 단위로만 세운다({@link tierRank}). 뽑힌 순서를 통째로 덮지 않으려고
           * 안정 정렬에 기댄다 — 같은 구간이면 서버가 뽑은 차례 그대로다.
           *
           * ⚠️ {@code sort}는 제자리 정렬이라 <b>거르기를 먼저 한 것이 중요하다.</b>
           * {@code filter}가 새 배열을 주므로 여기서 뒤집는 것은 그 사본이다 —
           * {@code result.alternatives}는 대안 캐시가 들고 있는 배열이라
           * 직접 정렬하면 캐시의 내용이 바뀐다.
           */
          const selectable = result.alternatives
            .filter((item) => !excludePlaceIds.includes(item.place.id))
            .sort((a, b) => tierRank(a.recommendation) - tierRank(b.recommendation))
          /*
           * 목록이 왜 비었는지는 서버가 말한다. 원래 자리가 이미 한적해서 비는 것과
           * 대신할 곳을 못 찾아서 비는 것은 정반대의 소식이라, 한 문장으로 뭉개면
           * 잘 고른 사용자에게 서비스가 못했다고 사과하는 꼴이 된다.
           *
           * 다만 걸러낸 것이 우리 쪽 사정(이미 코스에 담긴 곳)일 때는 서버 문구가 맞지 않는다.
           * 서버는 후보를 줬는데 화면이 뺀 것이라, "못 찾았다"고 말하면 거짓말이 된다.
           */
          const emptyMessage =
            selectable.length > 0
              ? null
              : result.alternatives.length > 0
                ? '남은 후보가 이미 이 날 코스에 담겨 있어요.'
                : result.statusMessage
          setLoad({ phase: 'loaded', alternatives: selectable, emptyMessage })
        })

    request
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
        setLoad({
          phase: 'error',
          message:
            error instanceof ApiRequestError
              ? error.message
              : nearbyMode
                ? '가까운 장소를 불러오지 못했습니다.'
                : '대안을 불러오지 못했습니다.',
        })
      })

    return () => controller.abort()
    // excludePlaceIds는 배열이라 매 렌더 새 참조가 될 수 있어 의존성에서 뺀다.
    // 시트는 열릴 때 한 번만 받으면 되고, 여는 동안 담긴 목록은 바뀌지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originPlaceId, visitDate, planKey, redrawCount, nearbyMode])

  /** 사용자가 명시적으로 새 추천을 요청했을 때만 다시 뽑는다. */
  function handleRedraw() {
    forgetAlternatives(originPlaceId, visitDate)
    setLoad({ phase: 'loading' })
    setRedrawCount((count) => count + 1)
  }

  // 열리면 시트로 초점을 옮긴다. 키보드 사용자가 시트 밖에 남아 있으면 안 된다.
  useEffect(() => {
    panelRef.current?.focus()
  }, [])

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKey)


    return () => {
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  return (
    <div
      className="sheet-dim fixed inset-0 z-100 flex items-end justify-center bg-[rgb(42_62_84/0.42)] lg:items-center lg:p-6"
      onClick={onClose}
    >
      {/*
        내용 영역 클릭이 배경까지 올라가면 시트가 닫힌다.
        키보드 사용자는 Escape로 닫으므로 이 div에는 역할을 주지 않는다.

        화면을 다 덮지 않는다 — 뒤에 있는 코스가 조금 보여야 맥락을 잃지 않는다.

        overflow-hidden: 안쪽 내용을 둥근 모서리에 맞춰 자른다.
        없으면 헤더(bg-surface)의 각진 위 모서리가 패널의 둥근 윤곽 밖으로 삐져나온다.
        넓은 화면에서는 헤더에도 lg:rounded-t가 걸려 가려졌지만, 그 아래에서는
        손잡이 표시 바로 다음에 각진 흰 면이 시작돼 그대로 드러났다.
        모서리를 자식마다 맞추는 대신 부모가 한 번 자르게 한다 — 자식이 늘어도 따라온다.
      */}
      <div
        ref={panelRef}
        className="sheet-panel dialog-panel bg-bg flex max-h-[84svh] w-full max-w-[560px] flex-col overflow-hidden rounded-t-[24px] shadow-[0_-10px_40px_rgb(42_62_84/0.24)] focus-visible:outline-none lg:max-h-[76svh] lg:rounded-[24px] lg:shadow-[0_24px_60px_rgb(42_62_84/0.28)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        {/* 아래에서 올라온 시트임을 알리는 손잡이 표시.
            모달일 때는 끌어올릴 것이 없으므로 감춘다. */}
        <div className="flex flex-none justify-center pt-2.5 lg:hidden">
          <span className="bg-line h-1 w-9.5 rounded-full" aria-hidden="true" />
        </div>

        <header className="border-line bg-surface flex flex-none flex-col gap-2 border-b px-4.5 pt-3.5 pb-3.5 lg:rounded-t-[24px] lg:px-6 lg:pt-5.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              {/*
                ■ 킥커에 기능 이름을 세운다

                <b>PLACE OFF</b>는 서비스 이름(PEAKOFF)에서 갈라져 나온 말이고,
                날짜 쪽은 TIME OFF, 설문은 FULL PEAKOFF다. 화면마다 이름을 붙여 두면
                사용자가 "이 서비스에는 이런 갈래가 있다"를 알게 되고, 발표에서도
                화면을 가리켜 같은 이름으로 말할 수 있다.

                ⚠️ 뒤에 "· 다른 곳 둘러보기"를 붙였다가 뺐다. 바로 아래 제목이
                "…다른 경주를 둘러볼까요?"라 <b>같은 말이 두 줄 연달아</b> 섰다.
                진단 화면의 TIME OFF도 이름만 서 있어 그쪽과 모양이 맞는다.
              */}
              <span className="text-brand-deep text-[12px] font-semibold">
                PLACE OFF
              </span>
              {/*
                ⚠️ <b>"오늘은"이라고 쓰지 않는다.</b> 여기서 다루는 것은 오늘이 아니라
                {@code visitDate}(그 자리를 방문하는 날)의 예측이다. 대개 미래 날짜다.
                홈 카드에서 "오늘의 여행"을 걷어낸 것과 같은 이유 — 화면이 시점을 틀리게
                말하면 그 아래 숫자들도 같이 의심받는다.
              */}
              {/*
                ■ 제목이 <b>범위</b>를 말한다 — "다른 곳"이 아니라 "다른 경주"

                후보는 <b>언제나 이 여행의 지역 안</b>에서만 나온다. 그런데 제목이
                "다른 곳도"라고만 말해, 사용자는 그 범위를 알 길이 없었다 —
                전국을 뒤진 것인지 이 도시 안인지에 따라 목록을 읽는 눈이 달라진다.
                지역명을 넣으면 <b>이미 지키고 있는 약속</b>이 화면에 드러난다.

                <p>"다른 경주"는 장소를 세는 말이 아니라 <b>같은 도시의 다른 얼굴</b>을
                가리키는 말이라, 이 시트가 하는 일(붐비는 한 곳을 이 지역 안에서 바꿔 끼우는 일)과
                뜻이 맞는다.

                <p>⚠️ 조사를 글자로 박지 않는다. 지금 세 지역은 모두 받침이 없어 "를"이지만,
                받침으로 끝나는 지역이 하나만 늘어도(부산<b>을</b>) 이 줄이 비문이 된다.

                <p>⚠️ 지역명이 비면 <b>옛 문구로 돌아간다.</b> {@code regionNameOf}는 모르는
                슬러그에 빈 문자열을 주는데, 그대로 이으면 "다른 를 둘러볼까요?"가 된다.

                <p>두 모드가 <b>같은 자리에서 줄을 바꾼다.</b> 장소 이름은 길이가 제각각이라
                (첨성대 · 경주 동부 사적지대) 흐르는 대로 두면 어디서 접힐지 알 수 없다.
                쉼표에서 끊으면 <b>윗줄은 지금 자리, 아랫줄은 제안</b>으로 역할이 갈린다.
              */}
              <h2
                id="sheet-title"
                className="text-fg m-0 text-[19px] leading-[1.35] font-bold tracking-[-0.015em] text-pretty"
              >
                {originName} 말고,
                <br />
                {nearbyMode
                  ? '가까운 곳을 볼까요?'
                  : regionName
                    ? `다른 ${withJosa(regionName, '을/를')} 둘러볼까요?`
                    : '다른 곳도 둘러볼까요?'}
              </h2>
            </div>
            <button
              type="button"
              className="press touch-hitbox text-muted hover:bg-line/60 rounded-chip grid h-8.5 w-8.5 flex-none cursor-pointer place-items-center bg-transparent text-base"
              onClick={onClose}
              aria-label="닫기"
            >
              ✕
            </button>
          </div>
          {/*
            원래 자리가 그날 어떤지 <b>문장으로</b> 말한다. 후보 옆의 점수가 무엇을 기준으로
            한 값인지 알려면 이 값이 필요한데, "지금 [붐빔 24]"처럼 배지만 두면
            그 24가 무엇인지 사용자가 스스로 옮겨 읽어야 했다.

            ⚠️ <b>"지금"이 아니다.</b> 집중률은 예측값이고 우리가 묻는 것은 방문 예정일이다.
            날짜를 적어 두면 아래 후보들의 한적도가 <b>같은 날 기준</b>이라는 것도 함께 전해진다.

            점은 색 자체가 신호인 자리라 {@code LEVEL_SOLID}를 쓴다. 색만 두면 색각 이상에서
            갈리지 않으므로 <b>등급 이름과 한적 지수를 글자로 함께</b> 적는다 —
            CLAUDE.md가 3단계를 색과 명도로 함께 가르는 것과 같은 이유다.

            ⚠️ <b>"한적도"가 아니라 "한적 지수"다.</b> 코드와 문서는 이 값을 한적도라 부르지만
            화면에 서는 이름은 줄곧 "한적 지수"였다(홈·마이페이지·진단·저장 카드·약관).
            여기만 안쪽 이름이 새어 나와 있었고, 바로 아래 개선폭이 "한적 지수 +33"이 되면서
            <b>같은 수의 이름이 한 시트 안에서 둘</b>이 될 참이었다.
          */}
          {originLevel !== null && originQuietness !== null && (
            <p className="text-muted m-0 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px]">
              <span
                className={`h-2.5 w-2.5 flex-none rounded-full ${LEVEL_SOLID[originLevel]}`}
                aria-hidden="true"
              />
              {/*
                날짜 뒤에 "은"을 붙여 쓴다. formatMonthDay는 늘 "…일"로 끝나고
                "일"에는 받침이 있어 조사가 갈릴 일이 없다 — 다른 날짜 포맷을 넣으려거든
                이 조사를 함께 봐야 한다.
              */}
              {formatMonthDay(visitDate)}은
              <span className="text-fg font-semibold">{LEVEL_PHRASE[originLevel]}</span>
              <span className="text-hint">· 한적 지수 {originQuietness}</span>
            </p>
          )}
          {/*
            무엇을 기준으로 줄 세웠는지 첫 줄에서 밝힌다.

            근처 모드에서는 <b>추천이라고 말하지 않는다.</b> 예상 혼잡을 모르는 곳이라
            "여기가 더 낫다"고 할 근거가 없다. 우리가 아는 것(분류·거리)만 말하고
            <b>고르는 판단은 사용자에게 남긴다</b> — 계산하지 않은 것을 근거로 말하지 않는다.

            ⚠️ <b>"추천도가 높은 순"이라고 쓰지 않는다.</b> 목록은 <b>구간</b>으로만
            줄 세운다({@link tierRank}) — 같은 구간 안은 서버가 가중 무작위로 뽑은
            차례 그대로라 71점이 66점 아래 설 수 있다. 점수순이라고 적으면 화면이
            거짓말을 하는 셈이고, 그 자리에 굳이 다른 말을 세울 필요도 없다.
            <b>순서를 설명하는 것은 카드마다 적힌 구간 문구다.</b>

            <h3>목록이 매번 달라진다는 안내는 <b>여기가 아니다</b> (2026-08-30 되살림)</h3>
            한때 둘째 줄이 <b>"다시 찾으면 다른 곳이 보일 수 있어요"</b>였다가 빠졌고,
            지금은 목록 아래 <b>"다른 곳도 볼래요" 버튼 위</b>에 서 있다.

            <p>헤더는 후보를 읽기 <b>전에</b> 보는 곳이라 "믿을 게 못 된다"는 인상을 먼저 주고,
            버튼 위면 다시 뽑을 마음이 든 사람에게 그 말이 닿는다.
            {@code CLAUDE.md}의 "추천 분산" 참고.
          */}
          {/*
            ⚠️ <b>붐비는 자리에서는 아무 말도 하지 않는다.</b> "더 여유롭게 즐길 수 있는
            장소들로 찾아봤어요"가 있었는데, 바로 위 상태 줄("9월 5일은 많이 붐빌 것
            같아요")과 아래 후보 카드들이 이미 그 말을 하고 있었다.

            <p>남은 두 갈래는 <b>말하지 않으면 알 수 없는 것</b>이라 남긴다 —
            근처 모드는 "왜 추천이 아니라 거리순인가"를, 붐비지 않는 자리는
            "원래 자리가 이미 괜찮다"를 알린다. 둘 다 화면의 다른 것으로는 유추되지 않는다.
          */}
          {originLevel !== 'CROWDED' && (
            <p className="m-0 text-[13px] leading-[1.6] text-pretty whitespace-pre-line">
              {nearbyMode
                ? '예상 혼잡을 알 수 없는 곳이라 추천 순서를 매기지 못해요.\n같은 분류에서 가까운 순으로 보여드릴게요.'
                : '지금도 크게 붐비지는 않는 곳이에요.\n그래도 더 여유로운 곳이 있는지 찾아봤어요.'}
            </p>
          )}
        </header>

        {/* overscroll-contain: 목록을 끝까지 내려도 스크롤이 뒤 페이지로 넘어가지 않는다 */}
        <div className="overscroll-contain flex-1 overflow-y-auto px-4 py-4 lg:px-5">
          {load.phase === 'loading' && (
            <p className="py-6 text-center text-sm">후보를 찾는 중…</p>
          )}
          {load.phase === 'error' && (
            <p className="text-crowded-deep py-6 text-center text-sm whitespace-pre-line">{load.message}</p>
          )}

          {/*
            빈 목록에도 이유가 붙는다. 서버가 원래 장소보다 뚜렷하게 한적한 곳만 담기 때문에
            비는 일이 흔한데, "이미 한적해서"와 "못 찾아서"는 사용자에게 정반대의 말이다.
            문구를 서버가 들고 있는 이유는 임계값을 서버에 두는 것과 같다 —
            판단의 근거와 그것을 설명하는 말이 갈라지면 한쪽만 바뀐다.
          */}
          {load.phase === 'loaded' && load.alternatives.length === 0 && (
            <p className="py-6 text-center text-sm whitespace-pre-line">
              {load.emptyMessage ?? '추천할 만한 다른 곳을 찾지 못했어요.'}
            </p>
          )}

          {/*
            반경 밖이거나 같은 분류가 없을 때. 억지로 먼 곳을 채우지 않는다 —
            5km 밖의 밥집은 같은 코스의 같은 칸을 대신할 수 없다.
          */}
          {load.phase === 'nearby' && load.nearby.length === 0 && (
            <p className="py-6 text-center text-sm">
              근처에 같은 분류의 다른 장소를 찾지 못했어요.
            </p>
          )}

          {/*
            ■ 근처 목록은 <b>카드가 아니라 줄</b>이다 (2026-08-30)

            대안 카드와 같은 모양이었다 — 18px 둥근 카드에 그림자, 22px짜리 큰 거리,
            그리고 카드마다 44px짜리 "이곳으로 갈래요" 버튼. <b>여덟 개가 쌓이니
            시트가 1000px을 넘겼다.</b>

            <p>그런데 이 목록이 들고 있는 것은 <b>이름·분류·거리 셋뿐</b>이다.
            대안 카드는 구간 문구·한적 배지·개선폭·근거 문장·구성 내역을 담느라 큰 것인데,
            정보가 1/3인 목록이 같은 크기를 쓰고 있었다. <b>크기가 내용과 어긋나면
            "여기에 뭔가 더 있나" 하고 읽을 것을 찾게 된다.</b>

            <h3>줄 전체를 버튼으로</h3>
            항목마다 버튼을 따로 두면 <b>한 줄에 누를 곳이 둘</b>이라(카드와 버튼)
            높이가 두 배가 된다. 고를 것밖에 없는 목록이므로 줄 자체가 버튼이면 된다.
            꺾쇠(›)가 "눌러서 넘어간다"를 말한다.

            <p>실수로 눌러도 <b>되돌릴 수 있다</b> — 교체된 자리에는 진단 화면이
            "되돌리기" 버튼을 세운다({@code handleRevert}). 되돌릴 길이 없었다면
            버튼을 따로 두어 한 번 더 묻는 편이 맞다.

            <h3>큰 거리 숫자를 내린 이유</h3>
            22px이었던 것은 <b>대안 카드의 추천도 자리를 거리가 이어받는다</b>는 뜻이었다.
            그런데 그 추천도가 펼쳐보기 안으로 들어가면서 <b>이어받을 자리가 사라졌다.</b>
            지금은 혼자만 큰 숫자다. "직선거리"라는 이름표도 뗐다 — 시트 머리글이
            "같은 분류에서 가까운 순"이라고 이미 말했고, 옆에 km가 붙어 있다.
            <b>화면에서 읽히지 않는 것만 스크린리더에 남긴다.</b>
          */}
          {load.phase === 'nearby' && load.nearby.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {load.nearby.map((item) => (
                <li key={item.place.id}>
                  <button
                    type="button"
                    className="press border-line bg-surface hover:border-brand hover:bg-bg rounded-ui flex w-full cursor-pointer items-center gap-3 border px-3.5 py-2.5 text-left"
                    onClick={() => onSelect(item.place.id)}
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-fg truncate text-[14.5px] leading-[1.35] font-semibold tracking-[-0.01em]">
                        {item.place.name}
                      </span>
                      {/*
                        배지가 없다. 등급을 붙이려면 한적도가 있어야 하고, 없는 값에
                        아무 등급이나 얹으면 그 자체가 거짓말이 된다.
                      */}
                      <span className="text-hint text-[12px]">
                        {item.place.categoryName}
                      </span>
                    </span>

                    {/* 목록을 줄 세운 값이 이 숫자다 */}
                    <span className="text-fg flex-none font-mono text-[13px] font-semibold">
                      <span className="sr-only">직선거리 </span>
                      {formatDistance(item.distanceKm)}
                    </span>
                    <ChevronRight size={15} className="text-hint flex-none" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {load.phase === 'nearby' && load.nearby.length > 0 && (
            <button
              type="button"
              className="text-hint mt-2.5 h-11 w-full cursor-pointer bg-transparent text-[13.5px] font-medium"
              onClick={onClose}
            >
              그대로 둘게요
            </button>
          )}


          {load.phase === 'loaded' && load.alternatives.length > 0 && (
            <ul className="flex flex-col gap-2.5">
              {load.alternatives.map((alternative) => {
                /*
                  지금 자리보다 얼마나 한적해지는가.

                  <b>서버에 요청을 더 하지 않는다</b> — 원래 자리의 한적도는 진단 화면이
                  이미 넘겨준 값({@code originQuietness})이고, 후보의 한적도는 응답에 있다.
                  뺄셈은 화면에서 한다. 점수 산출식과는 무관한 표시용 수치라
                  서버가 내려보낼 것이 없다.

                  <p>{@code originQuietness}가 null인 자리는 이 목록 자체가 뜨지 않는다
                  (근처 모드로 갈린다). 그래도 null을 받아 두는 것은 타입이 그렇게 생겨서이고,
                  값이 없으면 <b>아무 말도 하지 않는다.</b>
                */
                const quietnessGain =
                  originQuietness === null ? null : alternative.quietness - originQuietness

                /* 하위 구간이면 null이다 — 그 카드에는 문구 줄이 서지 않는다 */
                const phrase = tierPhrase(alternative.recommendation)

                return (
                <li
                  key={alternative.place.id}
                  className="bg-surface shadow-rest flex flex-col gap-3 rounded-[18px] p-4"
                >
                  {/*
                    ■ 읽히는 순서 — 이름 → 어떤 곳인가 → 얼마나 미는가 → 숫자

                    예전에는 26px짜리 추천도가 이름 옆에 서서 <b>카드에서 가장 먼저 읽혔다.</b>
                    그러면 목록 전체가 점수표가 되어, 사용자는 "어디로 갈까"가 아니라
                    "몇 점이 제일 높나"를 고르게 된다. 정작 그곳이 어떤 곳인지는
                    맨 아래 회색 상자 안에 접혀 있었다.

                    사람이 장소를 고를 때 먼저 궁금한 것은 <b>그곳이 어떤 곳인가</b>다.
                    그래서 근거 문장을 이름 바로 아래로 끌어올려 성격 문구로 세우고,
                    숫자는 그 아래 한 줄에 모았다.

                    ⚠️ <b>추천도를 지우지는 않는다.</b> 목록을 줄 세운 값이 화면에 없으면
                    "왜 이 순서인가"에 답할 수 없다(CLAUDE.md 추천도 구성 내역).
                    크기만 내려 순서를 양보했을 뿐, 항목별 반영 비율은 그대로 편다.
                  */}
                  {/*
                    ⚠️ <b>"추천" 배지를 두지 않는다.</b> 예전에는 맨 위 카드에 붙였다.
                    걷어낸 이유가 둘이다.

                    첫째, <b>이 목록 자체가 이미 추천이다.</b> 자격을 통과한 후보만 남기고
                    점수로 뽑아 올린 셋인데, 그중 하나에 다시 "추천"을 붙이면 나머지 둘이
                    추천이 아닌 것처럼 읽힌다.

                    둘째, <b>그 배지는 틀린 곳을 가리키고 있었다.</b> 조건이 {@code index === 0}
                    이었는데(나머지 두 조건은 후보 자격상 늘 참이라 거르는 일이 없었다),
                    분산을 살리려고 뽑은 뒤 정렬을 걷어내면서 "맨 위 = 최고점"이라는 전제가
                    무너졌다. 실측에서 <b>22곳 중 7곳(32%)</b>은 맨 위가 최고점이 아니었고,
                    47점 카드에 배지가 붙고 그 아래 67점 카드에는 없는 일까지 있었다.

                    어느 것을 얼마나 미는지는 카드마다 적힌 <b>추천도</b>가 말한다.
                  */}
                  {/*
                    ■ 머리 — <b>구간 문구 → 이름 → 분류·한적도·개선폭</b>

                    예전에는 오른쪽에 26px짜리 추천도가 서 있었다. 목록을 줄 세운 값이니
                    가장 크게 두는 것이 맞다고 보았는데, 실제로는 <b>척도를 오해하게 만드는
                    자리</b>였다 — 100점 만점으로 읽히는 62가 카드에서 가장 먼저 눈에 들어오면
                    나머지 근거를 읽기도 전에 "왜 이걸 추천하지?"가 된다.

                    <p>그래서 숫자 자리에 <b>그 숫자가 뜻하는 말</b>을 세웠다({@link tierPhrase}).
                    숫자는 아래 펼쳐보기 안에 항목·반영 비율과 함께 그대로 있다 —
                    <b>지운 것이 아니라 자리를 옮긴 것</b>이다(CLAUDE.md 추천도 구성 내역).

                    <p>오른쪽 칸이 사라지면서 이름이 카드 너비를 통째로 쓴다. 390px에서
                    긴 장소 이름이 두 줄로 접히던 것이 대부분 한 줄에 들어온다.
                  */}
                  <div className="flex min-w-0 flex-col gap-1.5">
                    {/*
                      구간 문구. <b>브랜드색으로 두되 배지 모양을 주지 않는다</b> —
                      알약을 씌우면 바로 아래 한적 배지와 같은 종류의 신호로 읽히는데,
                      한적도는 원본 수치이고 이것은 종합 판단이라 층이 다르다.
                      색과 자리만으로 갈랐다.

                      ⚠️ <b>하위 구간에서는 통째로 없다</b>({@code tierPhrase}가 null).
                      자리를 비워두지 않고 <b>줄 자체를 없앤다</b> — 빈 칸을 남기면
                      "문구가 아직 안 왔다"로 읽힌다. 아래 수식 줄이 그 자리를 받는다.
                    */}
                    {phrase !== null && (
                      <span className="text-brand-deep text-[15.5px] leading-[1.35] font-bold tracking-[-0.01em]">
                        {/*
                          반짝임은 <b>세는 것</b>이지 읽는 것이 아니다. 화면 낭독기가
                          "반짝임 반짝임 이날 가기 좋아요"로 읽으면 앞의 두 마디가
                          뜻 없는 소음이 된다 — 개수 차이는 눈으로만 쓰는 신호다.
                        */}
                        {phrase.text}
                        {phrase.mark !== null && <span aria-hidden="true"> {phrase.mark}</span>}
                      </span>
                    )}

                    <span className="text-fg text-base leading-[1.35] font-semibold tracking-[-0.01em]">
                      {alternative.place.name}
                    </span>

                    {/* 한적도는 코스 편집 화면과 같은 배지로 담담하게 둔다. 판단의 원본 수치다. */}
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
                      <span className="text-hint text-[12.5px]">
                        {alternative.place.categoryName}
                      </span>
                      <CongestionBadge
                        level={alternative.level}
                        label={alternative.levelLabel}
                        quietness={alternative.quietness}
                        size="sm"
                      />
                      {/*
                        ■ 개선폭 — 배지 옆에 붙는 <b>다른 뜻의 수</b>

                        배지의 한적도는 <b>어디로 가는가</b>이고(그 후보의 절대값),
                        이 수는 <b>얼마나 나아지는가</b>다(지금 자리와의 차). 둘은 같은 말이
                        아니라서 하나로 뭉갤 수 없다 — 한적도 50은 그 자체로는 어중간해
                        보이지만 지금 자리가 23이면 <b>+27짜리 이동</b>이다. 추천도가 낮아
                        보여도 사용자가 판단할 수 있는 것은 이 수 때문이다.

                        <p>brand가 아니라 quiet 색을 쓴다. 나아졌다는 <b>등급 방향의 신호</b>라
                        브랜드색을 쓰면 강조와 등급이 섞인다(CLAUDE.md).

                        <p>⚠️ 0 이하면 아예 적지 않는다. 서버가 개선폭 하한(5점)을 통과한
                        후보만 내려보내므로 정상 경로에서는 나올 수 없는 값인데, 그래도
                        "한적 지수 +0"·"-3" 같은 말이 화면에 서는 일은 없어야 한다.
                        <b>계산해서 나온 수만 적는다.</b>

                        <p>⚠️ <b>이름은 "한적 지수"다</b> — 진단 화면의 날짜 대안이 쓰는 말과
                        같다("한적 지수 +4"). PLACE OFF와 TIME OFF는 같은 화면에 나란히 선
                        두 회피 경로라, 같은 뜻의 수를 다른 이름으로 적으면 <b>형제로 안 읽힌다.</b>
                        "지금보다 +33"이었던 것을 맞춘 것이다 — 무엇이 33만큼 늘었는지를
                        그 줄이 혼자 말하지 못했고, 기준("지금")은 바로 위 머리글이
                        이미 적고 있다(원래 자리의 한적 지수).
                      */}
                      {quietnessGain !== null && quietnessGain > 0 && (
                        <span className="text-quiet-deep text-[12.5px] font-semibold whitespace-nowrap">
                          {/* 화면에 없는 <b>기준</b>만 남긴다. 지표 이름은 이제 눈에 보인다 */}
                          <span className="sr-only">원래 장소보다 </span>
                          한적 지수 +{quietnessGain}
                        </span>
                      )}
                    </div>
                  </div>

                                    {/*
                    성격 문구. 서버가 준 근거 문장을 그대로 쓴다 —
                    "OO 방문객이 함께 많이 찾는 곳", "OO 근처의 비슷한 분류"처럼
                    이미 <b>그곳이 어떤 곳인지</b>를 말하는 문장이다.
                  */}
                  <p className="m-0 text-[13px] leading-[1.6] text-pretty">
                    {alternative.reason}
                  </p>

                  {/*
                    ■ 추천도와 구성 내역 — <b>한 줄 수식이 아니라 세로 목록</b>

                    "추천도 73 = 한적도 76 (70%) + 동선 근접도 66 (30%)"을 카드 겉면에
                    한 줄로 폈다가 걷어냈다(2026-08-30). <b>좁은 화면에서 토막토막
                    접혔다</b> — 항목·점수·비율이 제각기 줄을 바꿔, 수식으로 읽히라고 만든
                    줄이 오히려 읽히지 않는 조각 더미가 됐다.

                    <p>가로로 이으려던 것을 <b>세로로 세우면</b> 폭과 싸울 일이 없다.
                    항목마다 한 줄, 근거는 그 아래 한 줄. 몇 px이 남든 모양이 같다.

                    <p>⚠️ <b>지우는 것이 아니라 접는 것이다.</b> "추천도 73 = 한적도
                    76(70%) + 근접도 66(30%)"은 CLAUDE.md가 필수로 박아 둔
                    <b>데이터 활용 증명 장치</b>다. 심사위원의 "추천도를 어떻게
                    산출하나요?"에 이 상자를 펴서 답한다. 사용자는 위의 한 마디로 읽고,
                    근거가 궁금한 사람만 편다.

                    <p>⚠️ <b>비율을 문자열로 박지 않는다.</b> 70·30을 화면에 적어두면
                    분석 결과로 가중치가 바뀔 때 한쪽만 고쳐져 두 값이 어긋난다.
                    항목 이름·점수·비율 전부 서버가 준 {@code factors}에서 그린다 —
                    설문의 혼잡 민감도가 실제로 이 값을 바꾸고, 항목이 늘어도 따라온다.

                    {@code details}를 쓴 이유: 카드가 목록 안에 여럿이라 상태를 두면
                    카드마다 관리해야 하는데, 브라우저가 이미 하는 일이다. 키보드·보조기술
                    지원도 공짜로 따라온다.

                    ⚠️ 조건이 안에 있다. {@code factors}가 비어도 <b>합계는 있어야 한다</b> —
                    바깥에서 걸러내면 구버전 서버가 내역을 안 줄 때 추천도 숫자가
                    화면에서 통째로 사라진다.
                  */}
                  <details className="group bg-bg rounded-ui px-3 py-2.5">
                    {/* 접힘/펼침을 글자로 말한다. 화살표만 두면 무엇이 열리는지 모른다. */}
                    <summary className="text-hint flex cursor-pointer list-none items-center justify-between gap-2 text-[12px] font-semibold [&::-webkit-details-marker]:hidden">
                      <span className="group-open:hidden">추천도와 산출 근거 보기</span>
                      <span className="hidden group-open:inline">추천도 구성 내역</span>
                      <span className="text-[11px] font-medium">
                        <span className="group-open:hidden">펼치기</span>
                        <span className="hidden group-open:inline">접기</span>
                      </span>
                    </summary>

                    {/*
                      합계를 맨 위에 세운다. 아래 항목들이 <b>무엇을 이루는 값인지</b>
                      먼저 알아야 "70% + 30%"가 어디로 합쳐지는지 읽힌다.
                    */}
                    <div className="border-line mt-2.5 flex items-baseline justify-between gap-2 border-t pt-2.5">
                      <span className="text-fg text-[12.5px] font-semibold">추천도</span>
                      <span className="text-brand-deep font-mono text-[19px] leading-none font-semibold">
                        {alternative.recommendation}
                      </span>
                    </div>

                    {alternative.factors?.length ? (
                      <ul className="border-line mt-2.5 flex flex-col gap-2.5 border-t pt-2.5">
                        {alternative.factors.map((factor) => (
                          <li key={factor.label} className="flex flex-col gap-0.5">
                            {/*
                              항목 이름은 왼쪽, 점수와 비율은 오른쪽 끝에 모은다.
                              항목이 여럿일 때 <b>숫자가 한 세로줄에 서야</b> 비교가 된다 —
                              이름 길이("한적도"·"동선 근접도")를 따라다니면 들쭉날쭉해진다.
                            */}
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="text-fg text-[12.5px] font-semibold">
                                {factor.label}
                              </span>
                              <span className="flex flex-none items-baseline gap-1.5">
                                <span className="text-fg font-mono text-[12.5px] font-semibold">
                                  {factor.score}
                                </span>
                                <span className="text-hint text-[11px]">
                                  반영 {factor.weightPercent}%
                                </span>
                              </span>
                            </div>
                            {/* 근거는 줄을 바꿔 통째로 내린다. 좁은 화면에서 옆에 붙이면 넘친다. */}
                            <span className="text-hint text-[11.5px] leading-[1.5]">
                              {factor.detail}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}

                  </details>

                  {/*
                    "교체"는 서류의 말이다. 사용자가 하는 일은 <b>이곳으로 가기로 정하는 것</b>이고,
                    문구도 그 사람의 말로 적는다. 이 시트를 연 버튼("새로운 곳 발견하기")과 한 짝이라
                    발견하고 → 고르는 흐름이 문장으로도 이어진다.

                    <p>⚠️ <b>"갈래요"가 아니라 "가볼래요"다.</b> 이 버튼이 정하는 것은 여행이 아니라
                    <b>후보 하나</b>이고, 누른 뒤에도 그 자리에 되돌리기가 선다. 단정하는 말을 두면
                    무를 수 없는 일처럼 읽혀 누르기가 무거워진다. 바로 위 제목이 "둘러볼까요?"로
                    묻는 자리라, <b>물음과 대답이 같은 결</b>로 이어지기도 한다.

                    <p>⚠️ <b>"이곳으로"는 남긴다.</b> 카드 세 장이 세로로 이어지고 버튼은 전부
                    같은 글자라, 이 말이 빠지면 목록을 훑다 멈춘 자리에서 <b>무엇에 대한 대답인지</b>가
                    바로 위 카드에만 남는다. 버튼이 칸을 꽉 채우므로 네 글자를 더 얹는 값도 없다.
                  */}
                  <button
                    type="button"
                    className="press bg-brand hover:bg-brand-hover rounded-ui h-11 cursor-pointer text-[14.5px] font-semibold text-fg"
                    /*
                      고르는 순간 <b>왜 이곳인지를 그 자리에 남긴다.</b>

                      이 시트가 닫히면 추천도 구성 내역도 함께 사라져, 최종 비교 화면에는
                      "첨성대 31 → 양동마을 78"만 남았다 — 무엇을 근거로 골랐는지가
                      화면 어디에도 없었다. 발표에서 가리킬 자리인데 증거가 없던 셈이다.

                      다시 요청해 가져올 수 없다. 대안을 다시 부르면 <b>가중 무작위 뽑기가
                      다시 돌아</b> 방금 고른 그 후보가 목록에 없을 수도 있다.
                      고른 순간의 판단은 그 순간에만 존재한다.
                    */
                    onClick={() => {
                      rememberSwapEvidence(alternative.place.id, {
                        recommendation: alternative.recommendation,
                        factors: alternative.factors ?? [],
                        reason: alternative.reason,
                      })
                      onSelect(alternative.place.id)
                    }}
                  >
                    이곳으로 가볼래요
                  </button>
                </li>
                )
              })}
            </ul>
          )}

          {/*
            다시 뽑기.

            서버가 상위 후보군에서 무작위로 고르므로 누를 때마다 다른 조합이 나온다.
            <b>버튼을 눌렀을 때만</b> 다시 뽑는다 — 시트를 여닫는 것만으로 목록이 바뀌면
            방금 봤던 후보를 다시 찾지 못한다.

            목록 아래에 둔다. 위에 두면 후보를 읽기도 전에 눈에 걸리고,
            "이 목록은 믿을 게 못 된다"는 인상을 먼저 준다.
          */}
          {load.phase === 'loaded' && load.alternatives.length > 0 && (
            <div className="mt-3.5 flex flex-col items-center gap-1">
              {/*
                ■ 목록이 매번 달라진다는 안내를 되살렸다

                서버는 상위 후보 Pool에서 <b>가중 무작위</b>로 뽑는다 — 같은 대안이 모든
                사용자에게 반복 추천되면 그곳이 새로운 혼잡지가 되기 때문이다
                (2차 오버투어리즘). 그 성질을 화면이 말하지 않으면, 목록이 점수순이 아닌
                이유도 다시 뽑을 수 있다는 것도 <b>눌러 봐야만</b> 알게 된다.

                <p>자리는 헤더가 아니라 <b>이 버튼 바로 위</b>다. 헤더에 두면 후보를 읽기도
                전에 "믿을 게 못 된다"는 인상을 먼저 주고, 여기면 다시 뽑을 마음이 든
                사람에게 그 말이 닿는다.

                <p>⚠️ <b>우연을 재미로 쓰지 않는다.</b> "뽑혔어요"·"운에 맡겨보세요" 같은
                말은 설문 결과 화면(FULL PEAKOFF)에나 어울린다. 이 화면은 바로 위에
                추천도와 반영 비율을 펴 놓는 자리라, 뽑기처럼 말하는 순간
                "그럼 저 점수는 뭐냐"가 된다. <b>달라지는 것은 운이 아니라 설계다.</b>
                그래서 "매번 새로 뽑아요"가 아니라 "달라질 수 있어요"라고 적는다 —
                일어나는 일은 같지만, 앞의 말은 주사위를 굴리는 손을 보여주고
                뒤의 말은 <b>발견의 폭</b>을 말한다.
              */}
              <p className="text-hint m-0 text-center text-[12px] leading-[1.5]">
                오늘 발견할 수 있는 장소는 달라질 수 있어요
              </p>
              <button
                type="button"
                className="press text-muted hover:text-brand-deep rounded-chip cursor-pointer bg-transparent px-3 py-2 text-[13px] font-semibold"
                onClick={handleRedraw}
              >
                다른 곳도 볼래요
              </button>
            </div>
          )}

          {load.phase === 'loaded' && load.alternatives.length > 0 && (
            <button
              type="button"
              className="text-hint mt-2.5 h-11 w-full cursor-pointer bg-transparent text-[13.5px] font-medium"
              onClick={onClose}
            >
              그대로 둘게요
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
