import { useEffect, useState } from 'react'
import type { SharedCourse } from '../types/api'
import type { KakaoFeedTemplate, KakaoShareLink, KakaoTextTemplate } from '../types/kakao'
import '../types/kakao'
import { formatNights } from '../utils/date'

/**
 * 카카오톡 공유 SDK 로딩 상태. {@code useKakaoSdk}(지도)와 같은 네 가지다 —
 * `no-key`를 따로 두는 이유도 같다. 키가 없는 것은 오류가 아니라 아직 설정하지 않은 상태다.
 */
export type KakaoShareStatus = 'no-key' | 'loading' | 'ready' | 'error'

/**
 * ⚠️ <b>지도 SDK와 다른 스크립트다.</b> 지도는 {@code dapi.kakao.com/v2/maps/sdk.js}로 받아
 * {@code window.kakao}(소문자)를 만들고, 이쪽은 {@code window.Kakao}(대문자)를 만든다.
 * 둘 다 <b>같은 JavaScript 앱 키</b>를 쓰고 같은 도메인 등록(플랫폼 &gt; Web &gt; 사이트 도메인)을
 * 공유하므로, 지도가 뜨는 곳에서는 공유도 된다.
 *
 * <p>버전을 박아 둔다. 카카오는 `latest` 별칭을 주지 않고, 무엇보다 아래 무결성 해시가
 * <b>이 파일 하나</b>의 것이다 — 버전을 올리면 해시도 함께 다시 계산해야 한다
 * ({@code openssl dgst -sha384 -binary kakao.min.js | openssl base64 -A}).
 */
const SDK_URL = 'https://t1.kakaocdn.net/kakao_js_sdk/2.8.2/kakao.min.js'

/**
 * 받아온 스크립트가 우리가 확인한 그 파일인지 브라우저가 검사한다(Subresource Integrity).
 * 남의 CDN에서 받아 우리 도메인 권한으로 실행시키는 코드라, 그 파일이 조용히 바뀌면
 * 우리 화면에서 무슨 일이든 할 수 있다. 지도 SDK는 버전 고정이 안 되는 주소라 이 검사를 못 건다.
 */
const SDK_INTEGRITY = 'sha384-zt/G7/KfaRQ9dT/QIkS0ujMtzouJqzuSJcXVQu50x0rl/+mD1dc70AeOejVbMD9E'

/** 스크립트는 문서에 한 번만 붙는다. 지도 SDK와 같은 방식 */
let sdkPromise: Promise<void> | null = null

function loadSdk(appKey: string): Promise<void> {
  if (sdkPromise) {
    return sdkPromise
  }

  sdkPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SDK_URL
    script.integrity = SDK_INTEGRITY
    // integrity를 걸면 crossorigin이 함께 있어야 브라우저가 검사를 수행한다.
    script.crossOrigin = 'anonymous'
    script.async = true

    script.onload = () => {
      const sdk = window.Kakao
      if (!sdk) {
        reject(new Error('SDK를 불러왔지만 초기화되지 않았습니다.'))
        return
      }
      // 이미 켜져 있으면 다시 켜지 않는다 — 개발 모드의 이중 실행에서 두 번 불린다.
      if (!sdk.isInitialized()) {
        sdk.init(appKey)
      }
      resolve()
    }
    script.onerror = () => {
      // 실패한 약속을 남겨두면 재시도가 영영 막힌다.
      sdkPromise = null
      reject(new Error('카카오 SDK를 불러오지 못했습니다.'))
    }

    document.head.appendChild(script)
  })

  return sdkPromise
}

/**
 * 카카오톡 공유를 쓸 수 있는가.
 *
 * <p><b>준비되지 않았으면 버튼을 세우지 않는다.</b> 눌러 봐야 아무 일도 안 일어나는 버튼보다
 * 없는 편이 낫고, 링크 복사가 그 자리를 대신한다 — 카카오가 꺼져도 공유는 된다.
 */
export function useKakaoShare(): KakaoShareStatus {
  /*
    ⚠️ 이름은 MAP이지만 <b>카카오 JavaScript 앱 키</b>다. 지도와 공유가 같은 키를 쓴다.
    변수명을 바꾸면 이미 배포에 걸어 둔 환경변수까지 함께 갈아야 해서 그대로 둔다.
  */
  const appKey = import.meta.env.VITE_KAKAO_MAP_KEY
  const [status, setStatus] = useState<KakaoShareStatus>(appKey ? 'loading' : 'no-key')

  useEffect(() => {
    if (!appKey) {
      setStatus('no-key')
      return
    }
    let cancelled = false
    loadSdk(appKey)
      .then(() => {
        if (!cancelled) {
          setStatus('ready')
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus('error')
        }
      })
    return () => {
      cancelled = true
    }
  }, [appKey])

  return status
}

/**
 * 코스 한 장을 카카오톡으로 보낸다. 카톡이 대화방에 그리는 카드를 우리가 직접 채운다.
 *
 * <h3>왜 이것이 필요한가</h3>
 * 우리 서비스는 SPA라 서버가 주소마다 다른 HTML을 만들지 않는다. 그래서 링크만 붙여 보내면
 * 카톡이 읽어갈 미리보기(OG 태그)가 <b>모든 코스에서 똑같다</b> — "PEAKOFF" 한 줄이다.
 * 카카오톡 공유는 카드 내용을 보내는 쪽이 직접 실어 보내므로, 그 제약을 통째로 비껴간다.
 * 대화방에 코스 이름과 예상 한적 지수가 그대로 뜬다.
 *
 * <h3>⚠️ 숫자는 서버가 준 것만 쓴다</h3>
 * 카드에 적히는 점수는 {@link SharedCourse}의 값 그대로다 — 받는 사람이 링크를 눌러 보는
 * 화면과 같은 응답에서 왔다. 카드가 화면과 다른 숫자를 말할 자리를 만들지 않는다.
 *
 * @throws SDK가 준비되지 않았거나 카카오가 거절하면(도메인 미등록 등) 던진다.
 *         부르는 쪽이 받아서 링크 복사로 물러난다.
 */
export function shareCourseToKakao(course: SharedCourse, url: string): void {
  const sdk = window.Kakao
  if (!sdk?.isInitialized()) {
    throw new Error('카카오 공유가 준비되지 않았습니다.')
  }

  const link: KakaoShareLink = { mobileWebUrl: url, webUrl: url }
  const summary = summaryOf(course)
  /*
    출처를 카드에도 적는다. 이 카드는 공사 사진과 공사 예측에서 나온 숫자를 싣고 대화방에
    남는데, 거기서는 우리 화면의 푸터가 따라가지 못한다(공모전 규칙 4 — 기관명 표기는 필수).
  */
  const description = `${summary}\n출처: ⓒ한국관광공사`

  /*
    담긴 장소 중 <b>사진이 있는 첫 곳</b>. 피드 템플릿은 사진이 필수라, 하나도 없으면
    글자 템플릿으로 물러난다 — 사진을 지어내거나 빈 주소를 넣으면 카카오가 통째로 거절한다.
  */
  const imageUrl = course.places.find((place) => place.place?.imageUrl)?.place?.imageUrl

  const template: KakaoFeedTemplate | KakaoTextTemplate = imageUrl
    ? {
        objectType: 'feed',
        content: { title: course.name, description, imageUrl, link },
        buttons: [{ title: '코스 보기', link }],
      }
    : {
        objectType: 'text',
        text: `${course.name}\n${description}`,
        link,
        buttonTitle: '코스 보기',
      }

  sdk.Share.sendDefault(template)
}

/**
 * 카드 둘째 줄. "경주 1박 2일 · 예상 한적 지수 72 · 한적"
 *
 * <p>⚠️ <b>"실시간"이 아니라 "예상"이다.</b> 공사 자료는 예측값이라 화면 문구가 지키는 규칙을
 * 대화방에 나가는 카드도 똑같이 지켜야 한다. 그리고 진단하지 않은 코스는 <b>0으로 채우지
 * 않는다</b> — 0은 "매우 붐빔"으로 읽혀 뜻이 정반대가 된다.
 */
function summaryOf(course: SharedCourse): string {
  const trip = `${course.regionShortName} ${formatNights(course.nights)}`
  if (course.totalQuietness === null || course.levelLabel === null) {
    return `${trip} · 아직 진단하지 않은 코스예요`
  }
  return `${trip} · 예상 한적 지수 ${course.totalQuietness} · ${course.levelLabel}`
}
