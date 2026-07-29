import { useEffect, useState } from 'react'
import { ApiRequestError, fetchPlaces } from './services/api'
import type { Place } from './types/api'
import './App.css'

/** v1 파일럿 지역. 지역 선택 화면이 생기면 상태로 올라간다. */
const REGION = 'gyeongju'

type LoadState =
  | { phase: 'loading' }
  | { phase: 'loaded'; places: Place[] }
  | { phase: 'error'; message: string }

function App() {
  const [state, setState] = useState<LoadState>({ phase: 'loading' })

  useEffect(() => {
    // StrictMode는 개발 중 effect를 두 번 실행한다. 정리 함수에서 이전 요청을 취소한다.
    const controller = new AbortController()

    fetchPlaces(REGION, controller.signal)
      .then((places) => setState({ phase: 'loaded', places }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
        const message =
          error instanceof ApiRequestError ? error.message : '알 수 없는 오류가 발생했습니다.'
        setState({ phase: 'error', message })
      })

    return () => controller.abort()
  }, [])

  return (
    <main className="app">
      <header className="app-header">
        <h1>PEAKOFF</h1>
        <p>예측 기반 혼잡 회피 여행 플래너</p>
      </header>

      {state.phase === 'loading' && <p className="status">장소를 불러오는 중…</p>}

      {state.phase === 'error' && <p className="status status--error">{state.message}</p>}

      {state.phase === 'loaded' && (
        <section>
          <p className="status">경주 {state.places.length}곳</p>
          <ul className="place-list">
            {state.places.map((place) => (
              <li key={place.id} className="place">
                <span className="place-name">{place.name}</span>
                <span className="place-category">{place.categoryName}</span>
                <span className="place-coords">
                  {place.latitude.toFixed(4)}, {place.longitude.toFixed(4)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}

export default App
