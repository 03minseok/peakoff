import type { ScoreFactor } from '../types/api'

/**
 * 장소를 교체할 때 <b>왜 그곳을 추천했는지</b>를 그 자리에 남긴다.
 *
 * <h3>왜 필요한가</h3>
 * 추천도 구성 내역(항목·점수·반영 비율)은 대안 시트가 이미 그린다. 그런데 사용자가
 * 후보를 고르는 순간 그 시트가 닫히고, <b>근거도 함께 사라진다.</b> 그 뒤 최종 비교
 * 화면에는 "첨성대 31 → 양동마을 78"만 남는다 — 무엇을 근거로 그곳을 골랐는지는
 * 화면 어디에도 없다.
 *
 * <p>CLAUDE.md는 구성 내역을 <b>"데이터 활용 20점을 화면에서 증명하는 장치"</b>로
 * 못 박았고, 최종 비교는 발표에서 가리킬 자리다. 증명해야 할 화면에 증거가 없었다.
 *
 * <h3>왜 다시 불러오지 않고 저장하는가</h3>
 * 대안을 다시 요청하면 <b>가중 무작위 뽑기가 다시 돈다.</b> 그러면 사용자가 실제로
 * 고른 그 후보가 목록에 없을 수도 있고, 있더라도 그때 본 것과 다른 근거가 나온다.
 * 고른 순간의 판단은 그 순간에만 존재하므로 그때 붙잡아 둔다.
 *
 * <h3>⚠️ 이것은 대안 목록 캐시가 아니다</h3>
 * 여기 담기는 것은 <b>사용자가 이미 고른 한 곳</b>의 근거뿐이다. 목록을 통째로
 * 기억하면 추천 분산이 죽는다(alternativeCache의 주석 참고) — 그 위험이 여기에는 없다.
 * 뽑기는 이미 끝났고, 남기는 것은 결과가 아니라 <b>영수증</b>이다.
 *
 * <h3>⚠️ 화면에서 "그때의 근거"라고 말해야 한다</h3>
 * 공사 예측은 하루 한 번 갱신되므로, 시간이 지나면 여기 적힌 한적도 점수와 지금 다시
 * 진단한 한적도가 갈릴 수 있다. 그래서 이 값을 <b>지금의 점수인 척 쓰면 안 된다.</b>
 * 최종 비교 화면은 살아 있는 한적도를 진단 응답에서 따로 가져오고, 이 저장소의 값은
 * "교체할 때 이런 근거로 골랐다"로만 쓴다.
 */
const STORAGE_KEY = 'peakoff.swapEvidence'

/**
 * 기억할 수 있는 최대 교체 수.
 *
 * 코스 하나의 칸 수(많아야 수십)를 훨씬 넘는 값이다. 같은 자리를 여러 번 갈아치우면
 * 쌓이므로 상한을 둔다 — 넘치면 <b>오래된 것부터 버린다.</b>
 */
const MAX_ENTRIES = 60

/** 교체 한 건의 근거. 대안 시트가 화면에 그린 것과 같은 재료다 */
export interface SwapEvidence {
  /** 종합 판단. factors를 반영 비율대로 합친 값 */
  recommendation: number
  /** 항목별 점수와 반영 비율. 서버가 준 것을 그대로 둔다 */
  factors: ScoreFactor[]
  /** "OO 방문객이 함께 많이 찾는 곳"처럼 그곳이 어떤 곳인지 말하는 문장 */
  reason: string
}

/** 넣은 순서를 지키므로 <b>맨 앞이 가장 오래된 것</b>이다 */
const memory = new Map<string, SwapEvidence>(load())

/** 저장된 값이 지금 코드가 기대하는 모양인지 본다. 아니면 없는 것으로 친다. */
function isEntry(value: unknown): value is [string, SwapEvidence] {
  if (!Array.isArray(value) || value.length !== 2 || typeof value[0] !== 'string') {
    return false
  }
  const evidence = value[1] as Record<string, unknown>
  return (
    typeof evidence === 'object' &&
    evidence !== null &&
    typeof evidence.recommendation === 'number' &&
    typeof evidence.reason === 'string' &&
    Array.isArray(evidence.factors)
  )
}

function load(): [string, SwapEvidence][] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return []
    }
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isEntry) : []
  } catch {
    // 저장소를 못 쓰는 환경에서도 앱은 돌아가야 한다. 근거 줄만 안 보일 뿐이다.
    return []
  }
}

function save(): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...memory.entries()]))
  } catch {
    // 저장에 실패해도 교체 자체는 이루어진다.
  }
}

/**
 * 이 장소를 <b>고른 순간의 근거</b>를 남긴다.
 *
 * <p>대안 시트가 직접 부른다. 화면마다 부르게 두면 새 경로를 만들 때 빠뜨리고,
 * 빠뜨린 자리에서만 근거가 사라지는 <b>찾기 어려운 구멍</b>이 된다.
 *
 * <p>근처 모드(예상 혼잡을 모르는 자리)에서는 부르지 않는다. 그쪽은 추천도를 매기지
 * 않으므로 남길 근거가 없다 — 없는 것을 빈 값으로 남기면 화면이 "아직 안 온 값"으로 읽는다.
 */
export function rememberSwapEvidence(placeId: string, evidence: SwapEvidence): void {
  // 지웠다 다시 넣어 순서를 맨 뒤로 올린다. 버릴 때 이 순서를 쓴다.
  memory.delete(placeId)
  memory.set(placeId, evidence)
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
 * 그 장소를 고를 때의 근거를 찾는다. <b>모르면 null이다.</b>
 *
 * <p>없는 경우가 정상적으로 존재한다 — 설문으로 받은 초안, 저장해둔 코스를 불러온 뒤,
 * 새로고침으로 세션이 갈린 뒤. 그때 화면은 근거 줄을 <b>그리지 않는다.</b>
 * 빈 자리를 남기면 계산하지 못한 것이 아니라 <b>아직 오지 않은 것</b>으로 읽힌다.
 */
export function recallSwapEvidence(placeId: string): SwapEvidence | null {
  return memory.get(placeId) ?? null
}
