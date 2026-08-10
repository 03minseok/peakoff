interface Props {
  /** 서비스 흐름 몇 번째 단계인지 */
  step?: string
  title: string
  description: string
}

/**
 * 아직 만들지 않은 화면 자리.
 *
 * 라우팅이 실제로 도는지 확인하려면 각 경로에 무언가 렌더링돼야 한다.
 * 내용이 채워지면 이 컴포넌트를 쓰는 페이지부터 하나씩 걷어낸다.
 */
export function PageStub({ step, title, description }: Props) {
  return (
    <section className="flex flex-col gap-2.5 py-7">
      {step && (
        <p className="text-brand-deep m-0 text-xs font-semibold tracking-[0.12em]">{step}</p>
      )}
      <h1 className="text-fg m-0 text-[26px] font-bold tracking-[-0.02em]">{title}</h1>
      <p className="m-0 text-sm leading-[1.65] text-pretty">{description}</p>
    </section>
  )
}
