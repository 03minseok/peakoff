import { useId, useMemo, useState } from 'react'
import { regionOptions, searchRegions } from '../constants/regions'
import { TEXT_INPUT } from './styles'

/**
 * 지역을 <b>검색해서</b> 고르는 칸.
 *
 * <h3>왜 칩 묶음에서 바꿨나</h3>
 * 지역이 셋일 때는 칩 셋을 나란히 놓으면 그만이었다. 일곱이 되니 390px에서 두 줄이 되고,
 * 더 늘면 화면을 덮는다. <b>목록을 훑는 화면은 확장되지 않는다</b> — 장소를 키워드로
 * 찾게 한 것과 같은 이유다.
 *
 * <h3>그래도 목록을 먼저 보여준다</h3>
 * 검색창만 두면 <b>어디를 갈 수 있는지 모르는 사람이 첫 글자를 못 친다.</b> 경주를 모르는
 * 사용자를 위해 대표 관광지 칩을 두는 것과 같은 문제다. 그래서 빈 검색어에는 전부 편다 —
 * 지금은 일곱이라 그대로 보이고, 지역이 늘면 검색이 그 일을 넘겨받는다.
 *
 * <p>⚠️ <b>가로로 미는 상자를 만들지 않는다.</b> 끝까지 민 제스처가 페이지로 이어져
 * 화면 전체가 옆으로 밀린다. 줄바꿈되는 묶음으로 두고 세로로 흐르게 한다.
 *
 * <h3>무엇으로 검색되는지는 서버가 정한다</h3>
 * "강원"이라 치면 속초와 춘천이 나와야 하는데 짧은 이름에는 그 글자가 없다.
 * 서버가 {@code searchText}에 짧은 이름·정식 이름·시도·슬러그를 이어서 준다 —
 * 화면이 조립하면 나중에 별칭을 붙일 때 서버와 화면을 함께 고쳐야 한다.
 */
export function RegionPicker({
  value,
  onChange,
  name = 'region',
}: {
  value: string
  onChange: (slug: string) => void
  /** 라디오 묶음 이름. 한 화면에 둘 이상 두게 되면 갈라야 한다 */
  name?: string
}) {
  const [keyword, setKeyword] = useState('')
  const inputId = useId()

  /*
   * ⚠️ <b>고른 지역은 검색어에 안 맞아도 목록에 남긴다.</b>
   *
   * 안 그러면 "강원"을 친 순간 고른 곳(경주)이 화면에서 사라지는데, 아래 요약 줄은
   * 여전히 "경주 · 2일"이라고 적혀 있다 — 화면이 두 가지 말을 하게 된다.
   * 무엇보다 <b>고른 것을 되돌아볼 방법이 없어진다.</b> 검색어를 지워야만 다시 보인다.
   *
   * 맨 앞에 세운다. 걸러진 결과 사이에 섞어 두면 왜 그것만 남았는지 읽히지 않는다.
   */
  const found = useMemo(() => searchRegions(keyword), [keyword])
  const matched = useMemo(() => {
    if (found.some((option) => option.slug === value)) {
      return found
    }
    const selected = regionOptions().find((option) => option.slug === value)
    return selected ? [selected, ...found] : found
  }, [found, value])

  /*
   * 고른 지역을 남겨 두는 것과 <b>"못 찾았다"고 말하는 것은 별개다.</b>
   * 남긴 칩 하나 때문에 목록이 비지 않으니, 안내가 필요한지는 걸러진 결과로 판단한다 —
   * 안 그러면 사용자가 오타를 쳐도 자기 칩만 덩그러니 남고 아무 설명이 없다.
   */
  const noMatch = keyword.trim().length > 0 && found.length === 0

  return (
    <div className="flex flex-col gap-2.5">
      {/*
        검색창은 지역이 몇이든 <b>늘 세운다.</b> 일곱은 아직 한눈에 들어오지만,
        지역이 늘면서 갑자기 나타나는 칸은 "없던 것이 생겼다"로 읽혀 화면을 다시 익히게 한다.
        지금 두면 아래 목록이 줄어드는 것으로 사용자가 검색을 먼저 배운다.
      */}
      <input
        id={inputId}
        type="search"
        value={keyword}
        onChange={(event) => setKeyword(event.target.value)}
        placeholder="지역 이름으로 찾기 (예: 여수, 강원)"
        className={TEXT_INPUT}
        autoComplete="off"
        aria-label="지역 검색"
      />

      {noMatch && (
        /*
         * 못 찾았을 때 지원 지역을 함께 적는다. "결과 없음"만 두면 사용자가
         * 오타를 냈는지 원래 없는 지역인지 알 수 없다.
         *
         * 조사를 붙여 쓴다 — 앞의 목록과 사이를 띄우면 "춘천 에서"가 된다.
         */
        <p className="text-hint rounded-ui bg-fill px-3.5 py-3 text-[13px] leading-relaxed">
          찾는 지역이 없어요. 지금은{' '}
          <span className="text-fg font-medium">
            {regionOptions()
              .map((option) => option.name)
              .join(' · ')}
          </span>
          에서 여행을 계획할 수 있어요.
        </p>
      )}

      {matched.length > 0 && (
        <div className="flex flex-wrap gap-2.5">
          {matched.map((option) => (
            <label key={option.slug}>
              <input
                type="radio"
                name={name}
                className="peer sr-only"
                value={option.slug}
                checked={value === option.slug}
                onChange={() => onChange(option.slug)}
              />
              {/*
                고른 칸은 brand(틸) 배경에 잉크 글자다. 틸이 밝아서 흰 글자는 2.2:1로 안 보인다 —
                밝게 두고 글자를 어둡게 하는 것이 팔레트 규칙이다.
                초점링은 brand-deep. brand는 흰 카드 위에서 링으로 보이지 않는다.
              */}
              <span className="border-line text-muted peer-checked:border-brand peer-checked:bg-brand peer-checked:text-fg peer-focus-visible:outline-brand-deep flex h-11 cursor-pointer items-center justify-center rounded-ui border bg-surface px-3 text-[15px] font-medium transition-colors peer-checked:font-semibold peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2">
                {option.name}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
