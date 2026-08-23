import type { Place } from '../types/api'

/**
 * 한 번이라도 화면에 나온 장소를 id로 기억한다.
 *
 * <h3>왜 필요한가</h3>
 * 화면들은 <b>지금 목록에 있는 장소만</b> 알고 있었다. 코스에는 장소 id만 담기 때문에,
 * 목록이 바뀌는 순간 담아둔 장소가 누구인지 알 수 없게 된다. 실제로 이렇게 깨졌다:
 *
 * <pre>
 * "피자옥"을 검색해 담는다  →  검색창을 비운다  →  목록이 대표 관광지로 바뀐다
 *                          →  피자옥이 목록에 없다  →  이름 대신 id(숫자)가 뜨고 마커도 사라진다
 * </pre>
 *
 * 최종 동선 지도도 같은 이유로 비었다. 대표 관광지 100곳만 받아와 그중에서 골라 그렸는데,
 * 검색으로 담은 음식점은 애초에 그 100곳에 없다.
 *
 * <h3>왜 sessionStorage인가</h3>
 * 코스(장소 id 목록)가 sessionStorage에 남는데 장소 정보만 메모리에 두면,
 * <b>새로고침 한 번에 다시 숫자가 된다.</b> 둘의 수명을 맞춘다.
 * localStorage가 아닌 이유는 코스와 같다 — 게스트 이용은 1회성이다.
 *
 * <h3>이것은 공사 데이터 캐시가 아니다</h3>
 * 여기 담기는 것은 <b>이름·좌표·사진처럼 변하지 않는 정보</b>뿐이다. 한적도·추천도는
 * 들어오지 않는다. 점수를 기억해 두면 예측이 갱신돼도 옛 숫자를 계속 보여주게 되고,
 * 대안 목록을 통째로 기억하면 추천 분산이 죽는다(alternativeCache의 주석 참고).
 */
const STORAGE_KEY = 'peakoff.places'

/**
 * 기억할 수 있는 최대 장소 수.
 *
 * 검색을 많이 할수록 계속 쌓이므로 상한이 필요하다. sessionStorage는 탭당 5MB쯤이고
 * 장소 하나가 200바이트 안팎이라 500곳이면 100KB 수준이다.
 * 넘치면 <b>오래된 것부터 버린다</b> — 방금 본 장소일수록 코스에 담겼을 가능성이 높다.
 */
const MAX_ENTRIES = 500

/**
 * id → 장소. Map은 넣은 순서를 지키므로 <b>맨 앞이 가장 오래된 것</b>이다.
 * 이미 있는 id를 다시 넣을 때 지웠다가 넣으면 "최근 본 것"으로 올라온다.
 */
const memory = new Map<string, Place>(load())

/** 저장된 값이 지금 코드가 기대하는 모양인지 본다. 아니면 없는 것으로 친다. */
function isPlace(value: unknown): value is Place {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const place = value as Record<string, unknown>
  return (
    typeof place.id === 'string' &&
    typeof place.name === 'string' &&
    typeof place.latitude === 'number' &&
    typeof place.longitude === 'number'
  )
}

function load(): [string, Place][] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return []
    }
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.filter(isPlace).map((place) => [place.id, place])
  } catch {
    // 저장소를 못 쓰는 환경(사파리 시크릿 모드 등)에서도 앱은 돌아가야 한다.
    return []
  }
}

function save(): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...memory.values()]))
  } catch {
    // 저장에 실패해도 화면은 그대로 돈다. 새로고침하면 이름이 다시 id로 보일 뿐이다.
  }
}

/**
 * 응답에 들어 있던 장소들을 기억한다.
 *
 * <p>API 함수들이 직접 부른다({@code services/api.ts}). 화면마다 부르게 두면
 * 새 화면을 만들 때 빠뜨리고, 빠뜨린 자리에서만 이름이 숫자로 보이는
 * <b>찾기 어려운 버그</b>가 된다. 장소가 들어오는 길목은 API 하나뿐이다.
 */
export function rememberPlaces(places: readonly Place[]): void {
  if (places.length === 0) {
    return
  }
  for (const place of places) {
    // 지웠다 다시 넣어 순서를 맨 뒤로 올린다. 버릴 때 이 순서를 쓴다.
    memory.delete(place.id)
    memory.set(place.id, place)
  }
  while (memory.size > MAX_ENTRIES) {
    const oldest = memory.keys().next()
    if (oldest.done) {
      break
    }
    memory.delete(oldest.value)
  }
  save()
}

/**
 * 기억해 둔 장소를 id로 찾는다. <b>모르는 id는 조용히 빠진다.</b>
 *
 * <p>없는 자리를 빈 값으로 채워 돌려주지 않는 이유: 지도 마커나 목록은 좌표와 이름이
 * 있어야 그릴 수 있는데, 반쯤 빈 장소를 넘기면 이름 없는 마커가 엉뚱한 좌표(0, 0)에
 * 찍힌다. 모르면 그리지 않는 편이 낫다.
 *
 * <p>같은 id가 여러 번 와도(같은 곳을 두 번 담은 코스) <b>한 번만 돌려준다.</b>
 * 마커를 겹쳐 찍을 이유가 없다.
 */
export function recallPlaces(ids: Iterable<string>): Place[] {
  const found = new Map<string, Place>()
  for (const id of ids) {
    const place = memory.get(id)
    if (place && !found.has(id)) {
      found.set(id, place)
    }
  }
  return [...found.values()]
}
