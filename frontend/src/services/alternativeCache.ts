import type { Alternative } from '../types/api'

/**
 * 한 번 받은 대안 목록을 코스 편집 세션 동안 들고 있는다.
 *
 * <h3>왜 필요한가</h3>
 * 서버는 상위 후보군에서 <b>가중 무작위</b>로 대안을 뽑는다. 같은 대안이 모든 사용자에게
 * 반복 추천되면 그곳이 새로운 혼잡지가 되기 때문이다(2차 오버투어리즘).
 *
 * 그런데 그 말은 <b>같은 자리를 다시 물으면 다른 답이 온다</b>는 뜻이기도 하다.
 * 시트를 닫았다 열었을 뿐인데 목록이 바뀌면 사용자는 방금 봤던 후보를 찾지 못한다.
 * 되돌리려던 사람에게는 특히 그렇다 — 돌아갈 자리가 사라진다.
 *
 * 그래서 <b>뽑기는 서버가 하고, 그 결과를 화면이 들고 있는다.</b>
 *
 * <h3>왜 서버가 캐시하지 않는가</h3>
 * 서버가 완성된 대안 목록을 캐시해 모두에게 돌려주면 분산이 통째로 죽는다.
 * 모든 사용자가 같은 1등을 받게 되어, 애초에 무작위를 넣은 이유가 사라진다.
 * 서버 캐시는 공사 원자료(집중률·연관 관광지) 층에만 둔다.
 *
 * <h3>언제 버리는가</h3>
 * 여행 조건(지역·시작일·기간)이 바뀌면 전부 버린다. 날짜가 달라지면 한적도가 달라져
 * 예전 목록은 더 이상 맞는 답이 아니다.
 *
 * <b>장소를 교체하는 것은 여기에 포함되지 않는다.</b> 교체 후에도 다른 자리의 목록은
 * 그대로여야 하고, 되돌린 뒤 다시 열었을 때도 같은 후보가 보여야 한다.
 */

/** 여행 조건이 같은지 가리는 열쇠. 이 값이 바뀌면 모아둔 것을 전부 버린다. */
let currentPlanKey: string | null = null

const entries = new Map<string, Alternative[]>()

/** 지역·시작일·기간을 한 문자열로 묶는다. 셋 중 하나만 바뀌어도 다른 값이 된다. */
export function planKeyOf(region: string, startDate: string, nights: number): string {
  return `${region}|${startDate}|${nights}`
}

function entryKeyOf(placeId: string, visitDate: string): string {
  return `${placeId}|${visitDate}`
}

/**
 * 모아둔 목록이 있으면 그것을, 없으면 `fetcher`로 받아 담고 돌려준다.
 *
 * @param planKey 여행 조건 열쇠. 직전과 다르면 모아둔 것을 먼저 버린다
 */
export async function alternativesFor(
  planKey: string,
  placeId: string,
  visitDate: string,
  fetcher: () => Promise<Alternative[]>,
): Promise<Alternative[]> {
  if (planKey !== currentPlanKey) {
    entries.clear()
    currentPlanKey = planKey
  }

  const key = entryKeyOf(placeId, visitDate)
  const cached = entries.get(key)
  if (cached) {
    return cached
  }

  const fresh = await fetcher()
  entries.set(key, fresh)
  return fresh
}

/**
 * 그 자리의 목록만 버린다. <b>사용자가 "다시 추천받기"를 눌렀을 때</b> 쓴다.
 *
 * 새로 뽑아 달라는 요청은 명시적일 때만 받는다 — 화면이 다시 그려질 때마다 뽑으면
 * 위에 적은 문제가 그대로 돌아온다.
 */
export function forgetAlternatives(placeId: string, visitDate: string): void {
  entries.delete(entryKeyOf(placeId, visitDate))
}
