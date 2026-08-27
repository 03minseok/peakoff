import { useEffect } from 'react'
import { LEGAL_DOCUMENTS } from '../content/legal'
import type { LegalDocId } from '../content/legal'

interface Props {
  docId: LegalDocId
  onClose: () => void
}

/**
 * 약관 전문을 펼치는 시트.
 *
 * <p>{@code ConfirmSheet}·{@code FormSheet}과 <b>모양은 같고 성격이 다르다</b> — 저쪽은
 * 답을 받아 가고 이쪽은 읽히기만 한다. 그래서 확인 버튼이 없고 닫기 하나뿐이다.
 * 여기에 "동의합니다" 버튼을 달지 않는 이유는, 동의를 받는 자리가 이미 가입 화면의
 * 확인란이기 때문이다. 같은 동의를 두 곳에서 받으면 <b>어느 쪽이 진짜인지</b> 갈린다.
 *
 * <h3>왜 별도 페이지가 아닌가</h3>
 * 약관을 읽으려고 화면을 떠나면 채워 둔 입력칸이 사라진다. 돌아온 사람은 이메일부터
 * 다시 친다. 시트로 덮으면 뒤에 폼이 그대로 살아 있다.
 *
 * <h3>스크롤을 시트 안에 가둔다</h3>
 * 문서가 길어 반드시 스크롤이 생긴다. {@code max-h}와 {@code overflow-y-auto}를 함께
 * 두지 않으면 시트가 화면 밖으로 자라 마지막 조항을 읽을 수 없다.
 */
export function LegalSheet({ docId, onClose }: Props) {
  const doc = LEGAL_DOCUMENTS[docId]

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey)

    /*
     * 뒤 화면이 함께 스크롤되는 것을 막는다. 이걸 빼면 시트 안에서 끝까지 내린 뒤
     * 계속 밀 때 뒤의 가입 폼이 움직여, 닫았을 때 엉뚱한 위치에 가 있다.
     */
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      window.removeEventListener('keydown', handleKey)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end lg:items-center lg:justify-center lg:p-8">
      <div
        className="sheet-dim absolute inset-0 bg-[rgb(42_62_84/0.42)]"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className="sheet-panel dialog-panel bg-bg relative flex max-h-[88svh] w-full flex-col overflow-hidden rounded-t-[26px] shadow-[0_-10px_40px_rgb(42_62_84/0.24)] lg:max-w-[520px] lg:rounded-[24px] lg:shadow-[0_24px_60px_rgb(42_62_84/0.28)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-sheet-title"
      >
        <div className="flex flex-none justify-center pt-2.5 lg:hidden">
          <span className="bg-line h-1 w-9.5 rounded-[2px]" aria-hidden="true" />
        </div>

        {/*
          제목은 스크롤에서 빼 둔다(flex-none + 아래쪽만 overflow).
          긴 문서를 내리다 보면 지금 읽는 것이 약관인지 처리방침인지 잊는다.
        */}
        <div className="border-line/60 flex flex-none flex-col gap-1 border-b px-5.5 pt-4 pb-3.5">
          <h2
            id="legal-sheet-title"
            className="text-fg m-0 text-[19px] leading-[1.35] font-bold tracking-[-0.02em]"
          >
            {doc.title}
          </h2>
          <p className="text-hint m-0 text-xs">시행일 {doc.effectiveDate}</p>
        </div>

        <div className="flex flex-col gap-5 overflow-y-auto px-5.5 pt-4.5 pb-5">
          {doc.intro && (
            <p className="m-0 text-[13.5px] leading-[1.7] text-pretty">{doc.intro}</p>
          )}

          {doc.sections.map((section) => (
            <section key={section.heading} className="flex flex-col gap-2">
              <h3 className="text-fg m-0 text-[14.5px] leading-[1.4] font-semibold">
                {section.heading}
              </h3>

              {section.body?.map((paragraph) => (
                <p
                  key={paragraph}
                  className="m-0 text-[13.5px] leading-[1.7] whitespace-pre-line text-pretty"
                >
                  {paragraph}
                </p>
              ))}

              {section.items && <ItemList items={section.items} />}

              {section.groups?.map((group) => (
                <div key={group.label} className="flex flex-col gap-1.5">
                  <p className="text-muted m-0 text-[13px] font-medium">{group.label}</p>
                  <ItemList items={group.items} />
                </div>
              ))}

              {section.footnote && (
                <p className="m-0 text-[13.5px] leading-[1.7] text-pretty">{section.footnote}</p>
              )}
            </section>
          ))}
        </div>

        {/*
          닫기는 스크롤 밖에 고정한다. 문서 끝까지 내려야 닫을 수 있으면
          "읽었다는 표시"를 강요하는 셈이 되는데, 동의는 뒤의 확인란이 받는다.
        */}
        <div className="border-line/60 flex-none border-t px-5.5 pt-3.5 pb-5">
          <button
            type="button"
            onClick={onClose}
            className="press border-line bg-surface text-fg hover:bg-bg rounded-ui h-13 w-full cursor-pointer border text-[15.5px] font-semibold"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}

/** 글머리 목록. 조항 안에서도 그룹 안에서도 같은 모양이어야 층위가 흔들리지 않는다. */
function ItemList({ items }: { items: string[] }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
      {items.map((item) => (
        <li key={item} className="flex gap-2 text-[13.5px] leading-[1.7] text-pretty">
          {/* 불릿을 글머리 기호가 아니라 요소로 둔다. 두 줄 이상일 때 글자가 기호 아래로 말려들지 않는다 */}
          <span className="bg-hint/60 mt-2.5 h-1 w-1 flex-none rounded-full" aria-hidden="true" />
          <span className="flex-1">{item}</span>
        </li>
      ))}
    </ul>
  )
}
