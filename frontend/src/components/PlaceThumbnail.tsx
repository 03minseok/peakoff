/**
 * 사진 자리. 이미지가 있으면 그것을, 없으면 회색 대체면을 그린다.
 *
 * <p>imageUrl은 공사 국문 관광정보의 대표 이미지({@code firstimage})에서 온다.
 * 경주 621곳 중 484곳(77%)에 있고, <b>진단 대상 65곳으로 좁히면 62곳(95%)</b>이라
 * 진단 화면에서는 빈 자리가 거의 없다.
 *
 * <p>사진이 없으면 {@link PlacePhotoFallback}이 그 자리를 지킨다.
 *
 * <p>⚠️ <b>예전에는 중립 회색 면에 이름 첫 글자였다.</b> 브랜드 틸을 깔면 "이미지 없는
 * 장소마다 청록 사각형이 서서, 로고·주요 버튼에만 남겨야 할 강조색이 목록 전체에 번진다"는
 * 것이 그때의 이유였다. 지금 면이 그 걱정을 피하는 방식은 <b>연하게 까는 것</b>이다 —
 * 채운 틸이 아니라 흰 바탕에 반투명 원이 물려 들어오는 구성이라, 강조색이 아니라 배경으로
 * 읽힌다. 그리고 <b>80px 아래로는 글자를 빼고 마크만</b> 남겨 작은 자리에서 더 조용해진다.
 *
 * <p><b>화면 두 곳에서 쓴다.</b> 홈의 "지금 한적한 곳" 카드와 진단 화면의 코스 목록이다.
 * 복사해 두면 대체면 색이나 로딩 방식을 고칠 때 한쪽만 바뀐다.
 */

/**
 * 크기.
 *
 * <p>{@code lg}는 홈의 카드 — 사진이 볼거리를 소개하는 자리라 크다.
 * {@code md}는 진단 화면의 코스 목록 — 담은 곳을 알아볼 만큼은 되어야 한다.
 * {@code sm}은 좁은 자리용으로 남겨 둔다.
 */
type ThumbnailSize = 'sm' | 'md' | 'lg' | 'card' | 'banner'

const SIZE_CLASS: Record<ThumbnailSize, string> = {
  sm: 'h-10 w-10 rounded-chip',
  md: 'h-16 w-16 rounded-ui',
  lg: 'h-21 w-21 rounded-ui',
  /*
   * 홈의 "이번 주 한적한 곳". <b>좁은 화면에서는 카드 맨 위를 가로지르는 사진,
   * lg부터는 왼쪽 썸네일</b>이다 — banner와 같은 수법이고 갈리는 지점만 다르다
   * (그쪽은 sm, 이쪽은 lg. 홈의 이 박스가 lg에서 세로 목록이 되기 때문이다).
   *
   * 모서리를 죽이는 이유도 banner와 같다 — 카드가 overflow-hidden으로 위 모서리를
   * 대신 잘라 준다. 여기서도 둥글리면 두 겹이 되어 경계가 지저분해진다.
   *
   * 높이 76px은 카드 폭(120px)에 3:2로 붙는 값이다. 위의 진입 카드 둘이 납작해지면서
   * 이 카드만 크면 <b>같은 화면에서 급이 다른 것</b>처럼 보여 함께 내렸다.
   * lg 값은 md와 같다 — 예전 목록이 쓰던 크기라 <b>넓은 화면은 픽셀이 안 움직인다.</b>
   */
  card: 'h-19 w-full rounded-none lg:h-16 lg:w-16 lg:rounded-ui',
  /*
   * 좁은 화면에서는 카드 맨 위를 가로지르는 배너, 넓은 화면에서는 왼쪽 썸네일.
   *
   * 한 요소가 두 모양을 겸한다. 화면별로 두 개를 두면 하나는 늘 숨어 있는데도
   * 브라우저가 받아오고, 나중에 한쪽만 고쳐진다.
   *
   * 모서리를 죽이는(rounded-none) 이유: 배너일 때는 카드가 overflow-hidden으로
   * 위 모서리를 대신 잘라 준다. 여기서도 둥글리면 두 겹이 되어 테두리가 지저분해진다.
   */
  /*
   * ⚠️ 한때 h-52 / 96px로 키웠다가 되돌렸다. 사진을 크게 볼 자리는 <b>상세 창</b>이 맡는다 —
   * 카드에서 키우면 목록 한 장이 그만큼 길어지고, 담긴 곳이 5~8곳이면 그것만으로
   * 스크롤이 배가 된다. 목록에서 사진이 하는 일은 "어디였더라"를 짚어주는 것까지다.
   */
  banner: 'h-40 w-full rounded-none sm:h-16 sm:w-16 sm:rounded-ui',
}

import { PlacePhotoFallback } from './PlacePhotoFallback'

/**
 * 자리마다 마크를 얼마나 크게 세울지. <b>시안이 정한 경계는 80px</b>이고,
 * 그 아래는 글자를 빼고 마크만 남긴다.
 *
 * <p>우리 자리는 대부분 40~84px이라 <b>글자가 서는 곳은 좁은 화면의 배너 하나뿐</b>이다.
 * 넓은 화면에서 배너가 64px 썸네일로 접히면 그때 글자도 함께 빠진다.
 *
 * <p>마크 크기는 상자의 45% 안팎이다. 꽉 채우면 로고가 <b>사진 자리를 대신하는 면</b>이
 * 아니라 버튼처럼 보이고, 더 줄이면 무엇이 그려졌는지 안 보인다.
 */
const FALLBACK_MARK: Record<ThumbnailSize, string> = {
  sm: 'h-4.5 w-4.5',
  md: 'h-7.5 w-7.5',
  lg: 'h-9.5 w-9.5',
  card: 'h-8 w-8 lg:h-7.5 lg:w-7.5',
  banner: 'h-14 w-14 sm:h-7.5 sm:w-7.5',
}

/** 글자가 서는 자리. 없으면 마크만 선다 — {@link FALLBACK_MARK} 참고 */
const FALLBACK_WORDMARK: Partial<Record<ThumbnailSize, string>> = {
  banner: 'text-[11px] sm:hidden',
}

interface Props {
  /*
   * ⚠️ 이름은 받지 않는다. 대체면이 이름 첫 글자를 얹던 시절의 흔적이라 함께 걷었다 —
   * 사진의 alt는 늘 빈 문자열이고(바로 옆에 이름이 글자로 있다) 대체면은 어느 장소에서나
   * 같은 그림이므로, 남겨 두면 <b>쓰지 않는데 부르는 쪽마다 넘겨야 하는 값</b>이 된다.
   */
  imageUrl: string | null
  size?: ThumbnailSize
  /** 자리 잡기용. 화면 폭에 따라 순서가 달라지는 곳에서 order 클래스를 넘긴다 */
  className?: string
}

export function PlaceThumbnail({ imageUrl, size = 'lg', className = '' }: Props) {
  const sizeClass = `${SIZE_CLASS[size]} ${className}`

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        /*
          alt이 빈 문자열인 것은 의도다. 바로 옆에 장소 이름이 글자로 있어서,
          여기에 이름을 또 넣으면 스크린리더가 같은 말을 두 번 읽는다.
        */
        alt=""
        className={`${sizeClass} flex-none object-cover`}
        loading="lazy"
      />
    )
  }

  return (
    <PlacePhotoFallback
      markClass={FALLBACK_MARK[size]}
      wordmarkClass={FALLBACK_WORDMARK[size]}
      className={`${sizeClass} flex-none`}
    />
  )
}
