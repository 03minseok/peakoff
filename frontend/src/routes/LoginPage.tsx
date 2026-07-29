import { Link } from 'react-router'
import { PageStub } from '../components/PageStub'

/**
 * 로그인은 아직 만들지 않았다.
 *
 * 게스트로 전체 흐름이 도는 것이 먼저이고, 로그인은 "코스를 저장해 비교하기 위한"
 * 선택지로 그 위에 얹는다. 진입 장벽이 아니다.
 */
export function LoginPage() {
  return (
    <>
      <PageStub
        title="로그인"
        description="코스를 저장하고 다른 코스와 비교하려면 로그인이 필요합니다. 준비 중이에요."
      />
      <Link to="/">로그인 없이 이용하기</Link>
    </>
  )
}
