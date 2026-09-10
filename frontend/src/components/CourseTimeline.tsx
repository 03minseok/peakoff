import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, MapIcon } from './icons'
import { CourseMap } from './CourseMap'
import { PlaceThumbnail } from './PlaceThumbnail'
import type { Place } from '../types/api'
import { addDays, formatMonthDay, formatWeekday } from '../utils/date'

/**
 * 코스에 담긴 장소 한 곳 — <b>화면이 쓰는 모양</b>.
 *
 * <h3>왜 서버 타입을 그대로 받지 않는가</h3>
 * 같은 것을 세 군데가 조금씩 다른 이름으로 들고 있다. 남의 코스는 {@code name},
 * 내가 저장한 코스는 {@code placeName}이다. 서버 타입 하나를 골라 받으면 나머지가
 * 캐스팅으로 밀려 들어오고, 이름이 다른 쪽은 <b>빈 칸</b>으로 그려진다.
 *
 * <p>그래서 부르는 쪽이 <b>이 모양으로 맞춰서</b> 넘긴다. 옮기는 코드는 한 줄이고,
 * 그 한 줄이 어느 필드가 이름인지를 그 자리에서 밝힌다.
 */
export interface TimelinePlace {
  day: number
  order: number
  placeId: string
  /** 저장 시점의 이름. <b>화면에 서는 것은 이 값이다</b> */
  name: string
  /**
   * 지금의 장소 — 사진·분류·좌표.
   *
   * <p>⚠️ <b>null일 수 있다.</b> 공사 카탈로그에서 사라졌거나 호출이 실패한 경우다.
   * 그때는 사진 자리에 대체면이 서고 분류 줄은 비며, 지도에도 오르지 않는다.
   * 이름은 위 스냅샷이 지킨다.
   */
  place: Place | null
}

interface Props {
  places: TimelinePlace[]
  /** 일차 수. 장소가 없는 날도 자리를 지켜야 해서 목록 길이로는 못 센다 */
  days: number
  /** 1일차의 날짜. 나머지 일차는 여기서 세어 붙인다 */
  startDate: string
  /** 없으면 장소 줄이 눌리지 않는다 — 읽기만 하는 자리가 된다 */
  onOpenPlace?: (place: TimelinePlace) => void
}

/**
 * 코스 한 벌을 <b>일차별 타임라인</b>으로 편다. 아래에 코스 동선을 접어 둔다.
 *
 * <h3>왜 공용인가</h3>
 * 같은 코스가 세 자리에 뜬다 — 홈의 남의 코스 시트, 공유 링크 화면, 그리고 마이페이지의
 * 내 코스 상세. 각자 그리면 <b>같은 코스가 화면마다 다르게 보인다.</b> 실제로 그랬다:
 * 앞의 둘은 사진과 분류가 붙은 타임라인이었는데 마이페이지만 {@code 1-1 여수수산물특화시장}
 * 한 줄이었다.
 *
 * <p>{@code PublicCourseArticle}이 게이지와 "이 코스로 짜보기"까지 함께 들고 있어
 * 마이페이지가 통째로 쓸 수는 없었다 — 거기는 "수정하기"와 공유 버튼이 서는 자리다.
 * 그래서 <b>둘이 실제로 공유하는 만큼만</b> 떼어 왔다.
 */
export function CourseTimeline({ places, days, startDate, onOpenPlace }: Props) {
  /*
   * 일차별로 묶는다.
   *
   * 마이페이지 겹창은 예전에 `1-1`, `1-2`처럼 번호를 앞에 달아 한 줄로 늘어놓았다.
   * "내가 짠 코스라 이미 아는 일정"이라는 이유였는데, 아는 일정일수록 <b>어느 날 어디였는지</b>가
   * 먼저 읽혀야 한다 — 번호 두 개를 읽고 머릿속에서 날짜로 옮기는 일을 사용자에게 시킬 이유가 없다.
   */
  const byDay = useMemo(() => {
    const grouped: TimelinePlace[][] = Array.from({ length: days }, () => [])
    places.forEach((place) => {
      grouped[place.day - 1]?.push(place)
    })
    return grouped
  }, [places, days])

  /** 동선을 펼쳤는가. 닫혀 있는 동안에는 지도를 아예 만들지 않는다 */
  const [mapOpen, setMapOpen] = useState(false)

  /*
    ⚠️ {@code useMemo}가 필수다. 매 렌더 새 배열을 만들면 CourseMap의 다시 그리기 effect가
    매번 돌아 지도가 깜박인다 — 진단·최종 화면이 같은 이유로 memo를 쓴다.
  */
  const mapPlaces = useMemo<Place[]>(
    () => places.map((place) => place.place).filter((place): place is Place => place !== null),
    [places],
  )
  /*
    일차별로 선을 따로 긋는다. 하나로 이으면 <b>밤사이 이동이 경로처럼</b> 보인다.
    지도에 못 오른 장소(좌표 없음)는 여기서도 빠져야 선이 끊긴 자리를 건너뛰지 않는다.
  */
  const mapRoutes = useMemo(() => {
    const onMap = new Set(mapPlaces.map((place) => place.id))
    return Array.from({ length: days }, (_, index) =>
      places
        .filter((place) => place.day === index + 1 && onMap.has(place.placeId))
        .map((place) => place.placeId),
    ).filter((route) => route.length > 0)
  }, [places, days, mapPlaces])

  return (
    <>
      <div className="border-line/60 flex flex-col gap-4 border-t pt-4">
        {byDay.map((dayPlaces, index) => (
          <div key={index} className="flex flex-col gap-2">
            {/*
              일차 옆에 <b>실제 날짜</b>를 적는다. "1일차"만으로는 언제 떠나는 여행인지
              위 부제("9월 23일 → 9월 24일")를 되짚어 세어야 알 수 있다 — 이틀이면 되짚을
              만하지만 3박 4일이면 못 센다.
            */}
            <div className="flex items-baseline gap-2">
              <span className="text-fg text-[13px] font-bold">{index + 1}일차</span>
              <span className="text-hint text-[11.5px]">
                {formatMonthDay(addDays(startDate, index))} (
                {/* "화요일" → "화". 줄이 짧아 요일까지 적으면 날짜보다 길어진다 */}
                {formatWeekday(addDays(startDate, index)).charAt(0)})
              </span>
            </div>
            {dayPlaces.length === 0 ? (
              // 빈 일차를 건너뛰지 않는다. 건너뛰면 2박 3일인데 이틀만 있는 것처럼 보인다.
              <span className="text-hint pl-1 text-[13px]">담긴 장소가 없어요</span>
            ) : (
              <ul className="m-0 flex list-none flex-col p-0">
                {dayPlaces.map((place, placeIndex) => (
                  <PlaceRow
                    key={`${place.day}-${place.order}-${place.placeId}`}
                    place={place}
                    last={placeIndex === dayPlaces.length - 1}
                    onOpen={onOpenPlace}
                  />
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      {/*
        ■ <b>동선은 접어 둔다</b>

        이 창은 먼저 <b>읽는 자리</b>라 지도가 펴진 채로 열리면 목록이 아래로 밀려,
        무엇이 담겼는지 보려고 스크롤부터 해야 한다. 그리고 지도는 카카오 SDK를 부르므로
        <b>열지 않은 사람은 부르지 않는 편</b>이 낫다 — 코스를 훑고 닫는 사람이 대부분이다.

        <p>⚠️ 좌표가 있는 장소만 지도에 오른다. 공사 카탈로그에서 사라진 장소는
        {@code place}가 비어 있어({@link TimelinePlace} 주석) 찍을 자리가 없다.
      */}
      {mapPlaces.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {/*
            ■ 오른쪽에 <b>작은 지도 그림</b>이 선다

            글자와 꺾쇠만 있는 줄은 위의 장소 줄들과 같은 무게라 "여기부터 다른 것"이
            안 읽혔다. 핀 넷과 점선 한 가닥이 카드 오른쪽에서 잘려 들어오면, 누르기 전에
            <b>무엇이 열리는지</b>가 보인다.

            <p>그림은 카드 세로 여백을 넘어 위아래에 물린다({@code -my-3.5}). 여백 안에
            얌전히 들어앉으면 스티커처럼 붙어 보이고, 가장자리를 넘겨야 카드의 일부가 된다.
          */}
          <button
            type="button"
            onClick={() => setMapOpen((open) => !open)}
            aria-expanded={mapOpen}
            className="bg-brand-tint hover:bg-brand-soft/45 rounded-card flex w-full cursor-pointer items-center gap-3 overflow-hidden py-3.5 pr-3.5 pl-4 text-left press"
          >
            <span className="text-brand-deep flex-none">
              <MapIcon size={26} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-fg text-[14px] font-bold">코스 동선 보기</span>
              {/* 색 면 위의 보조 글자는 회색이 아니라 그 색의 진한 단계로 — 회백에 회색을 얹으면 묻는다 */}
              <span className="text-brand-deep text-[12px]">{mapPlaces.length}곳을 지도로 한눈에</span>
            </span>
            {/* 좁은 화면에서는 그림을 조금 줄인다 — 116px이면 부제가 "한 / 눈에"로 꺾인다 */}
            <RouteSketch className="-my-3.5 h-[72px] w-[100px] flex-none sm:w-[116px]" />
            <span className="text-brand-deep flex-none">
              {mapOpen ? <ChevronDown /> : <ChevronRight />}
            </span>
          </button>
          {/*
            ⚠️ 열었다 닫으면 <b>지도를 떼어낸다</b>(조건부 렌더). 감춰만 두면 카카오 지도가
            폭 0인 상자 안에서 계속 살아 있다가, 다시 열 때 타일을 못 그린다.
          */}
          {mapOpen && <CourseMap places={mapPlaces} routes={mapRoutes} className="h-[240px]" />}
        </div>
      )}
    </>
  )
}

/**
 * 코스 한 줄 — 번호·사진·이름·분류, 그리고 누르면 장소 상세.
 *
 * <h3>왜 사진과 분류가 붙었나</h3>
 * 이름만 늘어놓던 목록은 <b>어느 코스나 같은 모양</b>이었다. 여수와 경주가 글자만 다른
 * 여섯 줄로 보이니, 남의 여행을 구경하러 열어도 볼 것이 없었다.
 *
 * <p>분류 자리에 <b>한 줄 소개를 쓰고 싶지만 가진 것이 없다.</b> 공사 국문 관광정보에는
 * 짧은 설명 필드가 없고({@code overview}는 118~1,399자다) 장소마다 상세를 부르면 이 창
 * 하나에 호출이 여섯 번 나간다. 그래서 <b>이미 들고 있는 분류명</b>을 세운다 —
 * 지어내지 않고, 가진 것으로 말한다.
 *
 * <h3>줄을 잇는 선</h3>
 * 번호 아래로 점선이 다음 줄까지 내려간다. 마지막 줄에는 긋지 않는다 — 이어질 곳이 없다.
 * 선이 있어야 여섯 줄이 <b>목록이 아니라 순서</b>로 읽힌다.
 *
 * <h3>⚠️ 누를 수 있는 줄과 아닌 줄</h3>
 * {@code onOpen}이 없으면 {@code <div>}로 선다. 눌러도 아무 일이 없는 {@code <button>}은
 * 키보드로 훑는 사람에게 <b>있지도 않은 문</b>을 하나씩 세워 보인다.
 */
function PlaceRow({
  place,
  last,
  onOpen,
}: {
  place: TimelinePlace
  last: boolean
  onOpen?: (place: TimelinePlace) => void
}) {
  const body = (
    <>
      {/* 번호와 점선. 줄 높이가 사진(56px)에 맞춰지므로 선도 그만큼 내려간다 */}
      <span className="flex flex-none flex-col items-center self-stretch">
        <span className="bg-bg text-hint grid h-6 w-6 flex-none place-items-center rounded-full font-mono text-[11px] font-semibold">
          {place.order}
        </span>
        {!last && (
          <span className="border-line mt-1 w-0 flex-1 border-l border-dashed" aria-hidden="true" />
        )}
      </span>

      <PlaceThumbnail imageUrl={place.place?.imageUrl ?? null} size="row" />

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-fg truncate text-[14px] font-semibold">{place.name}</span>
        {/*
          분류를 못 받은 줄은 <b>자리를 비운다.</b> "정보 없음" 같은 말을 채우면
          공사가 안 준 것을 우리가 못 채운 것처럼 읽힌다.
        */}
        {place.place?.categoryName && (
          <span className="text-hint truncate text-[12px]">{place.place.categoryName}</span>
        )}
      </span>

      {onOpen && (
        <span className="text-hint flex-none">
          <ChevronRight />
        </span>
      )}
    </>
  )

  return (
    <li>
      {onOpen ? (
        <button
          type="button"
          onClick={() => onOpen(place)}
          /*
            hover 배경을 두지 않는다. 사진·이름·분류가 이미 한 줄을 채우고 있어 그 위에
            회색 면이 켜지면 줄이 <b>선택된 것</b>처럼 읽힌다 — 이 줄은 고르는 자리가
            아니라 펼쳐 보는 문이다. 눌림은 press가, 초점은 focus-visible 링이 맡는다.
          */
          className="rounded-ui flex w-full cursor-pointer items-center gap-3 bg-transparent px-1 py-1.5 text-left press"
        >
          {body}
        </button>
      ) : (
        <div className="flex items-center gap-3 px-1 py-1.5">{body}</div>
      )}
    </li>
  )
}

/**
 * "코스 동선 보기" 카드에 붙는 작은 지도 그림 — 핀 넷과 그 사이를 잇는 점선.
 *
 * <h3>진짜 지도의 말을 빌린다</h3>
 * 점선의 색은 {@code CourseMap}이 경로에 쓰는 그 색({@code --c-quiet-strong})이다.
 * 누르면 열리는 지도에서 같은 색의 선을 만나야, 이 그림이 <b>예고</b>로 읽힌다.
 * 핀도 같은 색이다 — 지도 위의 표식은 한 색으로 묶여야 하나의 코스로 보인다.
 *
 * <h3>땅은 두 가지 옅은 면으로만</h3>
 * 지도 타일을 흉내 내지 않는다. 카드 바탕(브랜드 tint) 위에 한적 tint와 순백을
 * 둥글게 얹으면 물과 뭍의 인상만 남는다 — 이 크기(116×72)에서 도로나 글자를 그리면
 * 얼룩이 된다.
 *
 * <h3>왼쪽을 흐려 글자에 물린다</h3>
 * 그림이 글자 쪽으로 다가오는 가장자리를 마스크로 걷어 낸다. 잘린 직선이 글자 옆에
 * 서면 칸막이처럼 보이고, 흐려지며 사라져야 <b>카드 바탕에서 떠오르는 그림</b>이 된다.
 *
 * <p>좌표는 viewBox 0 0 116 72 기준이다. 핀은 뾰족한 끝이 원점에 오도록 그려 두고,
 * 자리마다 {@code translate}로 옮기고 {@code scale}로 크기를 조금씩 달리한다 —
 * 같은 크기 넷이 나란히 서면 도장 찍은 것처럼 보인다.
 */
function RouteSketch({ className = '' }: { className?: string }) {
  /** 뾰족한 끝이 (0, 0)인 핀 하나. 머리 가운데 흰 점이 지도 핀의 문법을 완성한다 */
  const pin = (x: number, y: number, scale: number) => (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path
        d="M0 0C-3.4-4.2-6.4-7.4-6.4-11a6.4 6.4 0 0 1 12.8 0c0 3.6-3 6.8-6.4 11z"
        fill="var(--c-quiet-strong)"
      />
      <circle cx="0" cy="-11" r="2.4" fill="var(--c-surface)" />
    </g>
  )

  return (
    <svg
      viewBox="0 0 116 72"
      className={`[mask-image:linear-gradient(to_right,transparent,black_24%)] ${className}`}
      aria-hidden="true"
    >
      {/* 뭍 둘, 물 하나. 카드 오른쪽 위·아래 모서리에서 물려 들어온다 */}
      <ellipse cx="96" cy="8" rx="44" ry="26" fill="var(--c-quiet-tint)" />
      <ellipse cx="34" cy="70" rx="46" ry="24" fill="var(--c-quiet-tint)" />
      <ellipse cx="72" cy="42" rx="30" ry="16" fill="var(--c-surface)" opacity="0.7" />

      {/* 경로. 진짜 지도의 선과 같은 색·같은 점선 */}
      <path
        d="M16 54C26 42 32 32 42 30S62 44 70 42S92 24 100 20"
        fill="none"
        stroke="var(--c-quiet-strong)"
        strokeWidth="1.6"
        strokeDasharray="3 3"
        strokeLinecap="round"
      />

      {pin(16, 54, 0.9)}
      {pin(42, 30, 1)}
      {pin(70, 42, 0.85)}
      {pin(100, 20, 1.1)}
    </svg>
  )
}
