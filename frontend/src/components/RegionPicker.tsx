import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { regionNameOf, regionOptions, searchRegions } from '../constants/regions'
import { TEXT_INPUT } from './styles'

/**
 * 지역을 <b>검색해서</b> 고르는 칸.
 *
 * <h3>왜 칩 묶음에서 바꿨나</h3>
 * 지역이 셋일 때는 칩 셋을 나란히 놓으면 그만이었다. 일곱이 되니 390px에서 두 줄이 되고,
 * 더 늘면 화면을 덮는다. <b>목록을 훑는 화면은 확장되지 않는다</b> — 장소를 키워드로
 * 찾게 한 것과 같은 이유다.
 *
 * <h3>왜 목록을 늘 펴 두지 않나</h3>
 * 검색칸 아래에 칩을 늘 세워 두었다가 걷어냈다(2026-09-01). 그 자리는 <b>날짜·기간 칸이
 * 서는 자리</b>라, 지역을 이미 고른 뒤에도 일곱 개가 계속 화면을 차지했다 —
 * 고르고 나면 다시 볼 일이 없는 목록이다.
 *
 * <p>대신 <b>칸을 누르면 목록이 뜬다.</b> 아무것도 안 쳐도 전부 보이므로 "어디를 갈 수
 * 있는지 모르는 사람이 첫 글자를 못 친다"는 문제도 그대로 풀린다 —
 * 검색창만 덩그러니 두는 것과는 다르다.
 *
 * <p>⚠️ <b>가로로 미는 상자를 만들지 않는다.</b> 끝까지 민 제스처가 페이지로 이어져
 * 화면 전체가 옆으로 밀린다. 목록은 세로로 흐르고 넘치면 세로로만 스크롤한다.
 *
 * <h3>무엇으로 검색되는지는 서버가 정한다</h3>
 * "강원"이라 치면 속초와 춘천이 나와야 하는데 짧은 이름에는 그 글자가 없다.
 * 서버가 {@code searchText}에 짧은 이름·정식 이름·시도·슬러그를 이어서 준다 —
 * 화면이 조립하면 나중에 별칭을 붙일 때 서버와 화면을 함께 고쳐야 한다.
 */
export function RegionPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (slug: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [keyword, setKeyword] = useState('')
  /** 키보드로 짚고 있는 줄. 마우스로만 쓰는 사람에게는 늘 -1이다 */
  const [active, setActive] = useState(-1)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const listId = useId()

  const matched = useMemo(() => searchRegions(keyword), [keyword])
  const selectedName = regionNameOf(value)

  /*
   * 바깥을 누르면 닫는다. <b>{@code pointerdown}이다</b> — {@code click}으로 걸면
   * 목록 안의 버튼을 누를 때 그 클릭이 바깥 처리기에 먼저 닿아 목록이 닫히고,
   * 사라진 버튼 위에서 클릭이 끝나 <b>고르기가 아예 안 먹는</b> 브라우저가 있다.
   */
  useEffect(() => {
    if (!open) {
      return
    }
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        close()
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  function close() {
    setOpen(false)
    /*
     * 검색어를 비운다. 남겨두면 다음에 열 때 지난번에 치던 글자가 목록을 이미 걸러 놓아,
     * 고를 수 있는 지역이 줄어 있는 것처럼 보인다.
     */
    setKeyword('')
    setActive(-1)
  }

  function pick(slug: string) {
    onChange(slug)
    close()
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      close()
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()   // 칸 안에서 커서가 튀지 않게
      if (!open) {
        setOpen(true)
        return
      }
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive((current) => {
        const next = current + step
        // 끝에서 반대편으로 돈다. 일곱 줄이라 끝까지 갔다가 되짚어 오는 편이 길다.
        return next < 0 ? matched.length - 1 : next >= matched.length ? 0 : next
      })
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()   // 폼이 통째로 제출되지 않게
      /*
       * 짚어 둔 줄이 없으면 첫 줄을 고른다. "여수"까지 치고 Enter를 누르는 사람에게
       * 화살표를 한 번 더 누르게 할 이유가 없다.
       */
      const target = matched[active >= 0 ? active : 0]
      if (target) {
        pick(target.slug)
      }
    }
  }

  return (
    <div ref={rootRef} className="relative flex flex-col gap-2">
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        aria-label="지역 선택"
        /*
         * 닫혀 있을 때는 <b>고른 지역 이름</b>이 값이다. 검색어를 남겨 두면 고르고 난 뒤에도
         * 칸에 "강원"이 남아, 무엇을 골랐는지가 칸이 아니라 다른 데서 확인된다.
         */
        value={open ? keyword : selectedName}
        onChange={(event) => {
          setKeyword(event.target.value)
          setActive(-1)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        /* 눌러서도 열린다. 이미 초점이 있는 칸을 다시 누르면 onFocus가 오지 않는다 */
        onClick={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="지역 검색 (예: 여수, 강원)"
        autoComplete="off"
        className={TEXT_INPUT}
      />

      {open && (
        /*
         * 목록. <b>절대 위치로 띄운다</b> — 흐름에 넣으면 열 때마다 아래 날짜·기간 칸이
         * 통째로 밀려 내려간다. 무엇을 고를지 보려고 열었는데 보고 있던 것이 움직인다.
         *
         * <p><b>넉 줄쯤에서 자르고</b> 나머지는 굴려서 본다({@code max-h-[11.5rem]}).
         * 일곱을 다 펴면 목록이 날짜 칸을 지나 기간 칸까지 덮어, 지역을 고르는 동안
         * 나머지 폼이 통째로 가려진다. 잘린 줄이 반쯤 보여야 "아래에 더 있다"도 함께 말한다.
         */
        <ul
          id={listId}
          role="listbox"
          aria-label="지역 목록"
          className="border-line bg-surface shadow-raised rounded-ui absolute top-full right-0 left-0 z-20 m-0 mt-1.5 max-h-[11.5rem] list-none overflow-y-auto p-1"
        >
          {matched.length === 0 ? (
            /*
             * 못 찾았을 때 지원 지역을 함께 적는다. "결과 없음"만 두면 사용자가
             * 오타를 냈는지 원래 없는 지역인지 알 수 없다.
             */
            <li className="text-hint px-3 py-3 text-[13px] leading-relaxed">
              찾는 지역이 없어요. 지금은{' '}
              <span className="text-fg font-medium">
                {regionOptions()
                  .map((option) => option.name)
                  .join(' · ')}
              </span>
              에서 여행을 계획할 수 있어요.
            </li>
          ) : (
            matched.map((option, index) => {
              const selected = option.slug === value
              return (
                <li key={option.slug}>
                  <button
                    id={`${listId}-${index}`}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    /* 마우스로 짚은 줄과 키보드로 짚은 줄을 하나로 둔다 — 둘이 동시에 켜지면 어느 것이 골라질지 흐려진다 */
                    onPointerEnter={() => setActive(index)}
                    onClick={() => pick(option.slug)}
                    className={`flex w-full cursor-pointer items-baseline justify-between gap-3 rounded-[10px] border-0 px-3 py-2.5 text-left transition-colors ${
                      index === active ? 'bg-brand-tint' : 'bg-transparent'
                    }`}
                  >
                    <span
                      className={`text-[15px] ${selected ? 'text-brand-deep font-semibold' : 'text-fg font-medium'}`}
                    >
                      {option.name}
                    </span>
                    {/* 시도명을 함께 적는다. "강원"으로 찾은 사람에게 왜 이 줄이 나왔는지를 보여준다 */}
                    <span className="text-hint flex-none text-[12px]">{option.province}</span>
                  </button>
                </li>
              )
            })
          )}
        </ul>
      )}
    </div>
  )
}
