import { useEffect, useState } from 'react'
import '../types/kakao'

/**
 * 카카오맵 SDK 로딩 상태.
 *
 * `no-key`를 따로 둔 것이 중요하다. 키가 없는 것은 오류가 아니라 <b>아직 설정하지 않은 상태</b>이고,
 * 안내 문구가 달라야 한다. 실패로 뭉뚱그리면 팀원이 원인을 못 찾는다.
 */
export type MapSdkStatus = 'no-key' | 'loading' | 'ready' | 'error'

const SDK_URL = 'https://dapi.kakao.com/v2/maps/sdk.js'

/**
 * 스크립트는 문서 전체에 한 번만 붙어야 한다.
 * 모듈 수준에 약속을 캐시해, 컴포넌트가 여러 번 마운트돼도 재사용한다.
 */
let sdkPromise: Promise<void> | null = null

function loadSdk(appKey: string): Promise<void> {
  if (sdkPromise) {
    return sdkPromise
  }

  sdkPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    // autoload=false: 스크립트를 받은 뒤 kakao.maps.load()로 초기화 시점을 우리가 정한다.
    script.src = `${SDK_URL}?appkey=${appKey}&autoload=false`
    script.async = true

    script.onload = () => {
      if (!window.kakao) {
        reject(new Error('SDK를 불러왔지만 초기화되지 않았습니다.'))
        return
      }
      window.kakao.maps.load(() => resolve())
    }
    script.onerror = () => {
      // 실패한 약속을 남겨두면 재시도가 영영 막힌다.
      sdkPromise = null
      reject(new Error('지도 SDK를 불러오지 못했습니다.'))
    }

    document.head.appendChild(script)
  })

  return sdkPromise
}

export function useKakaoSdk(): MapSdkStatus {
  const appKey = import.meta.env.VITE_KAKAO_MAP_KEY
  const [status, setStatus] = useState<MapSdkStatus>(appKey ? 'loading' : 'no-key')

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
