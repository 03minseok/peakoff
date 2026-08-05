import { Route, Routes } from 'react-router'
import { Layout } from './components/Layout'
import { CoursePage } from './routes/CoursePage'
import { DiagnosisPage } from './routes/DiagnosisPage'
import { HomePage } from './routes/HomePage'
import { LoginPage } from './routes/LoginPage'
import { NotFoundPage } from './routes/NotFoundPage'
import { PlanPage } from './routes/PlanPage'
import { PreviewPage } from './routes/PreviewPage'
import { ResultPage } from './routes/ResultPage'
import { SignupPage } from './routes/SignupPage'
import { AuthProvider } from './state/AuthProvider'
import { TripProvider } from './state/TripProvider'

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
    // AuthProvider가 바깥이다. 저장한 코스를 계정에 올리려면 여행 상태 쪽에서
    // "지금 누가 로그인했는지"를 물을 수 있어야 하고, 그 반대는 필요 없다.
    <AuthProvider>
      <TripProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="plan" element={<PlanPage />} />
            <Route path="course" element={<CoursePage />} />
            <Route path="diagnosis" element={<DiagnosisPage />} />
            <Route path="result" element={<ResultPage />} />
            {/* 개발용. 화면 구현이 끝나면 이 줄과 PreviewPage를 함께 지운다. */}
            <Route path="preview" element={<PreviewPage />} />

            <Route path="*" element={<NotFoundPage />} />
          </Route>

          {/*
            홈도 Layout 밖에 둔다.

            공용 헤더에는 로고와 로그인 링크가 이미 있는데, 홈은 같은 것을 한 줄 소개와 함께
            더 크게 들고 있다. 둘을 겹쳐 두면 로고가 세로로 두 번 나온다.
          */}
          <Route index element={<HomePage />} />

          {/*
            계정 화면도 Layout 밖에 둔다.

            여기서 할 일은 "계정을 만들거나 들어가는 것" 하나뿐이라,
            여행 정보를 이고 다니는 공용 헤더가 오히려 방해가 된다.
            두 화면은 자기 상단 바(뒤로·닫기)를 직접 들고 있다.
          */}
          <Route path="login" element={<LoginPage />} />
          <Route path="signup" element={<SignupPage />} />
        </Routes>
      </TripProvider>
    </AuthProvider>
  )
}

export default App
