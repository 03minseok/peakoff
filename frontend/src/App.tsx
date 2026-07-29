import { Route, Routes } from 'react-router'
import { Layout } from './components/Layout'
import { CoursePage } from './routes/CoursePage'
import { DiagnosisPage } from './routes/DiagnosisPage'
import { HomePage } from './routes/HomePage'
import { NotFoundPage } from './routes/NotFoundPage'
import { PlanPage } from './routes/PlanPage'
import { PreviewPage } from './routes/PreviewPage'

/**
 * 경로 구성.
 *
 * 서비스 흐름(조건 입력 → 코스 편집 → 진단·교체)을 그대로 주소에 옮겼다.
 * 단계가 주소로 남아야 뒤로가기가 자연스럽고, 심사 중 특정 화면을 바로 열어 보여줄 수 있다.
 *
 * Layout을 부모 라우트로 두어 헤더를 한 번만 그린다.
 */
function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="plan" element={<PlanPage />} />
        <Route path="course" element={<CoursePage />} />
        <Route path="diagnosis" element={<DiagnosisPage />} />

        {/* 개발용. 화면 구현이 끝나면 이 줄과 PreviewPage를 함께 지운다. */}
        <Route path="preview" element={<PreviewPage />} />

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

export default App
