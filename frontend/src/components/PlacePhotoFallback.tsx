import { BrandMark } from './BrandMark'

/**
 * 사진이 없는 장소의 자리를 지키는 브랜드 면.
 *
 * <h3>왜 글자 하나에서 이걸로 바꿨나</h3>
 * 예전에는 회색 면에 <b>이름 첫 글자</b>를 얹었다. 자리와 크기는 지켰지만 화면에는
 * "여기 뭔가 빠졌다"만 남았다. 목록에 사진 있는 카드와 없는 카드가 섞여 서면
 * 없는 쪽이 <b>덜 만들어진 것</b>처럼 보인다 — 공사가 사진을 안 준 것이지
 * 우리가 못 채운 것이 아닌데도 그렇다.
 *
 * <p>⚠️ <b>대신 잃은 것이 있다.</b> 첫 글자는 장소마다 달라서 사진 없는 카드끼리도
 * 서로 구분됐다. 이 면은 어느 장소에서나 같다. 그래도 이쪽을 고른 이유는,
 * 글자 하나로 장소를 알아보는 사람은 없고 바로 옆에 이름이 글자로 있기 때문이다.
 * <b>일부러 같게 둔다</b> — 장소마다 다르게 흔들면 없는 정보를 있는 척하게 된다.
 *
 * <h3>구성</h3>
 * 옅은 사선 바탕 위에 원들이 겹친다. 왼쪽 아래에서 올라오는 틸 세 겹이 가장 크고,
 * 오른쪽 위·아래를 서늘한 파랑이 물들이며, 가운데 오른쪽에 작은 점 하나가 선다.
 * 가운데에는 로고 마크가 온다.
 *
 * <p><b>원은 상자 밖에서 시작한다.</b> 안쪽에 온전한 동그라미를 그리면 도형이 되지만,
 * 모서리에서 물려 들어오면 <b>면이 된다</b> — 사진이 앉을 자리라 도형이 아니라 면이어야 한다.
 *
 * <h3>{@code slice}로 채운다</h3>
 * 이 면이 서는 자리는 정사각(썸네일)이기도 하고 가로로 긴 배너이기도 하다.
 * viewBox는 1:1 하나만 두고 {@code preserveAspectRatio="xMidYMid slice"}로 <b>채워서
 * 잘라낸다</b> — 사진이 {@code object-cover}로 앉는 것과 같은 방식이라, 옆자리에
 * 사진 있는 카드가 서도 같은 리듬으로 늘어선다.
 *
 * <p>비율마다 구성을 따로 두지 않는 이유도 그것이다. 두 벌을 두면 하나는 늘 안 보이는데
 * 언젠가 한쪽만 고쳐진다.
 *
 * <h3>마크는 {@link BrandMark}에서 온다</h3>
 * 여기서 다시 그리지 않는다. 도형이 바뀔 때 이 파일만 옛 모양으로 남지 않게 하려는 것이다.
 *
 * <p>다만 색은 <b>시안대로 두 조각 모두 잉크</b>다({@code tone="mono"}).
 * 흰 면 위의 로고에서 비껴간 조각이 틸인 것은 <b>끊김을 거들기 위해서</b>인데,
 * 이 면은 이미 틸 원들이 깔린 바탕이라 조각까지 틸이면 거들기는커녕
 * <b>바탕에 녹아 끊김이 안 보인다.</b> 갈라 두려고 준 색이 도리어 뭉개는 자리다.
 *
 * <p>색이 빠져도 마크는 성립한다 — 비껴감을 나르는 것은 색이 아니라 <b>끊김</b>이다.
 * 헤더·로그인·가입의 로고는 그대로 틸이다.
 *
 * <p>글자도 <b>PEAKOFF</b>로 붙여 쓴다. 시안에는 {@code PEAK OFF}로 띄어져 있었는데,
 * 헤더·로그인·가입이 전부 붙여 쓰고 있어 여기만 띄우면 같은 화면에 두 표기가 선다.
 */

/** 상자 밖에서 물려 들어오는 원 하나. 좌표는 아래 표에 적어 둔 값 그대로다. */
interface Blob {
  cx: number
  cy: number
  r: number
  fill: string
  opacity: number
}

/*
 * ■ 좌표계
 * viewBox 0 0 300 300. 시안이 (24, 60)에 놓인 300×300 상자에 그려져 있어,
 * 거기서 x는 24를, y는 60을 빼서 옮겼다.
 *
 * ■ 순서가 곧 겹침이다
 * 큰 것부터 그려 작은 것이 위에 온다. 틸 셋은 같은 중심(-4, 370)을 나눠 쓰므로
 * 반지름만 줄어드는 동심원이고, 겹칠수록 짙어지는 층이 왼쪽 아래 모서리를 만든다.
 */
const BLOBS: Blob[] = [
  { cx: -4, cy: 370, r: 290, fill: 'var(--c-fallback-teal-1)', opacity: 0.55 },
  { cx: -4, cy: 370, r: 235, fill: 'var(--c-fallback-teal-2)', opacity: 0.5 },
  { cx: -4, cy: 370, r: 180, fill: 'var(--c-fallback-teal-3)', opacity: 0.45 },
  { cx: 326, cy: -20, r: 130, fill: 'var(--c-fallback-cool-1)', opacity: 0.55 },
  { cx: 326, cy: -20, r: 88, fill: 'var(--c-fallback-cool-2)', opacity: 0.5 },
  { cx: 312, cy: 270, r: 72, fill: 'var(--c-fallback-cool-1)', opacity: 0.5 },
  { cx: 268, cy: 152, r: 20, fill: 'var(--c-fallback-teal-dot)', opacity: 0.75 },
]

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
   * <p>시안이 정한 경계가 <b>80px</b>이다 — 그 아래로 내려가면 마크에 맞춰 줄인 글자가
   * 뭉개져 읽히지 않는 획 덩어리가 된다. 우리 자리 대부분(40~84px)이 그 아래라,
   * 글자가 서는 곳은 좁은 화면의 배너 하나뿐이다.
   */
  wordmarkClass?: string
  className?: string
}

export function PlacePhotoFallback({ markClass, wordmarkClass, className = '' }: Props) {
  return (
    <span
      className={`relative grid place-items-center overflow-hidden ${className}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 300 300"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
      >
        {/*
          사선 그라디언트. 왼쪽 위가 가장 푸르고 오른쪽 아래로 가며 서늘해진다 —
          아래 원들이 놓인 방향과 같아서, 원이 잘려 나간 비율에서도 바탕이 따로 놀지 않는다.
        */}
        <defs>
          <linearGradient id="place-fallback-ground" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--c-fallback-bg-1)" />
            <stop offset="60%" stopColor="var(--c-fallback-bg-2)" />
            <stop offset="100%" stopColor="var(--c-fallback-bg-3)" />
          </linearGradient>
        </defs>
        <rect width="300" height="300" fill="url(#place-fallback-ground)" />
        {BLOBS.map((blob, index) => (
          <circle
            /* 좌표가 겹치는 원이 있어(틸 동심원) 값으로는 열쇠를 못 만든다 */
            key={index}
            cx={blob.cx}
            cy={blob.cy}
            r={blob.r}
            fill={blob.fill}
            opacity={blob.opacity}
          />
        ))}
      </svg>

      {/*
        마크는 SVG 안이 아니라 위에 얹는다. 안에 넣으면 slice가 잘라내는 만큼 함께
        커지고 잘려서, 같은 목록에서 카드마다 마크 크기가 달라진다.
      */}
      <span className="relative flex flex-col items-center gap-1.5">
        <BrandMark tone="mono" className={markClass} />
        {wordmarkClass && (
          <span className={`text-fg font-bold tracking-[0.28em] ${wordmarkClass}`}>PEAKOFF</span>
        )}
      </span>
    </span>
  )
}
