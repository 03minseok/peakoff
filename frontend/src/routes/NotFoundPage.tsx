import { Link } from 'react-router'
import { PageStub } from '../components/PageStub'
import { FORM_COLUMN } from '../components/styles'

export function NotFoundPage() {
  return (
    <div className={FORM_COLUMN}>
      <PageStub title="페이지를 찾을 수 없습니다" description="주소를 다시 확인해 주세요." />
      <Link to="/" className="text-brand-deep text-sm font-semibold">
        처음으로
      </Link>
    </div>
  )
}
