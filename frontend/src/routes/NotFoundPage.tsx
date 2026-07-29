import { Link } from 'react-router'
import { PageStub } from '../components/PageStub'

export function NotFoundPage() {
  return (
    <>
      <PageStub title="페이지를 찾을 수 없습니다" description="주소를 다시 확인해 주세요." />
      <Link to="/">처음으로</Link>
    </>
  )
}
