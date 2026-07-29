import { Route, Routes } from 'react-router'
import { Layout } from './components/Layout'
import { CoursePage } from './routes/CoursePage'
import { DiagnosisPage } from './routes/DiagnosisPage'
import { LoginPage } from './routes/LoginPage'
import { NotFoundPage } from './routes/NotFoundPage'
import { PlanPage } from './routes/PlanPage'
import { PreviewPage } from './routes/PreviewPage'
import { TripProvider } from './state/TripContext'

/**
 * 경로 구성.
 *
 * 서비스 흐름(조건 입력 → 코스 편집 → 진단·교체)을 그대로 주소에 옮겼다.
 * 단계가 주소로 남아야 뒤로가기가 자연스럽고, 심사 중 특정 화면을 바로 열어 보여줄 수 있다.
 *
 * 조건 입력이 곧 진입 화면이라 별도 랜딩 페이지를 두지 않았다.
 * 화면 하나를 더 거치게 하면 게스트가 서비스에 닿기까지 한 단계가 늘어난다.
 *
 * TripProvider가 라우터 안쪽에 있어야 각 화면이 앞 단계 입력을 읽을 수 있다.
 */
function App() {
  return (
    <TripProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<PlanPage />} />
          <Route path="course" element={<CoursePage />} />
          <Route path="diagnosis" element={<DiagnosisPage />} />
          <Route path="login" element={<LoginPage />} />

          {/* 개발용. 화면 구현이 끝나면 이 줄과 PreviewPage를 함께 지운다. */}
          <Route path="preview" element={<PreviewPage />} />

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </TripProvider>
  )
}

export default App
