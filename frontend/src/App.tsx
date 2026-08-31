import { Navigate, Route, Routes } from 'react-router'
import { Layout } from './components/Layout'
import { CoursePage } from './routes/CoursePage'
import { DiagnosisPage } from './routes/DiagnosisPage'
import { HomePage } from './routes/HomePage'
import { MyPage } from './routes/MyPage'
import { LoginPage } from './routes/LoginPage'
import { NotFoundPage } from './routes/NotFoundPage'
import { OAuthCallbackPage } from './routes/OAuthCallbackPage'
import { PlanPage } from './routes/PlanPage'
import { RecommendPage } from './routes/RecommendPage'
import { PreviewPage } from './routes/PreviewPage'
import { ResultPage } from './routes/ResultPage'
import { SignupPage } from './routes/SignupPage'
import { AuthProvider } from './state/AuthProvider'
import { RegionProvider } from './state/RegionProvider'
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
      {/*
        지역 목록을 받은 뒤에 화면을 그린다. 거의 모든 화면이 첫 줄부터 지역명을 쓰는데,
        목록 없이 그리면 그 자리들이 잠깐 빈 문자열로 섰다가 채워진다.
        공사를 부르지 않는 요청이라 기다리는 대가가 작다 — RegionProvider 주석 참고.
      */}
      <RegionProvider>
      <TripProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="plan" element={<PlanPage />} />
            {/*
              설문 기반 코스 추천. 경주를 모르는 사용자의 진입점이다.

              결과(초안)는 주소를 따로 두지 않고 이 화면 안에서 편다. 같은 답을 보내도
              매번 다른 코스가 오기 때문에(가중 무작위 추출), 주소로 다시 열어도
              그때 그 코스가 아니다 — 주소를 나눠도 얻는 것이 없다.
            */}
            <Route path="recommend" element={<RecommendPage />} />
            <Route path="course" element={<CoursePage />} />
            <Route path="diagnosis" element={<DiagnosisPage />} />
            <Route path="result" element={<ResultPage />} />
            {/* 로그인 확인은 화면 안에서 한다. 라우트에서 막으면 확인이 끝나기 전에
                로그인 화면이 한 번 스쳐 지나간다. */}
            <Route path="my" element={<MyPage />} />
            {/*
              계정 관리는 마이페이지로 합쳤다. 주소를 그냥 없애면 저장해둔 링크가 404가 되므로
              옮겨 보낸다. 히스토리를 남기지 않아(replace) 뒤로가기가 이 주소를 다시 밟지 않는다.
            */}
            <Route path="my/account" element={<Navigate to="/my" replace />} />
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

          {/*
            제공자가 사용자를 되돌려 보내는 자리.

            주소를 카카오 콘솔에 등록해뒀기 때문에 <b>마음대로 바꿀 수 없다</b> —
            바꾸려면 콘솔의 Redirect URI와 서버 설정(redirect-uri)을 함께 고쳐야 한다.
            provider를 경로에 둔 이유는 네이버가 붙을 때 화면을 하나 더 만들지 않기 위해서다.
          */}
          <Route path="oauth/callback/:provider" element={<OAuthCallbackPage />} />
        </Routes>
      </TripProvider>
      </RegionProvider>
    </AuthProvider>
  )
}

export default App
