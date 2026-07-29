import { useEffect, useState } from 'react'
import './App.css'

type HealthResponse = {
  status: string
}

/** 연결 확인 상태. 성공/실패를 각각 다른 모양으로 들고 있어 화면에서 분기하기 쉽게 한다. */
type ConnectionState =
  | { phase: 'loading' }
  | { phase: 'ok'; status: string }
  | { phase: 'error'; message: string }

function App() {
  const [connection, setConnection] = useState<ConnectionState>({
    phase: 'loading',
  })

  useEffect(() => {
    // StrictMode는 개발 중 effect를 두 번 실행한다. 정리 함수에서 이전 요청을 취소해 둔다.
    const controller = new AbortController()

    fetch('/api/health', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        return response.json() as Promise<HealthResponse>
      })
      .then((data) => setConnection({ phase: 'ok', status: data.status }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
        setConnection({
          phase: 'error',
          message: error instanceof Error ? error.message : '알 수 없는 오류',
        })
      })

    return () => controller.abort()
  }, [])

  return (
    <main className="app">
      <header className="app-header">
        <h1>PEAKOFF</h1>
        <p>예측 기반 혼잡 회피 여행 플래너</p>
      </header>

      <section className={`health health--${connection.phase}`}>
        <h2>서버 연결 확인</h2>
        <p className="health-endpoint">GET /api/health</p>

        {connection.phase === 'loading' && (
          <p className="health-result">확인 중…</p>
        )}
        {connection.phase === 'ok' && (
          <p className="health-result">
            응답: <code>{connection.status}</code>
          </p>
        )}
        {connection.phase === 'error' && (
          <p className="health-result">연결 실패: {connection.message}</p>
        )}
      </section>
    </main>
  )
}

export default App
