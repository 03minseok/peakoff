import { BrandMark } from './BrandMark'

/**
 * 사진이 없는 장소의 자리를 지키는 면 — 평평한 옅은 바탕 위에 로고 마크.
 *
 * <h3>왜 글자 하나에서 이걸로 바꿨나</h3>
 * 예전에는 회색 면에 <b>이름 첫 글자</b>를 얹었다. 자리와 크기는 지켰지만 화면에는
 * "여기 뭔가 빠졌다"만 남았다. 사진 있는 카드와 없는 카드가 섞여 서면 없는 쪽이
 * <b>덜 만들어진 것</b>처럼 보인다 — 공사가 사진을 안 준 것이지 우리가 못 채운 것이 아닌데도.
 *
 * <h3>왜 다시 단순해졌나</h3>
 * 한때 원 일곱 개가 겹치는 그림이었다. 혼자 있을 때는 예뻤는데 <b>사진 옆에 서면 그림이
 * 사진과 다퉜다</b> — 목록에서 눈이 진짜 사진이 아니라 대체면으로 먼저 갔다. 대체면은
 * 자리를 지키는 것이지 볼거리가 아니다. 바탕 한 색과 마크만 남긴다.
 *
 * <p>⚠️ <b>일부러 어느 장소에서나 같다.</b> 첫 글자는 장소마다 달라 사진 없는 카드끼리
 * 구분됐지만, 장소마다 흔들면 없는 정보를 있는 척하게 된다. 바로 옆에 이름이 글자로 있다.
 *
 * <h3>마크는 {@link BrandMark}에서 온다</h3>
 * 여기서 다시 그리지 않는다. 색도 흰 면 위의 로고와 같다 — 봉우리는 잉크, 비껴간 조각은
 * 틸. 옅은 바탕에는 틸 조각이 묻히지 않으니 한 색으로 세울 이유가 없다.
 *
 * <p>글자는 <b>PEAKOFF</b>로 붙여 쓴다. 헤더·로그인·가입이 전부 붙여 쓰고 있어
 * 여기만 띄우면 같은 화면에 두 표기가 선다.
 */

interface Props {
  /**
   * 마크 크기. <b>px이 아니라 Tailwind 높이·너비 클래스</b>다 — 반응형으로 갈리는
   * 자리가 있어서(배너는 좁은 화면에서 크고 넓은 화면에서 작다) 숫자로는 못 준다.
   *
   * <p>클래스가 {@code BrandMark}의 width·height 속성을 덮는다. CSS가 표현 속성보다
   * 세다는 것에 기대는 것이라, 여기 말고 다른 데서 흉내 내지 말 것.
   */
  markClass: string
  /**
   * 글자를 함께 세울지. <b>기본은 안 세운다.</b>
   *
   * <p>경계는 <b>80px</b>이다 — 그 아래로 내려가면 마크에 맞춰 줄인 글자가 뭉개져
   * 읽히지 않는 획 덩어리가 된다. 우리 자리 대부분(40~84px)이 그 아래라,
   * 글자가 서는 곳은 좁은 화면의 배너와 상세 시트뿐이다.
   */
  wordmarkClass?: string
  className?: string
}

export function PlacePhotoFallback({ markClass, wordmarkClass, className = '' }: Props) {
  return (
    <span
      className={`bg-fallback grid place-items-center overflow-hidden ${className}`}
      aria-hidden="true"
    >
      <span className="flex flex-col items-center gap-2">
        <BrandMark className={markClass} />
        {wordmarkClass && (
          <span className={`text-fg font-bold tracking-[0.28em] ${wordmarkClass}`}>PEAKOFF</span>
        )}
      </span>
    </span>
  )
}
