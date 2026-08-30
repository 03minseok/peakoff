/**
 * 앞말의 <b>받침</b>에 따라 갈리는 조사를 붙인다.
 *
 * 문장을 조각으로 이어 만드는 자리에서는 조사를 글자로 박아둘 수 없다.
 * 최종 비교 화면의 <b>"다른 곳 2곳 발견로 한적 지수가 9 올랐어요"</b>가 그렇게 나왔다 —
 * 앞말이 무엇이든 "로"가 따라붙게 짜여 있었고, 들어갈 수 있는 말이 전부 받침으로 끝나
 * <b>점수가 오른 모든 화면이 비문</b>이었다. 발표에서 확대해 가리킬 그 문장이다.
 */

/**
 * 받침이 <b>있을 때</b> 쓸 것과 <b>없을 때</b> 쓸 것.
 *
 * 목록에 없는 조사가 필요하면 여기에 한 줄 더하는 편이, 부르는 쪽에서 조사를
 * 직접 고르는 것보다 낫다 — 같은 판별을 두 곳에서 하게 되면 한쪽만 틀린다.
 */
const JOSA_PAIRS = {
  '으로/로': ['으로', '로'],
  '은/는': ['은', '는'],
  '이/가': ['이', '가'],
  '을/를': ['을', '를'],
  '과/와': ['과', '와'],
} as const

/** 한글 음절 영역의 첫 글자(가). 받침은 이 값을 뺀 나머지에서 나온다 */
const HANGUL_BASE = 0xac00
/** 한글 음절 수. 초성 19 × 중성 21 × 종성 28 = 11172 */
const HANGUL_COUNT = 11172
/** 종성 표에서 ㄹ의 자리 */
const JONGSEONG_RIEUL = 8

/**
 * `word` 뒤에 `pair`의 조사를 받침에 맞게 붙여 돌려준다.
 *
 * <p>⚠️ <b>"으로/로"에만 예외가 하나 더 있다.</b> ㄹ 받침은 받침이 없는 것처럼
 * 다룬다 — 서울<b>로</b>, 하늘<b>로</b>. 다른 조사에는 이 예외가 없어서
 * (서울<b>은</b>, 하늘<b>이</b>) 규칙을 조사와 함께 봐야 한다.
 *
 * <p>한글이 아닌 글자(숫자·영문·기호)로 끝나면 받침을 판별할 방법이 없다.
 * 그때는 받침 없는 쪽으로 둔다 — 우리 문구는 늘 한글로 끝나고, 어차피 틀릴 거라면
 * 덜 어색한 쪽이다.
 */
export function withJosa(word: string, pair: keyof typeof JOSA_PAIRS): string {
  const [closed, open] = JOSA_PAIRS[pair]
  const last = word.trimEnd().at(-1) ?? ''
  const index = last.charCodeAt(0) - HANGUL_BASE

  if (Number.isNaN(index) || index < 0 || index >= HANGUL_COUNT) {
    return `${word}${open}`
  }

  const jongseong = index % 28
  const readsAsOpen =
    jongseong === 0 || (pair === '으로/로' && jongseong === JONGSEONG_RIEUL)
  return `${word}${readsAsOpen ? open : closed}`
}
