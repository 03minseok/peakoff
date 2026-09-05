import { useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { BrandMark } from '../components/BrandMark'
import { CongestionBadge } from '../components/CongestionBadge'
import { CourseMap } from '../components/CourseMap'
import { SaveCourseSheet } from '../components/SaveCourseSheet'
import { useAuth } from '../state/authContext'
import { LEVEL_DEEP, LEVEL_SOLID } from '../components/levelStyles'
import {
  CARD_RAISED,
  NOTICE,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
} from '../components/styles'
import { regionNameOf } from '../constants/regions'
import { currentDiagnosis, toSlots, useDiagnosis } from '../hooks/useDiagnosis'
import { saveCourse, updateCourse } from '../services/api'
import { recallPlaces } from '../services/placeCache'
import { useTrip } from '../state/tripContext'
import type { CongestionLevel, CourseDiagnosis, DiagnosedSlot, Place } from '../types/api'
import { formatCompactDate, formatKoreanDate } from '../utils/date'
import { withJosa } from '../utils/josa'

/**
 * 한적도가 실제로 매겨진 슬롯.
 *
 * 교체 비교는 <b>두 점수를 빼는 화면</b>이라 점수 없는 칸을 다룰 수 없다.
 * 진단되지 않은 자리에는 애초에 대안 버튼이 서지 않으므로 교체도 일어나지 않는다.
 */
type ScoredSlot = DiagnosedSlot & {
  quietness: number
  level: CongestionLevel
  levelLabel: string
}

interface Change {
  day: number
  order: number
  before: ScoredSlot
  after: ScoredSlot
}

function isScored(slot: DiagnosedSlot): slot is ScoredSlot {
  return slot.quietness !== null && slot.level !== null && slot.levelLabel !== null
}

/**
 * 원안과 개선안에서 <b>같은 자리</b>(일차·순서)를 맞대어 바뀐 곳을 찾는다.
 *
 * 교체는 자리를 유지한 채 장소만 바꾸므로 자리 기준 비교가 성립한다.
 */
function diffCourses(before: CourseDiagnosis, after: CourseDiagnosis): Change[] {
  return after.slots
    .map((afterSlot) => {
      const beforeSlot = before.slots.find(
        (slot) => slot.day === afterSlot.day && slot.order === afterSlot.order,
      )
      if (!beforeSlot || beforeSlot.place.id === afterSlot.place.id) {
        return null
      }
      // 점수가 없으면 "얼마나 나아졌는지"를 뺄 수 없다. 0으로 채우면 없는 개선을 지어내게 된다.
      if (!isScored(beforeSlot) || !isScored(afterSlot)) {
        return null
      }
      return { day: afterSlot.day, order: afterSlot.order, before: beforeSlot, after: afterSlot }
    })
    .filter((change): change is Change => change !== null)
}

/**
 * 총점을 견주지 못한 쪽이 <b>왜</b> 비었는지 한 줄로 말한다.
 *
 * 두 사정을 구분한다. 점수가 <b>아예 없는 것</b>(밥집만 담은 코스)과 점수는 있으나
 * <b>근거가 얇은 것</b>(관광지 셋 중 하나만 진단된 코스)은 다른 일이다.
 * 하나로 뭉뚱그리면 "왜 점수가 안 나오나요"에 답할 수 없다.
 *
 * 문장형은 진단 화면에서 그대로 가져왔다 — 두 화면이 같은 사정을 다른 말로 설명하면
 * 사용자는 다른 일이 벌어졌다고 읽는다.
 */
function gapReason(label: string, diagnosis: CourseDiagnosis): string {
  // 라벨 뒤 조사도 받침에 맡긴다 — "원안은"과 "이 코스는"이 같은 자리에 들어온다
  const subject = withJosa(label, '은/는')
  return diagnosis.totalQuietness === null
    ? `${subject} 예상 혼잡을 매길 수 있는 장소가 없어요.`
    : `${subject} 관광지 ${diagnosis.forecastTargetCount}곳 중 ${diagnosis.diagnosedCount}곳만 예측 자료가 있어요.`
}

/**
 * 코스 한 벌을 일자별로 늘어놓는 열. 원안과 개선안이 같은 모양이어야
 * 두 열을 눈으로 맞대어 볼 수 있다.
 */
function CourseColumn({
  title,
  subtitle,
  score,
  scoreLevel,
  diagnosis,
  changes,
  highlighted,
}: {
  title: string
  subtitle: string
  /** 총점. 진단된 칸이 하나도 없으면 null이다 */
  score: number | null
  /**
   * 총점의 등급. <b>숫자를 물들이는 색은 여기서만 나온다.</b>
   *
   * ⚠️ 예전에는 highlighted로 색을 골랐다 — 추천하는 쪽이면 초록, 아니면 핑크.
   * 그러면 원안이 78(한적)인 사용자가 <b>붐빔 색으로 칠해진 78</b>을 바로 아래
   * "한적" 배지와 나란히 보게 된다. 색과 글자가 서로를 부정한다.
   */
  scoreLevel: CongestionLevel | null
  diagnosis: CourseDiagnosis
  /**
   * 교체 내역. <b>개선안 열에서만 넘긴다.</b>
   *
   * 예전에는 장소 id 목록만 받아 "바뀐 줄인가"만 가렸다. 이제 <b>무엇을 대신해</b>
   * 들어왔는지와 그때의 추천 근거까지 그 줄 아래에 펴야 해서, 자리(일차·순서)로 찾을 수
   * 있는 내역 자체를 받는다 — 별도의 "변경 내역" 카드가 하던 일을 이 열이 이어받았다.
   */
  changes?: Change[]
  /** 추천하는 쪽. 테두리와 배경으로 한 겹 띄운다 */
  highlighted?: boolean
}) {
  return (
    <div
      /*
        ⚠️ <b>opacity로 강약을 내지 않는다.</b> 예전에는 추천하지 않는 열에 opacity-85를
        걸었는데, 그것은 카드 하나를 통째로 흐리는 둔기다 — 부제(5.02→3.74)와 혼잡 배지처럼
        index.css에서 <b>개별로 조율해 둔 대비까지 함께 끌어내린다.</b>

        추천하는 쪽은 이미 테두리·짙은 그림자·물든 머리를 셋이나 더 갖고 있어,
        투명도를 빼도 어느 쪽이 결론인지는 그대로 읽힌다.
      */
      className={`overflow-hidden rounded-card bg-surface ${
        highlighted ? 'border-quiet-soft shadow-raised border-[1.5px]' : 'shadow-rest'
      }`}
    >
      <div
        className={`border-line flex items-center justify-between gap-3 border-b px-4.5 py-3.5 ${
          highlighted ? 'bg-quiet-tint/60' : ''
        }`}
      >
        <div className="flex min-w-0 flex-col gap-0.5">
          {/*
            <b>span이 아니라 h2다.</b> 이 카드 둘이 화면의 본체인데 제목 개요
            (h1 최종 비교 → h2 …)에서 통째로 빠져 있었다. 보조기기로 훑는 사람에게는
            비교할 두 코스가 목차에 없는 것과 같다.
          */}
          {/*
            배지를 제목 <b>밖에</b> 둔다. 안에 두었더니 이 카드의 접근 이름이
            "개선안추천"으로 붙어 읽혔다 — 눈으로는 gap이 갈라 주지만
            {@code textContent}에는 사이가 없다.
          */}
          <div className="flex items-center gap-2">
            <h2 className="text-fg m-0 text-[15px] font-bold">{title}</h2>
            {highlighted && (
              <span className="bg-brand-tint text-brand-deep rounded-full px-2 py-0.5 text-[11px] font-semibold">
                추천
              </span>
            )}
          </div>
          <span className="text-hint text-[12.5px]">{subtitle}</span>
        </div>
        <span
          className={`flex-none font-mono text-[26px] leading-none font-semibold ${
            score === null || scoreLevel === null ? 'text-hint' : LEVEL_DEEP[scoreLevel]
          }`}
        >
          {/* 점수를 못 매긴 코스는 가운뎃점. 0을 쓰면 "최악"으로 읽힌다 */}
          {score ?? '·'}
        </span>
      </div>

      <div className="flex flex-col gap-3.5 px-3.5 py-3.5">
        {Array.from({ length: diagnosis.days }, (_, index) => index + 1).map((day) => {
          const daySlots = diagnosis.slots.filter((slot) => slot.day === day)
          if (daySlots.length === 0) {
            return null
          }
          return (
            <div key={day} className="flex flex-col gap-1.5">
              <span className="text-hint pl-0.5 text-xs font-semibold">
                Day {day} · {formatCompactDate(daySlots[0].visitDate)}
              </span>
              {daySlots.map((slot) => {
                // 자리(일차·순서)로 찾는다. 같은 장소가 두 번 담긴 코스에서도 어긋나지 않는다
                const change =
                  changes?.find((item) => item.day === slot.day && item.order === slot.order) ??
                  null
                const changed = change !== null
                return (
                  <div
                    key={`${slot.day}-${slot.order}`}
                    className={`rounded-ui flex items-center gap-2.5 px-3 py-2.25 ${
                      changed ? 'bg-quiet-tint/60' : 'bg-bg'
                    }`}
                  >
                    {/* 등급이 없으면 색을 고를 수 없다. 뜻 없는 옅은 채움으로 자리만 지킨다 */}
                    <span
                      className={`h-2 w-2 flex-none rounded-full ${
                        slot.level ? LEVEL_SOLID[slot.level] : 'bg-fill'
                      }`}
                      aria-hidden="true"
                    />
                    <span
                      className={`text-fg truncate text-sm ${
                        changed ? 'font-semibold' : 'font-medium'
                      }`}
                    >
                      {slot.place.name}
                    </span>
                    {changed && (
                      <span className="bg-brand-tint text-brand-deep flex-none rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold">
                        교체
                      </span>
                    )}
                    <span className="ml-auto flex-none">
                      {/* 진단되지 않은 칸은 배지 대신 사유. 빈자리로 두면 불러오는 중으로 읽힌다 */}
                      {slot.level !== null && slot.levelLabel !== null ? (
                        <CongestionBadge
                          level={slot.level}
                          label={slot.levelLabel}
                          quietness={slot.quietness ?? undefined}
                          size="sm"
                        />
                      ) : (
                        <span className="text-hint text-[11.5px]">{slot.gapMessage}</span>
                      )}
                    </span>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function ResultPage() {
  const { state, markSaved } = useTrip()
  const plan = state.plan

  // 원안은 그때의 날짜로 진단해야 한다. 지금 날짜로 계산하면 날짜를 옮겨 얻은 개선이
  // 원안에도 반영돼, 두 경로 중 하나가 통째로 안 보이게 된다.
  const original = useDiagnosis(state.baseline?.plan ?? null, state.baseline?.days ?? null)
  const improved = useDiagnosis(plan, state.days)

  /*
   * 로그인·가입을 마치고 돌아온 경우 시트를 연 채로 시작한다.
   * 그 화면들이 "돌아와 바로 저장할 수 있어요"라고 약속하고 보냈다.
   */
  const location = useLocation()
  const navigate = useNavigate()
  // 저장은 계정이 있어야 하는 일이라 여기서만 로그인 여부를 본다.
  const { member, loading: authLoading } = useAuth()
  const [showSavePrompt, setShowSavePrompt] = useState(
    () => (location.state as { resumeSave?: boolean } | null)?.resumeSave === true,
  )
  /**
   * 이번 화면에서 저장을 마쳤다면 그때의 이름.
   *
   * <b>{@link state.source}만으로는 가릴 수 없다.</b> 마이페이지의 "수정하기"로 들어오면
   * 저장하기 전부터 source가 차 있어, 아직 아무것도 안 한 사람에게 "저장했어요"라고
   * 말하게 된다. 방금 이 화면에서 벌어진 일만 따로 센다.
   */
  const [savedName, setSavedName] = useState<string | null>(null)

  /**
   * 지도에 어느 일차를 그릴지. 'all'이면 전체 일정을 한 번에.
   *
   * <b>Day 1로 연다.</b> 전체로 열면 일차가 뒤엉킨 선이 먼저 보여서, 처음 눈이 닿는
   * 순간에 "어디를 도는지"가 가장 안 읽히는 그림이 나온다. 탭 순서도 Day 1이 첫 칸이라
   * 열린 화면과 탭이 같은 자리를 가리킨다.
   */
  const [mapDay, setMapDay] = useState<number | 'all'>(1)

  /**
   * 좁은 화면에서 원안·개선안 중 <b>어느 쪽을 보고 있는지</b>. 0이 원안이다.
   *
   * 넓은 화면에서는 둘 다 나란히 서므로 이 값이 아무 일도 하지 않는다.
   */
  const [comparePage, setComparePage] = useState(0)

  /**
   * 끌고 있는 동안의 손가락 이동량(px). 놓으면 0으로 돌아간다.
   *
   * <b>0이 아닌 동안은 전환 애니메이션을 끈다.</b> 손가락을 따라오는 면에 transition을
   * 걸어두면 손끝보다 한 박자 늦게 따라와, 종이를 미는 느낌이 아니라 고장 난 느낌이 된다.
   */
  const [dragOffset, setDragOffset] = useState(0)
  /**
   * 이번 제스처의 시작점과 <b>어느 축으로 정해졌는지</b>.
   *
   * ⚠️ 처음 몇 px은 축을 정하지 않고 지켜본다. 누르자마자 가로로 잡아버리면
   * <b>세로로 넘기려던 스크롤</b>을 이 상자가 삼킨다 — 화면 대부분을 차지하는 카드라
   * 그 순간 페이지가 스크롤되지 않는 것처럼 느껴진다.
   */
  const dragRef = useRef<{ x: number; y: number; axis: 'none' | 'x' | 'y' } | null>(null)

  /*
    지도에 그릴 경로. 일차를 고르면 그 하루만 넘긴다.

    CourseMap은 경로가 하나뿐이면 마커 번호를 "1, 2, 3"으로,
    여럿이면 "2-1"처럼 일차를 붙여 매긴다. 그래서 여기서 걸러 넘기는 것만으로
    번호 표기가 알아서 그 날 기준으로 바뀐다.
  */
  const visibleRoutes = useMemo(
    () => (mapDay === 'all' ? state.days : [state.days[mapDay - 1] ?? []]),
    [state.days, mapDay],
  )

  /**
   * 그 날 담긴 곳만 지도에 올린다. 다른 날 장소까지 두면 회색 점이 흩뿌려져
   * "오늘 어디를 도는지"가 오히려 안 보인다.
   *
   * <p>예전에는 대표 관광지 100곳을 따로 받아와 그중에서 골랐다. 그런데
   * <b>검색해서 담은 음식점은 애초에 그 100곳에 없다</b> — 코스에 넣은 피자집이
   * 최종 동선 지도에서 통째로 빠졌다. 담은 장소는 담을 때 이미 알고 있었으므로
   * 기억해 둔 것에서 찾는다. 요청도 하나 줄었다.
   */
  const visiblePlaces = useMemo(() => {
    const known = new Map<string, Place>()
    // 담을 때 기억해 둔 것이 먼저, 진단 응답이 나중이다 — 방금 서버가 준 쪽이 이긴다.
    for (const place of recallPlaces(visibleRoutes.flat())) {
      known.set(place.id, place)
    }
    /*
      진단을 여기서도 보는 것은 <b>의존성 때문이기도 하다.</b> 새로고침 직후에는
      기억해 둔 것이 비어 있고 진단이 도착하면서 채워지는데, 이 계산이 경로에만
      기대고 있으면 그때 다시 돌지 않아 지도가 빈 채로 남는다.
    */
    for (const slot of currentDiagnosis(improved)?.slots ?? []) {
      known.set(slot.place.id, slot.place)
    }
    const ids = new Set(visibleRoutes.flat())
    return [...known.values()].filter((place) => ids.has(place.id))
  }, [visibleRoutes, improved])

  if (!plan) {
    return <Navigate to="/plan" replace />
  }
  if (state.days.length === 0 || state.days.every((day) => day.length === 0)) {
    return <Navigate to="/course" replace />
  }

  const hasError = original.phase === 'error' || improved.phase === 'error'

  const beforeDiagnosis = currentDiagnosis(original)
  const afterDiagnosis = currentDiagnosis(improved)
  const ready = beforeDiagnosis !== null && afterDiagnosis !== null

  const changes = ready ? diffCourses(beforeDiagnosis, afterDiagnosis) : []
  /*
    개선폭은 <b>양쪽 총점이 다 있어야</b> 성립한다. 진단된 칸이 하나도 없는 코스는
    총점이 null이라, 한쪽이라도 비면 0으로 두고 아래에서 비교 문구를 그리지 않는다.
  */
  const beforeTotal = ready ? beforeDiagnosis.totalQuietness : null
  const afterTotal = ready ? afterDiagnosis.totalQuietness : null

  /*
    총점을 <b>숫자로 말해도 되는지는 서버가 정한다.</b> 진단된 칸이 둘 미만이거나
    예측 대상 관광지의 절반에 못 미치면 거짓으로 온다.

    ⚠️ 그때도 총점 값 자체는 있다 — <b>저장에 쓰라고 남긴 것</b>이다.
    그래서 아래 저장 버튼은 잠기지 않는다. 잠그는 것은 총점이 아예 없을 때(null)뿐이다.
  */
  const showBefore = ready && beforeDiagnosis.totalPresentable
  const showAfter = ready && afterDiagnosis.totalPresentable

  /*
    <b>양쪽 다 보여줄 수 있을 때만 견준다.</b> 한쪽이라도 근거가 얇으면 그 차이가
    코스가 나아진 것인지 진단된 칸 수가 달라진 것인지 가릴 수 없다 —
    이 화면은 발표에서 가리킬 자리라, 설명할 수 없는 숫자를 세워 둘 수 없다.
  */
  const comparable = showBefore && showAfter && beforeTotal !== null && afterTotal !== null
  /*
    ⚠️ <b>견주지 않기로 했으면 0도 쓰지 않는다.</b>

    예전에는 여기가 0이었다. 그러면 바로 위에서 "근거가 얇아 견줄 수 없다"고 판단해 놓고,
    아래 헤드라인이 22px 굵은 글씨로 <b>"총점은 같아요"</b>라고 말하고 타일에 <b>0</b>이 찍혔다 —
    거부한 등식을 화면이 그대로 주장한 셈이다. 경주 코스의 41.7%가 이 대역이라 드문 길도 아니다.

    없는 값은 null로 두고, 문장과 타일이 각자 비켜간다.
  */
  const gain = comparable ? afterTotal - beforeTotal : null

  // 날짜 이동과 장소 교체는 서로 다른 회피 경로다. 무엇을 해서 나아졌는지
  // 구분해 보여줘야 "왜 좋아졌는지"가 화면에 남는다.
  const movedDate =
    state.baseline !== null && state.baseline.plan.startDate !== plan.startDate
      ? { from: state.baseline.plan.startDate, to: plan.startDate }
      : null

  /*
   * 저장 시트의 이름 기본값.
   *
   * 빈칸으로 두면 "이름 짓기"가 저장을 막는 관문이 된다. 지역과 기간으로 무난한 이름을
   * 미리 채워두고, 고치고 싶은 사람만 고치게 한다.
   */
  const defaultCourseName =
    /*
     * 고쳐 쓰는 중이면 <b>저장해둔 이름</b>이 먼저다. 지역·기간으로 새로 지어 채우면
     * 사용자가 붙여둔 이름이 조용히 지워진다 — 저장 버튼을 누르는 순간 코스 이름이
     * "경주 1박 2일"로 되돌아간다.
     */
    state.source?.name ??
    `${regionNameOf(plan.region)} ${
      plan.nights === 0 ? '당일치기' : `${plan.nights}박 ${plan.nights + 1}일`
    }`.trim()

  const crowdedBefore = beforeDiagnosis
    ? beforeDiagnosis.slots.filter((slot) => slot.level === 'CROWDED').length
    : 0
  const crowdedAfter = afterDiagnosis
    ? afterDiagnosis.slots.filter((slot) => slot.level === 'CROWDED').length
    : 0

  /**
   * 붐비는 곳이 몇 개 <b>움직였는가</b>. 견줄 원안이 없으면 {@code null}이다.
   *
   * <p>양쪽 진단이 다 있어야 성립한다 — 원안 없이 {@code crowdedAfter - 0}을 쓰면
   * 처음부터 둘이던 코스가 <b>둘이 늘어난 코스</b>로 읽힌다.
   *
   * <p>총점과 달리 {@code totalPresentable}을 보지 않는다. 평균은 근거가 얇으면
   * 말할 수 없지만 <b>붐비는 칸이 몇 개인지는 세면 나오는 사실</b>이다.
   */
  const crowdedShift =
    beforeDiagnosis !== null && afterDiagnosis !== null ? crowdedAfter - crowdedBefore : null

  /*
    무엇을 해서 나아졌는지 요약한다.

    "교체"가 아니라 "발견"이다. 사용자가 한 일은 붐비는 곳을 무른 것이 아니라
    <b>다른 곳을 찾아낸 것</b>이고, 그 자리로 데려간 버튼 이름도 "새로운 곳 발견하기"다.
    결과 화면에서만 다른 말을 쓰면 방금 한 일이 다른 일처럼 읽힌다.

    ⚠️ 여기서도 "더 좋은 곳"이라고 하지 않는다. {@link diffCourses}가 세는 것은
    <b>자리가 바뀐 칸 전부</b>이지 나아진 칸이 아니다 — 사용자가 더 붐비는 곳으로
    옮겼어도 이 수에 들어간다. 얼마나 나아졌는지는 바로 아래 두 총점이 말한다.
  */
  const summary = [
    movedDate ? '날짜 이동' : null,
    changes.length > 0 ? `다른 곳 ${changes.length}곳 발견` : null,
  ].filter(Boolean)

  /*
    총점을 견주지 못한 <b>이유</b>. 어느 쪽이 왜 비었는지를 그대로 편다.

    이 문단이 히어로의 가운뎃점(·)까지 함께 설명한다 — 44px 숫자 자리에 홀로 선 점은
    "자료 없음"이 아니라 <b>그리다 만 화면</b>으로 읽힌다. 진단 화면은 자기 점을
    설명 문단과 짝지어 두는데(DiagnosisPage의 !showTotal 갈래) 이 화면만 맨점을 찍고 있었다.
  */
  const comparisonGap =
    !comparable && beforeDiagnosis !== null && afterDiagnosis !== null
      ? /*
          ⚠️ <b>바꾼 것이 없으면 두 코스는 같은 코스다.</b> 그때 원안과 개선안을
          따로 설명하면 <b>같은 문장이 두 번</b> 나가고, 읽는 사람은 서로 다른 두 사정이
          있다고 읽는다. 한 번만 말하고 이름도 나누지 않는다.
        */
        summary.length === 0
        ? gapReason('이 코스', afterDiagnosis)
        : [
            showBefore ? null : gapReason('원안', beforeDiagnosis),
            showAfter ? null : gapReason('개선안', afterDiagnosis),
          ]
            .filter(Boolean)
            .join('\n')
      : null

  /*
    바꾼 것이 없는 사용자에게 주는 다음 걸음.

    ⚠️ <b>붐비는 곳이 있을 때만 대안을 권한다.</b> 한 곳도 붐비지 않는 코스에
    "붐비는 장소의 대안을 확인해 보세요"라고 하면 <b>없는 문제를 고치러</b> 보내는 셈이고,
    예측 자료가 아예 없어 0인 코스에는 있지도 않은 대안을 찾아오라는 말이 된다.
  */
  const noChangeHint =
    crowdedAfter > 0 ? '진단 화면에서 붐비는 곳의 대안을 볼 수 있어요.' : null

  /*
    <b>축하해도 되는 순간인가.</b>

    두 조건을 다 넘어야 한다 — 견줄 수 있어야 하고(gain !== null), 실제로 올라야 한다.
    내려갔거나 못 견준 코스에도 PEAK OFF 칩과 "분산에 기여했어요"를 붙이면,
    이 화면의 모든 문장이 <b>결과와 무관하게 늘 하는 말</b>로 읽힌다.
  */
  const celebrating = gain !== null && gain > 0

  /*
    새로 찾아낸 곳의 이름. 제목이 "몇 곳"을 말하고 이 줄이 "어디"를 말한다.

    개수를 세어 자르지 않고 <b>줄 수로 자른다</b>(line-clamp-2). 이름 길이가
    "첨성대"부터 "경주 양동마을 [유네스코 세계유산]"까지 제각각이라 개수로 자르면
    어떤 코스는 한 줄이 남고 어떤 코스는 넉 줄이 된다. 몇 곳인지는 제목이 이미 말하므로
    여기서 잘려도 잃는 정보가 없다.
  */
  const discovered = changes.map((change) => change.after.place.name)

  /*
    히어로의 두 문장. 갈래가 넷이라 JSX 안에 삼항으로 겹쳐 두면 어느 조건이
    어느 문장으로 가는지 읽히지 않는다 — 방금 고친 버그가 그 겹침 속에 숨어 있었다.

    ⚠️ <b>못 견줬다는 사실이 가장 먼저다.</b> 바꾼 것이 있든 없든, 이 화면이
    가장 먼저 알려야 할 것은 "두 숫자를 맞대지 않았다"는 것이다.
  */
  /*
    ⚠️ <b>나아진 경우에만 사용자가 한 일을 제목으로 삼는다.</b>

    예전 제목은 "다른 곳 2곳 발견으로 한적 지수가 8 올랐어요"였다. 개선폭(+8)은 이제
    <b>바로 아래 타일이 "69 (+8)"로 말하므로</b> 제목에서 뺐다 — 같은 수를 두 번 적으면
    제목이 요약이 아니라 반복이 된다.

    날짜만 옮긴 경우를 따로 가른다. 장소를 하나도 안 바꿨는데 "새로운 여행지를 0곳
    발견했어요"라고 할 수는 없다 — 그 사람이 한 일은 <b>날짜를 옮긴 것</b>이다.

    총점이 내려갔거나 견주지 못한 갈래는 그대로 둔다. 그쪽에서 축하 문장을 쓰면
    제목이 결과와 무관하게 늘 하는 말이 된다.
  */
  const heroHeadline =
    summary.length === 0
      ? '원안 그대로입니다'
      : gain === null
        ? `${summary.join(' · ')} · 총점은 견주지 않았어요`
        : gain > 0
          ? changes.length > 0
            ? `새로운 여행지를 ${changes.length}곳 발견했어요!`
            : '더 한적한 날짜를 찾았어요!'
          : `${summary.join(' · ')} · 총점은 ${gain === 0 ? '같아요' : `${Math.abs(gain)} 내려갔어요`}`

  /*
    히어로 본문. <b>화면이 이미 말한 것은 다시 말하지 않는다.</b>

    예전에는 "붐빌 것으로 보이는 곳이 3곳에서 0곳으로 줄었어요"와 "두 총점 모두 예상
    혼잡을 매긴 칸들의 평균이에요"가 여기 있었다. 둘 다 걷어냈다 —
    앞엣것은 바로 아래 <b>"붐비는 곳 3 → 0" 타일이 같은 말</b>을 하고,
    뒤엣것은 개선폭을 여러 줄 늘어놓던 "변경 내역"이 사라지면서
    <b>더할 숫자가 화면에 없어져</b> 미리 답할 산수 자체가 없어졌다.

    남는 것은 <b>화면의 다른 것으로는 알 수 없는 말</b>뿐이다 —
    왜 못 견줬는지, 다음에 무엇을 할 수 있는지, 그리고 이 서비스가 무엇을 했는지.
  */
  const heroBody =
    comparisonGap !== null
      ? [
          comparisonGap,
          '그래서 두 총점은 견주지 않았어요.',
          // 바꾼 것도 없고 견주지도 못했으면 여기서 할 일이 없다. 나갈 길을 함께 준다.
          summary.length === 0 ? noChangeHint : null,
        ]
          .filter(Boolean)
          .join('\n')
      : summary.length === 0
        ? ['바꾼 곳이 없어요.', noChangeHint].filter(Boolean).join('\n')
        : /*
            이 서비스가 존재하는 이유를 한 번 말한다.

            ⚠️ <b>실제로 다른 곳을 고른 사람에게만 말한다.</b> 아무것도 안 바꾼 코스에
            "분산에 기여했어요"라고 하면 하지 않은 일을 했다고 말하는 것이다.
            이 서비스가 심사받는 지점(오버투어리즘 완화)이라 더더욱 정직해야 한다.
          */
          celebrating && changes.length > 0
          ? /*
              ⚠️ <b>이 한 줄만 문자열이 아니라 JSX다.</b> 좁은 화면에서 쉼표 뒤를 끊으려면
              화면 폭에 따라 있고 없고가 갈리는 줄바꿈이 필요한데, 문자열에 넣은 줄바꿈 문자는
              (이 문단이 {@code whitespace-pre-line}이라) <b>어느 폭에서나</b> 끊는다.

              <p>이 문단은 다른 경우에 진짜 여러 줄을 담으므로 pre-line을 끌 수도 없다 —
              끄면 "그래서 두 총점은 견주지 않았어요" 같은 줄이 앞줄에 붙는다.
              그래서 <b>이 자리에만</b> 화면 폭으로 사라지는 br을 둔다.

              <p>쉼표 뒤에서 끊는 이유: 두 마디가 <b>한 일과 그 뜻</b>으로 갈린다.
              좁은 화면에서는 어차피 두 줄이 되는데, 어디서 끊길지를 브라우저에 맡기면
              "골라, 관광 수요"까지 올라와 첫 마디가 어디서 끝나는지 흐려진다.

              <p>{@code sm:hidden}이다 — 이 히어로의 다른 분기점은 lg지만, 여기서는
              <b>줄이 실제로 넘치기 시작하는 폭</b>이 기준이다. 이 문장은 372px이 필요하고
              문단 폭이 {@code min(화면−80, 440)}이라 <b>화면 452px부터 한 줄에 들어간다</b> —
              거기서도 끊으면 멀쩡히 한 줄인 문장을 둘로 자르게 된다. 452 위의 첫 분기점이 sm이라
              452~639px 구간만 필요 없이 끊기는데, 폰도 태블릿도 잘 서지 않는 폭이다.
              ⚠️ 문장을 늘리면 이 계산이 달라진다.
            */
            (
              <>
                붐비는 곳 대신 새로운 곳을 골라,{' '}
                <br className="sm:hidden" />
                관광 수요 분산에 한 걸음 보탰어요.
              </>
            )
          : ''

  /*
    ⚠️ <b>지수 변화 타일은 견줬을 때만 선다.</b> 못 견줬는데 0을 찍으면
    "변화 없음"이라는 없는 사실을 숫자로 주장하게 된다.

    칸이 셋에서 둘로 줄어도 남은 둘은 그대로 참이다 — 교체 수와 붐비는 곳 수는
    총점이 아니라 <b>칸별 등급</b>에서 오므로 총점을 못 매긴 코스에서도 셀 수 있다.
  */
  /*
    ⚠️ <b>지수 변화에 한적 색을 쓰는 것은 올랐을 때뿐이다.</b> 예전에는 부호와 상관없이
    늘 quiet-soft였다 — 총점이 내려간 코스에서 "-6"이 <b>한적 색</b>으로 칠해졌다.
    히어로의 두 숫자와 같은 병이다.

    내려간 값은 붐빔 색으로 칠하지 않고 흰색으로 둔다. crowded-soft는 이 타일 배경
    (bg-white/7)에서 3.86:1이라 17px 글자를 받지 못한다 — 배경과 글자색은 짝으로만 쓰고,
    짝이 기준을 못 넘으면 색을 쓰지 않는다. 방향은 부호와 헤드라인이 이미 말한다.
  */
  /*
    첫 칸이 <b>이 코스의 한적 지수와 그 변화</b>를 한꺼번에 말한다 — "69 (+8)".

    예전에는 개선폭만("+8") 적고, 69라는 값은 히어로 한가운데 76px 숫자로 따로 세워
    두었다. 그런데 두 수는 <b>한 문장</b>이다 — "얼마나 한적한 코스가 되었나"에 답하려면
    도착점과 이동폭이 같이 있어야 하고, 떨어뜨려 놓으면 화면이 총점을 세 번 말하게 된다.

    ⚠️ <b>값에 색을 칠하지 않는다.</b> 69는 등급(보통)의 값이고 (+8)은 방향의 값이라
    한 칸에서 색이 갈려야 하는데, 17px 안에서 두 색을 쓰면 어느 쪽이 어느 뜻인지
    읽히지 않는다. 등급은 위의 배지가, 방향은 부호가 이미 말한다.

    <p>보여줄 수 없는 총점이면 칸 자체가 없다. {@code '·'}를 찍어두면 "아직 안 온 값"으로
    읽히고, 0을 찍으면 없는 사실을 주장하게 된다.
  */
  const heroStats: { label: string; value: string; delta?: string; deltaTone?: string }[] = [
    ...(showAfter && afterTotal !== null
      ? [
          {
            label: '한적 지수',
            value: `${afterTotal}`,
            /*
              <b>도착점과 이동폭을 크기로 가른다.</b> 한 문자열로 붙여 "62 (+60)"이라고
              쓰니 좁은 칸에서 두 줄로 접혔다. 큰 글씨는 <b>지금 이 코스가 얼마나
              한적한가</b>, 작은 글씨는 <b>얼마나 옮겨왔나</b>다 — 크기가 이미 둘을
              구분하므로 색은 방향에만 쓴다.
            */
            // 변화가 0이면 적지 않는다. "(0)"은 뜻을 더하지 않고 자리만 차지한다
            delta:
              gain === null || gain === 0 ? undefined : `(${gain > 0 ? '+' : ''}${gain})`,
            deltaTone: gain !== null && gain > 0 ? 'text-quiet-soft' : 'text-white/70',
          },
        ]
      : []),
    { label: '교체한 장소', value: `${changes.length}곳` },
    /*
      ⚠️ <b>화살표를 버리고 한적 지수와 같은 모양으로 세운다</b> (2026-09-03).

      {@code 0 → 0}은 맞대어 본 결과의 모양인데, 바꾼 것이 없으면 두 수가 같을 수밖에 없어
      화살표가 "무언가 바뀌었다"고 말해 놓고 같은 수를 두 번 보여준다. 무엇보다 옆 칸
      ({@code 62 (+8)})과 <b>같은 것을 다른 문법으로</b> 적고 있었다 — 도착점과 이동폭이라는
      같은 한 쌍인데 한 칸은 화살표로, 한 칸은 괄호로 말했다.

      <p>⚠️ <b>색은 반대다.</b> 붐비는 곳은 <b>줄어야</b> 좋으므로 음수일 때 한적 색을 준다.
      한적 지수의 규칙(오른 값에만 한적 색)을 그대로 베끼면 붐비는 곳이 늘어난 코스에서
      {@code (+2)}가 한적 색으로 칠해진다.

      <p>견줄 짝이 없으면({@code crowdedShift === null}) 이동폭을 적지 않는다.
      원안이 없는데 {@code (+2)}라고 쓰면 늘지도 않은 수가 늘었다고 말하는 셈이다.
    */
    {
      label: '붐비는 곳',
      value: `${crowdedAfter}곳`,
      // 변화가 0이면 적지 않는다 — 한적 지수 칸과 같은 규칙이다
      delta:
        crowdedShift === null || crowdedShift === 0
          ? undefined
          : `(${crowdedShift > 0 ? '+' : ''}${crowdedShift})`,
      deltaTone: crowdedShift !== null && crowdedShift < 0 ? 'text-quiet-soft' : 'text-white/70',
    },
  ]

  return (
    <div className="flex flex-col gap-4.5">
      {/*
        <b>머리글을 걷어냈다.</b> "최종 비교"라는 제목과 "진단 결과로" 링크가 있었다.

        <ul>
          <li>제목은 <b>아래 히어로가 이미 더 잘 말한다.</b> 작은 회색 글씨로 화면 이름을
              한 번 대고, 바로 밑에서 큰 글씨로 결과를 말하면 같은 말을 두 번 하는 셈이다.
              이제 히어로의 문장이 h1을 맡는다 — 제목이 사라진 게 아니라 <b>커졌다</b>
          <li>"진단 결과로"는 <b>아래 "돌아가기" 버튼과 같은 곳으로 간다.</b> 같은 일을 하는
              조작이 화면 두 곳에 있으면 어느 쪽이 진짜인지 흔들린다 —
              진단 화면이 같은 이유로 이미 걷어낸 중복이다
        </ul>
      */}
      {/*
        ⚠️ <b>살아 있는 영역은 화면에 계속 있어야 한다.</b>

        나타났다 사라지는 문구에 role만 붙이면 그 문구가 <b>사라질 때</b>는 아무 말도 못 한다 —
        "계산하는 중"은 알려지고 <b>결과가 도착했다는 사실은 알려지지 않는다.</b>
        이 화면은 로딩 문구 한 줄에서 히어로·두 열·지도로 통째로 바뀌는데,
        그 전환이 보조기기에 한 번도 전해지지 않고 있었다.

        오류는 여기서 말하지 않는다. 아래에서 role="alert"로 따로 끊고 들어간다 —
        같은 사실을 두 영역이 말하면 두 번 읽힌다.
      */}
      <p className="sr-only" role="status">
        {hasError ? '' : ready ? '비교 결과가 준비됐어요.' : '결과를 계산하는 중입니다.'}
      </p>

      {/*
        ⚠️ <b>오류와 로딩은 함께 뜰 수 없다.</b> 오류가 나면 진단이 없어 ready도 false라,
        "결과를 불러오지 못했습니다"와 "결과를 계산하는 중…"이 <b>나란히 찍혔다</b> —
        실패했다는 말과 아직 하는 중이라는 말이 같은 화면에 서 있었다.

        오류만 role="alert"다. 하던 일을 끊고 알려야 하는 유일한 소식이라서다 —
        기다림과 도착은 위의 status 영역이 끼어들지 않고 전한다.
      */}
      {hasError ? (
        <p className={`${NOTICE} text-crowded-deep text-sm`} role="alert">
          결과를 불러오지 못했습니다.
          <br />
          잠시 후 다시 시도해 주세요.
        </p>
      ) : (
        !ready && (
          <p className="text-[13px]">결과를 계산하는 중…</p>
        )
      )}

      {ready && (
        <>
          {/*
            발표에서 가장 오래 머무를 영역이다. 어두운 면 위에 두 점수만 올려
            주변 정보를 걷어냈다. 개선안 숫자를 더 크게 두는 것은 강조가 아니라
            "이쪽이 결론"이라는 방향 표시다.
          */}
          {/*
            이 화면의 결론이 서는 자리. <b>도착의 순간</b>이다.

            예전에는 숫자 둘을 왼쪽에, 글을 오른쪽에 놓은 대시보드형이었다. 지금은
            가운데로 모아 <b>한 장의 소식</b>으로 읽히게 했다 — 사용자가 한 일은 지표를
            조회한 것이 아니라 붐빔을 비껴가 다른 곳을 찾아낸 것이고, 화면도 그 말을 한다.

            ⚠️ <b>축하는 실제로 나아졌을 때만 한다.</b> PEAK OFF 칩과 마무리 문장은
            {@code gain > 0}에서만 선다. 총점이 내려갔거나 견주지 못한 코스에까지
            같은 얼굴을 하면, 이 화면의 모든 문장이 장식으로 읽힌다.
          */}
          <section className="bg-fg rounded-card relative overflow-hidden px-5 py-6 text-white lg:px-10 lg:py-8">
            {/*
              ■ <b>동그라미 둘을 되살린다</b> (2026-09-03)

              여행이 끝나는 화면인데 <b>평평한 잉크 한 색</b>이었다. 축하 갈래는 칩과
              ✨ 줄이 자리를 채우지만 "원안 그대로입니다" 갈래는 제목 한 줄과 회색 한 줄뿐이라
              카드가 덜 그린 면으로 보였다.

              <p>사진으로 두 번 풀어 보고 물렸다 — 전면에 깔면 가운데 정렬한 글자의 대비가
              무너지고, 바닥에 눕히거나 진입 카드의 물결을 빌려 오면 <b>글을 왼쪽으로 밀어야</b>
              한다. 이 카드의 글은 가운데 서는 것이 맞다: 제목 하나를 가운데 두고 그 아래
              타일 셋이 나란한 짜임이라, 왼쪽으로 몰면 오른쪽이 통째로 빈다.

              <p><b>모서리에서 비어져 들어오는 원</b>은 그 문제가 없다. 글이 앉는 가운데를
              비우고 <b>네 모서리에서만</b> 카드를 물들이기 때문이다. 2026-09-02에
              걷어냈던 그 장치이고, 걷어낸 이유는 <b>사진이 화면의 색을 맡게 되면서</b>
              둘이 섞여 탁해져서였다 — <b>여기에는 사진이 없다.</b>

              <h3>왜 틸 둘인가 (핑크가 없다)</h3>
              홈의 갈림길 카드에는 틸(한적)과 핑크(붐빔)가 함께 있었다. 서사가 "붐빔에서
              한적으로"라서다. <b>여기는 이미 도착한 자리</b>라 핑크가 없다 —
              장식이 아니라 결론이다.

              <p>⚠️ <b>색은 토큰이다</b>({@code bg-brand/…}). 예전에는 {@code rgb(63 193 201/…)}을
              박아 두었는데, 팔레트를 고치면 이 원만 옛 틸로 남는다.

              <p>⚠️ 원이 카드 밖으로 나가야 <b>동그라미가 아니라 빛</b>으로 읽힌다.
              안쪽에 통째로 들어오면 "카드 위에 놓인 공"이 된다. 자르는 것은 카드의
              {@code overflow-hidden}이다.
            */}
            {/*
              ⚠️ <b>원이 카드 폭의 절반을 넘으면 원이 아니라 호(弧)가 된다.</b>
              예전 값(288px)을 358px 카드에 그대로 두었더니 가장자리가 <b>카드를 가로지르는
              사선</b>으로 보였다 — 모서리에서 비어져 들어오는 것이 아니라 카드가 두 색으로
              갈린 것처럼. 모서리에 물릴 만큼만 키운다.

              <p>셋을 <b>대각선으로</b> 흩는다. 한쪽에 몰면 카드가 그쪽으로 기운다.
              크기와 옅기를 조금씩 달리해야 <b>같은 원을 복사한 것</b>으로 보이지 않는다.
            */}
            <span
              aria-hidden="true"
              className="bg-brand/16 pointer-events-none absolute -top-12 -right-10 h-40 w-40 rounded-full lg:h-52 lg:w-52"
            />
            <span
              aria-hidden="true"
              className="bg-brand/8 pointer-events-none absolute -bottom-14 -left-10 h-36 w-36 rounded-full lg:h-48 lg:w-48"
            />
            <span
              aria-hidden="true"
              className="bg-brand/6 pointer-events-none absolute -top-16 left-1/4 h-24 w-24 rounded-full lg:h-32 lg:w-32"
            />
            <div className="relative mx-auto flex max-w-[520px] flex-col items-center gap-3.5 text-center">
              {/*
                <b>브랜드 마크가 직접 축하한다.</b> 이모지를 쓰지 않은 이유:
                이 서비스에는 이미 "봉우리에서 한 칸 비껴간 조각"이라는 그림이 있고,
                그것이 바로 <b>지금 사용자가 한 일</b>이다. 다른 서비스도 쓸 수 있는 기호와
                달리, 이 마크는 이 순간을 위해 그려진 것이다.
              */}
              {celebrating && (
                <span className="rounded-chip flex items-center gap-2 bg-white/10 py-1.5 pr-3.5 pl-2.5 text-[13px] font-bold tracking-[0.02em]">
                  <BrandMark tone="dark" size={16} />
                  PEAK OFF 성공!
                </span>
              )}

              <div className="flex flex-col gap-2.5">
                {/*
                  화면의 h1이다. 위에 있던 "최종 비교"를 대신한다 —
                  화면 이름을 대는 것보다 결과를 말하는 편이 제목으로 낫다.
                */}
                {/*
                  break-keep: 한국어는 기본값에서 <b>단어 한가운데도 끊긴다.</b>
                  "보탰어요"가 "보 / 탰어요"로 갈리는 식이라, 큰 글씨일수록 눈에 띈다.
                  ⚠️ 이 저장소는 아직 전역으로 걸지 않았다 — 여기서만 켠다.
                */}
                <h1 className="m-0 text-[22px] leading-[1.3] font-bold tracking-[-0.025em] break-keep text-pretty lg:text-[27px]">
                  {heroHeadline}
                </h1>

                {celebrating && discovered.length > 0 && (
                  <p className="text-quiet-soft m-0 line-clamp-2 text-[14px] leading-[1.5] font-semibold break-keep lg:text-[15px]">
                    ✨ {discovered.join(', ')}
                  </p>
                )}
              </div>
              {heroBody !== '' && (
                <p className="m-0 max-w-[440px] text-[14px] leading-[1.7] whitespace-pre-line break-keep text-white/70 text-pretty lg:text-[14.5px]">
                  {heroBody}
                </p>
              )}

              <div className="flex w-full gap-2.5">
                {heroStats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-ui flex min-w-0 flex-1 flex-col items-center gap-0.5 bg-white/7 px-2.5 py-3"
                  >
                    <span className="text-[11.5px] text-white/70">{stat.label}</span>
                    <span className="flex items-baseline gap-1 whitespace-nowrap">
                      <span className="font-mono text-[17px] font-semibold lg:text-[19px]">
                        {stat.value}
                      </span>
                      {stat.delta !== undefined && (
                        <span className={`font-mono text-[12px] font-semibold ${stat.deltaTone}`}>
                          {stat.delta}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>

              {/*
                <b>출처를 밝힌다.</b> 진단 화면은 숫자 옆에 이 줄을 달고 있는데
                (DiagnosisPage의 "OO 기준 · 공공데이터 기반 예측") 정작 발표에서 가리킬
                이 화면에만 없었다 — 심사위원의 "어떤 데이터입니까"에 답할 글자가
                화면에 한 자도 없던 셈이다.

                <p>공사 이름을 쓰지 않는다(절대 규칙 4). 그리고 "실시간"이 아니라
                <b>"예측"</b>이다 — 이 데이터는 통계·예측값이다.

                <p>날짜를 옮겼으면 두 날짜를 함께 적는다. 한쪽만 적으면 원안 점수가
                <b>다른 날의 기준</b>으로 계산된 값이라는 사실이 사라진다.
              */}
              <p className="m-0 text-[11.5px] leading-[1.5] text-white/70">
                {movedDate
                  ? `원안 ${formatKoreanDate(movedDate.from)} · 개선안 ${formatKoreanDate(movedDate.to)} 기준`
                  : `${formatKoreanDate(plan.startDate)} 기준`}
                {' · 공공데이터 기반 예측'}
              </p>
            </div>
          </section>

          {/*
            ■ <b>바꾼 것이 없으면 이 자리를 통째로 비운다</b> (2026-09-03)

            원안과 개선안이 <b>글자 하나 다르지 않은</b> 코스일 때, 두 열을 세우면
            같은 목록을 두 번 그려 놓고 이름만 다르게 부르는 화면이 된다. 스위치를 눌러도
            아무것도 바뀌지 않으니 <b>조작이 고장으로 읽히고</b>, 넓은 화면에서는 나란한
            두 열이 "무엇이 다른지 찾아보라"고 말하는데 다른 곳이 없다.

            <p>히어로가 이미 "원안 그대로입니다"라고 말한 뒤다. 그 말 다음에 올 것은
            <b>맞대어 보기가 아니라 내가 짠 코스</b>다 — 요약 바로 아래에서 최종 동선이 뜬다.

            <p>⚠️ 조건을 {@code changes.length}가 아니라 <b>{@code summary}</b>로 잡는다.
            날짜만 옮긴 코스는 장소가 하나도 안 바뀌었지만 <b>점수가 달라진다</b> —
            그때는 맞대어 볼 것이 있다. 히어로의 "원안 그대로입니다"가 서는 조건과
            같은 자를 쓴다(둘이 갈리면 화면이 스스로 모순된다).
          */}
          {summary.length > 0 && (
            <>
            {/*
              두 코스를 맞대는 자리.

              <b>넓은 화면은 나란히, 좁은 화면은 번갈아.</b> 위아래로 쌓으면 두 코스가
              한 화면에 함께 서지 못해, 맞대어 보라고 만든 화면에서 <b>스크롤로 기억해
              비교</b>하게 된다. 스위치로 갈아끼우면 두 열이 <b>같은 자리</b>에 뜨므로
              바뀐 줄이 눈에 그대로 남는다.

              <p>⚠️ <b>가로로 미는 "상자"로 만들지 않는다.</b> 한때 스냅 캐러셀이었다 —
              {@code overflow-x-auto} + {@code overscroll-x-contain}으로. 규칙이 허용하는
              예외 처리라고 보았지만, <b>실물 아이폰에서 페이지가 통째로 옆으로 밀렸다.</b>
              끝까지 민 제스처가 페이지로 이어지는 그 문제이고, {@code overscroll-behavior-x}는
              iOS 사파리에서 그것을 막아주지 못했다. body의 {@code overflow-x: clip}도
              소용없었다 — 넘쳐서가 아니라 <b>밀어서</b> 생기는 일이라 그렇다.

              <p>그래서 조작을 둘로 갈랐다. <b>스위치</b>가 어디를 보고 있는지 말하고 눌러서도
              넘기게 하며, <b>끌기</b>는 아래 띠가 직접 받는다 — 스크롤 상자를 만드는 대신
              손가락 이동량을 {@code translate}로 옮긴다. 브라우저가 맡는 가로 스크롤이
              아예 없으므로 페이지로 넘어갈 제스처도 없다.

              <p>스위치를 남겨 둔 이유: 끌기는 <b>화면에 보이지 않는 조작</b>이다.
              홈의 "붐빌 것 / 한적할 것"과 같은 모양이라, 이 서비스에서
              "좁은 화면에서 번갈아 보기"는 늘 이렇게 생겼다.

              <p>원안이 먼저다. 스위치 순서도, 넓은 화면의 왼쪽 자리도 —
              "무엇이 어떻게 바뀌었는지"는 앞뒤가 있어야 읽힌다.
            */}
            <div className="flex flex-col gap-3">
              {/*
                스위치. 고른 쪽이 흰 면으로 떠오른다. 홈과 같은 모양이라
                이 서비스에서 "좁은 화면에서 번갈아 보기"는 늘 이렇게 생겼다.

                고른 쪽에 등급색을 칠하지 않는다. 아래 줄마다 이미 배지가 서 있는데
                스위치까지 같은 색을 쓰면 "지금 고른 것"과 "얼마나 붐비는지"가 겹친다.
              */}
              <div className="bg-fill flex gap-1 rounded-[12px] p-1 lg:hidden">
                {['원안', '개선안'].map((label, index) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setComparePage(index)}
                    aria-pressed={comparePage === index}
                    className={`flex-1 cursor-pointer rounded-[9px] py-1.75 text-[12.5px] font-semibold transition-colors ${
                      comparePage === index ? 'bg-surface text-fg shadow-rest' : 'text-hint bg-transparent'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/*
                두 열을 <b>가로로 이어 붙인 띠</b>를 놓고, 창만큼만 보여준다.
                좁은 화면에서는 고른 쪽이 그 창에 들어와 서고, 넓은 화면에서는 띠를 풀어
                둘을 나란히 세운다.

                <p>⚠️ <b>스크롤 상자가 아니라 {@code transform}이다.</b> 이 구분이 이 코드의
                전부다. {@code overflow-x-auto}로 만들면 브라우저가 가로 스크롤을 맡고,
                끝까지 민 제스처가 페이지로 이어져 <b>아이폰에서 화면이 통째로 밀렸다</b> —
                {@code overscroll-behavior-x}로도 막히지 않던 그 문제다. 여기서는 스크롤이
                아예 없다. 손가락 이동량을 우리가 받아 {@code translate}로 옮길 뿐이라
                페이지에 넘겨줄 스크롤 자체가 생기지 않는다.

                <p>{@code touch-pan-y}가 짝이다. 세로는 브라우저에게 그대로 맡기고
                <b>가로 제스처만</b> 우리가 가져온다 — 브라우저가 가로로 밀 일이 없어진다.

                <p>감추는 쪽을 {@code hidden}으로 지우지 않는 이유: 창 밖에 서 있어야
                끌어당길 때 <b>따라 들어온다.</b> 넘길 것이 옆에 있다는 사실 자체가
                이 조작의 유일한 안내다.
              */}
              <div className="overflow-hidden lg:overflow-visible">
                <div
                  className={`flex touch-pan-y items-start gap-0 select-none translate-x-[var(--pane-x)] lg:select-auto lg:grid lg:translate-x-0 lg:grid-cols-2 lg:gap-4 ${
                    // 손가락을 따라오는 동안에는 전환을 끈다. 켜두면 손끝보다 늦게 따라온다
                    dragOffset === 0 ? 'transition-transform duration-300 ease-out' : ''
                  } motion-reduce:transition-none`}
                  /*
                    ⚠️ 옮기는 값을 <b>인라인 style의 transform으로 직접 주지 않는다.</b>
                    인라인이 클래스를 이기므로 넓은 화면의 {@code lg:translate-x-0}이
                    무력해져, 두 열이 나란히 서야 할 자리에서 한 열이 밖으로 밀려난다.
                    변수만 인라인으로 넘기고 <b>쓸지 말지는 클래스가 정한다.</b>

                    <p>모바일에서 열 사이 간격이 0인 것도 같은 이유다 — 간격이 있으면
                    100%만 옮겨서는 다음 열이 그 폭만큼 어긋나 선다.
                  */
                  style={
                    { '--pane-x': `calc(${-comparePage * 100}% + ${dragOffset}px)` } as CSSProperties
                  }
                  onPointerDown={(event) => {
                    // 마우스 오른쪽 버튼·보조 포인터는 제스처가 아니다
                    if (!event.isPrimary) {
                      return
                    }
                    dragRef.current = { x: event.clientX, y: event.clientY, axis: 'none' }
                  }}
                  onPointerMove={(event) => {
                    const drag = dragRef.current
                    if (drag === null) {
                      return
                    }
                    const dx = event.clientX - drag.x
                    const dy = event.clientY - drag.y
                    if (drag.axis === 'none') {
                      // 8px을 넘어선 쪽으로 축을 정한다. 그 전에는 아무 일도 하지 않는다
                      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) {
                        return
                      }
                      drag.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
                      if (drag.axis === 'y') {
                        // 세로로 정해졌으면 이 제스처는 끝까지 브라우저 것이다
                        dragRef.current = null
                        return
                      }
                      // 손가락이 카드 밖으로 나가도 계속 받는다
                      event.currentTarget.setPointerCapture(event.pointerId)
                    }
                    /*
                      끝 장에서 더 끌면 <b>1/4만 따라온다.</b> 아예 안 움직이면 고장으로,
                      그대로 따라오면 뒤에 한 장 더 있는 것으로 읽힌다. 저항이 "여기가 끝"을 말한다.
                    */
                    const atEdge = (comparePage === 0 && dx > 0) || (comparePage === 1 && dx < 0)
                    setDragOffset(atEdge ? dx / 4 : dx)
                  }}
                  onPointerUp={(event) => {
                    const drag = dragRef.current
                    dragRef.current = null
                    if (drag === null || drag.axis !== 'x') {
                      return
                    }
                    /*
                      창 너비의 1/5을 넘겨야 장이 넘어간다. 절반을 요구하면 한 손으로는
                      닿지 않고, 더 짧게 잡으면 세로로 훑다 스친 손가락에도 넘어간다.
                    */
                    const width = event.currentTarget.clientWidth
                    const moved = event.clientX - drag.x
                    if (Math.abs(moved) > width / 5) {
                      setComparePage(moved < 0 ? 1 : 0)
                    }
                    setDragOffset(0)
                  }}
                  onPointerCancel={() => {
                    dragRef.current = null
                    setDragOffset(0)
                  }}
                >
                  <div className="w-full shrink-0">
                    <CourseColumn
                      title="원안"
                      subtitle="내가 처음 짠 코스"
                      score={showBefore ? beforeDiagnosis.totalQuietness : null}
                      scoreLevel={beforeDiagnosis.totalLevel}
                      diagnosis={beforeDiagnosis}
                    />
                  </div>
                  <div className="w-full shrink-0">
                    <CourseColumn
                      title="개선안"
                      subtitle={
                        /*
                          ⚠️ 아무것도 안 바꾸면 이 열은 <b>원안과 글자 하나 다르지 않다.</b>
                          그런데 부제가 "더 한적한 코스"라고 말하고 있었다 — 같은 코스를 두 번
                          그려 놓고 한쪽만 더 한적하다고 부른 셈이다. 잰 것만 말한다.
                        */
                        changes.length > 0
                          ? `다른 곳 ${changes.length}곳 발견`
                          : movedDate
                            ? '날짜를 옮긴 코스'
                            : '원안과 같아요'
                      }
                      score={showAfter ? afterDiagnosis.totalQuietness : null}
                      scoreLevel={afterDiagnosis.totalLevel}
                      diagnosis={afterDiagnosis}
                      changes={changes}
                      /*
                        바꾼 것이 하나도 없으면 두 열이 같은 코스다. 그때 한쪽에만 "추천" 배지를
                        달면 <b>같은 것 둘 중 하나를 고르라</b>는 말이 된다. 권할 것이 있을 때만 선다.
                      */
                      highlighted={summary.length > 0}
                    />
                  </div>
                </div>
              </div>
            </div>
            </>
          )}

          {/*
            지도가 이 자리를 <b>혼자 다 쓴다.</b>

            예전에는 왼쪽에 "변경 내역", 오른쪽에 지도를 5:7로 나눠 놓았다. 그런데
            변경 내역이 말하던 것(무엇을 무엇으로 바꿨나 · 왜 그곳인가)은 <b>바로 위 두 열이
            이미 나란히 보여주고</b>, 근거는 개선안 열의 바뀐 줄 아래로 옮겼다.
            같은 말을 세 번 하던 것을 두 번으로 줄이고, 남는 폭을 지도에 주었다.

            <p>날짜 이동도 히어로 아래 출처 줄이 "원안 9월 5일 · 개선안 9월 8일 기준"으로
            이미 말한다 — 따로 카드를 세울 이유가 없다.
          */}
          <section className={`${CARD_RAISED} min-w-0`}>
            <div className="flex flex-wrap items-center justify-between gap-2 px-4.5 pt-4 pb-3">
              <h2 className="text-fg text-[15px] font-semibold">최종 동선</h2>

              {/*
                하루짜리 일정에는 고를 것이 없다. 탭이 하나뿐이면 누를 수 있다는
                신호만 주고 아무것도 바뀌지 않아 오히려 헷갈린다.
              */}
              {state.days.length > 1 && (
                <div className="flex gap-1.5" role="group" aria-label="지도에 표시할 일차">
                  {/*
                    <b>일차가 먼저, 전체가 마지막이다.</b>

                    탭은 왼쪽부터 읽힌다. "전체"를 앞에 두면 하루씩 보려는 사람이 늘
                    그것을 지나쳐 가야 하고, 무엇보다 <b>Day 1이 첫 칸이 아니어서</b>
                    일정의 순서와 탭의 순서가 어긋난다 — 아래 타임라인은 1일차부터
                    시작하는데 탭만 다른 것으로 열린다.

                    전체는 하루하루를 다 본 뒤 <b>합쳐 보는</b> 자리라 끝이 제자리다.
                  */}
                  {([...state.days.map((_, index) => index + 1), 'all'] as const).map(
                    (tab) => {
                      const active = tab === mapDay
                      return (
                        <button
                          key={tab}
                          type="button"
                          /*
                            초점 링이 전역으로 brand-deep인데, <b>고른 탭은 배경이 잉크</b>라
                            그 위에서 1.51:1이 된다 — 키보드로 훑을 때 <b>지금 어디에 있는지가
                            하필 현재 탭에서만</b> 사라졌다. 어두운 면에서는 흰 링으로 바꾼다.
                          */
                          className={`rounded-chip h-8 cursor-pointer px-3 text-[12.5px] font-semibold whitespace-nowrap transition-colors ${
                            active
                              ? 'bg-fg text-white focus-visible:outline-white'
                              : 'bg-bg text-hint hover:text-fg'
                          }`}
                          aria-pressed={active}
                          onClick={() => setMapDay(tab)}
                        >
                          {tab === 'all' ? '전체' : `Day ${tab}`}
                        </button>
                      )
                    },
                  )}
                </div>
              )}
            </div>

            {/*
              지도는 자기 모서리와 테두리를 그대로 들고 카드 안에 들어앉는다.
              카드 모서리에 맞춰 깎으려면 지도 쪽 클래스를 덮어써야 하는데,
              같은 속성(border-radius)을 두 클래스가 다투게 되어 순서에 따라 결과가 갈린다.
            */}
            <div className="px-4.5 pb-4">
              {/* 읽기 전용. onSelect를 넘기지 않으면 마커를 누를 수 없다. */}
              <CourseMap
                places={visiblePlaces}
                routes={visibleRoutes}
                className="lg:h-[380px]"
              />
            </div>

            {state.days.length > 1 && (
              <p className="text-hint m-0 px-4.5 pb-4 text-[12.5px] whitespace-pre-line">
                {mapDay === 'all'
                  ? '마커 번호는 “일차-순서”예요.\n일차를 고르면 그 날만 볼 수 있어요.'
                  : `Day ${mapDay}에 담은 ${visibleRoutes[0].length}곳만 순서대로 보여주고 있어요.`}
              </p>
            )}
          </section>

          {/*
            버튼 문구는 그 버튼이 실제로 하는 일만 말한다.

            앞서 쓰던 "원안 유지"는 되돌리는 동작을 약속하는 이름인데, 실제로는 진단 화면으로
            돌아가기만 했다. 교체한 장소가 그대로 남아 있으니 이름이 거짓말을 한 셈이다.
            "개선안으로 저장하기"도 마찬가지로, 아무것도 안 바꾼 코스까지 개선안이라고 불렀다.

            두 버튼 다 무엇을 바꿨는지와 무관하게 뜻이 같으므로 문구를 고정한다.
          */}
          {/*
            나가는 길이 셋이다. 무게를 다르게 준다.

            돌아가기·저장하기는 한 줄에 두고, "홈으로"는 그 아래 조용한 버튼으로 둔다.
            셋을 같은 굵기로 늘어놓으면 어느 것이 이 화면의 결론인지가 사라진다.

            홈으로가 필요한 이유: 진단만 보고 <b>저장도 수정도 하지 않을</b> 사람이 있다.
            그때 이 화면에서 나갈 길이 "진단으로 되돌아가기"뿐이면 막다른 길이 된다.
            게스트가 로그인 없이 서비스 전체를 한 바퀴 도는 흐름의 마지막 문이다.
          */}
          <section className="flex flex-col items-center gap-2.5 pb-2">
            {/* 넓은 화면에서 버튼을 1180px까지 늘리지 않는다. 누르는 자리가 넓다고 잘 눌리지 않는다 */}
            <div className="flex w-full gap-2.5 lg:mx-auto lg:max-w-read">
              {/*
                DOM 순서가 곧 화면 순서다(왼쪽 돌아가기, 오른쪽 저장하기).
                앞서 쓰던 flex-row-reverse는 좁은 화면에서 세로로 쌓을 때 저장하기를
                위로 올리려던 장치인데, 이제 항상 한 줄이라 순서를 뒤집을 이유가 없다.
                뒤집힌 채로 두면 키보드로 훑는 차례와 눈에 보이는 차례가 어긋난다.
              */}
              <Link
                to="/diagnosis"
                className={`${SECONDARY_BUTTON} grid flex-none place-items-center px-5.5 no-underline`}
              >
                돌아가기
              </Link>
              {/*
                이 화면의 결론. 남는 폭을 다 가져가 가장 크게 선다.

                <b>총점이 없으면 저장할 수 없다.</b> 저장은 그때의 점수를 스냅샷으로 함께
                남기는 일인데, 남길 점수가 없으면 나중에 열어도 비교할 것이 없다.
                버튼을 눌러 보고 실패하게 두는 대신 미리 잠그고 <b>이유를 옆에 적는다</b> —
                잠긴 채 아무 말 없는 버튼은 고장으로 읽힌다.

                ⚠️ <b>잠그는 것은 점수가 아예 없을 때(null)뿐이다.</b> 근거가 얇아 화면에
                숫자를 안 띄우는 코스(totalPresentable=false)는 저장할 수 있다 —
                그때는 점수와 함께 <b>모수</b>를 남겨서, 나중에 열었을 때
                "관광지 5곳 중 2곳 기준"이라고 정직하게 말한다. 숫자를 감추는 것과
                저장을 막는 것은 다른 일이고, 묶어 두면 경주 코스의 41.7%가 저장 불가가 된다.
              */}
              {/*
                로그인하지 않았으면 <b>로그인 화면으로 바로 보낸다.</b>

                예전에는 시트를 먼저 열어 "회원가입하고 저장하기 / 이미 계정이 있어요"를
                고르게 했다. 그런데 <b>카카오·네이버 로그인은 로그인 화면에만 있다</b> —
                가입을 먼저 권하는 바람에 소셜로 들어오려던 사람에게 그 길이 아예 안 보였다.
                로그인 화면에서 회원가입으로 넘어가는 링크는 이미 있고 돌아올 곳(state)도
                함께 넘어가므로, 한쪽만 열어 두는 편이 길이 짧다.

                확인이 끝나기 전에는 잠근다. 그 사이에 누르면 로그인한 사람도
                로그인 화면으로 튕긴다.
              */}
              <button
                type="button"
                className={`${PRIMARY_BUTTON} flex-1 disabled:cursor-not-allowed disabled:opacity-45`}
                disabled={authLoading}
                onClick={() =>
                  member
                    ? setShowSavePrompt(true)
                    : navigate('/login', { state: { from: location.pathname } })
                }
              >
                {/*
                  저장을 마치면 버튼이 <b>다음에 할 일</b>로 이름을 바꾼다.

                  같은 자리에 "저장하기"가 그대로 서 있으면, 방금 저장한 사람에게
                  아직 저장하지 않았다고 말하는 셈이다 — 실제로 그래서 한 번 더 눌렸고
                  코스가 둘이 됐다. 이제 두 번째 누름은 <b>덮어쓰기</b>이고, 문구가 그것을 말한다.
                */}
                {savedName === null ? '저장하기' : '저장한 코스 고치기'}
              </button>
            </div>

            {/*
              저장이 끝났다는 사실이 <b>화면에 남는다.</b>

              시트의 "계정에 저장했어요"는 닫으면 사라지고, 그 뒤에는 아무것도 바뀌지 않은
              같은 화면만 남았다 — 방금 한 일의 흔적이 어디에도 없었다.
              이름을 함께 적어, 마이페이지에서 무엇을 찾으면 되는지까지 말한다.
            */}
            {savedName !== null && (
              <p className="text-quiet-deep m-0 text-center text-[12.5px] leading-[1.6] font-medium">
                '{savedName}' 이름으로 저장했어요.
                <br />
                마이페이지에서 다시 열어 볼 수 있어요.
              </p>
            )}

            {/*
              <b>점수가 없어도 저장을 막지 않는다.</b> 예전에는 버튼을 잠갔는데, 그러면
              여행일이 예측 창 밖이라 <b>아직</b> 진단되지 않은 코스를 짜 둘 수가 없었다 —
              미리 계획해 두고 여행이 가까워지면 다시 진단하는 흐름이 통째로 막힌다.

              저장은 <b>재료</b>(지역·날짜·장소·순서)를 남기는 일이고, 점수 스냅샷은 있으면
              함께 남기는 것이다. 없는 채로 저장된 코스는 마이페이지에서 "아직 진단 전"으로 선다.

              대신 무엇이 빠진 채 저장되는지는 말해 준다. 아무 말 없이 저장하면
              나중에 열었을 때 점수가 왜 비어 있는지 알 수 없다.
            */}
            {afterTotal === null && (
              <p className="text-hint m-0 text-center text-[12.5px] leading-[1.6]">
                아직 예상 혼잡을 매기지 못한 코스예요.
                <br />
                저장은 되고, 나중에 열어 다시 진단할 수 있어요.
              </p>
            )}

            {/*
              테두리도 배경도 없는 조용한 버튼. 그래도 높이는 넉넉히 준다 —
              눈에 덜 띄어야 하는 것과 누르기 어려워야 하는 것은 다른 이야기다.
            */}
            <Link
              to="/"
              className="text-hint hover:bg-surface hover:text-fg rounded-ui grid min-h-11 w-full place-items-center text-[14px] font-medium no-underline transition-colors lg:mx-auto lg:max-w-read"
            >
              홈으로
            </Link>
          </section>

          {/*
            저장은 화면을 옮기지 않고 시트로 묻는다. 결과를 보다가 곁들이는 행동이라,
            뒤에 비교 결과가 비쳐 보이는 편이 맥락을 유지해준다.
          */}
          {showSavePrompt && (
            <SaveCourseSheet
              defaultName={defaultCourseName}
              /*
                고쳐 쓰는 중이면 시트가 그렇게 말하고, 공개 토글도 저장해둔 값으로 선다.
                켜짐을 기본으로 두면 비공개로 저장한 코스가 고치는 것만으로 홈에 나간다.
              */
              editing={state.source !== null}
              defaultPublic={state.source?.isPublic ?? true}
              onClose={() => setShowSavePrompt(false)}
              onSave={async (name, isPublic) => {
                const body = {
                  name,
                  region: plan.region,
                  startDate: plan.startDate,
                  nights: plan.nights,
                  /*
                    방금 진단에서 받은 총점을 그대로 싣는다. 서버가 다시 계산하지 않는다.
                    총점이 없으면 저장 버튼이 잠겨 있어 여기까지 오지 않는다.

                    <b>모수를 함께 남긴다.</b> 점수만 남기면 나중에 열었을 때 관광지 다섯 곳 중
                    하나만 진단된 코스인지 다섯이 다 진단된 코스인지 구분할 수 없다.
                  */
                  /*
                    <b>0으로 채우지 않는다.</b> 0은 화면에서 "매우 붐빔"으로 읽혀,
                    재보지도 않은 코스를 최악이라고 말하게 된다. 서버도 null을 받는다.
                  */
                  totalQuietness: afterTotal,
                  // 저장 시트의 토글이 정한다. 서버는 값이 없으면 비공개로 받는다.
                  isPublic,
                  diagnosedCount: afterDiagnosis.diagnosedCount,
                  forecastTargetCount: afterDiagnosis.forecastTargetCount,
                  slots: toSlots(state.days),
                }

                /*
                  <b>어디서 왔는지가 새로 만들지 고쳐 쓸지를 가른다.</b>

                  마이페이지의 "수정하기"로 들어왔으면 source가 있고, 그 코스를 덮어쓴다.
                  예전에는 이 갈래가 없어 늘 새로 만들었고, 한 번 고칠 때마다 목록에
                  같은 이름의 코스가 하나씩 쌓였다.

                  ⚠️ 조건 화면을 다시 지나면 source가 지워진다. 장소를 전부 버린 코스로
                  옛 것을 덮어쓰면 되돌릴 수 없기 때문이다.
                */
                const saved = state.source
                  ? await updateCourse(state.source.courseId, body)
                  : await saveCourse(body)

                /*
                  ⚠️ <b>저장하고 나면 그 코스를 고쳐 쓸 대상으로 찍는다.</b>

                  이 줄이 없던 동안에는 새로 저장한 뒤에도 source가 계속 null이라,
                  시트를 닫고 저장 버튼을 <b>한 번 더 누르면 같은 코스가 하나 더 생겼다.</b>
                  화면에는 아무것도 바뀌지 않아 "안 눌렸나" 싶어 다시 누르기 쉬운 자리다.

                  서버가 돌려준 값을 그대로 쓴다. 방금 보낸 이름·공개 여부를 우리가 다시
                  조립하면 서버가 다듬은 것(앞뒤 공백 등)과 어긋난다.
                */
                markSaved({ courseId: saved.id, name: saved.name, isPublic: saved.isPublic })
                setSavedName(saved.name)

                /*
                  저장한 코스의 id를 시트에 돌려준다. 시트가 곧바로 "여행에 담기"를 펴는데,
                  담으려면 어느 코스인지 알아야 한다.
                */
                return saved.id
              }}
            />
          )}
        </>
      )}
    </div>
  )
}
