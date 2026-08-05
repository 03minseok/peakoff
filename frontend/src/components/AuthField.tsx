import type { ReactNode } from 'react'
import { TEXT_INPUT, TEXT_INPUT_INVALID } from './styles'

interface Props {
  /** label과 input을 잇는 값. 화면 안에서 유일해야 한다 */
  id: string
  label: string
  type: 'email' | 'password' | 'text'
  value: string
  onChange: (value: string) => void
  /** 검증에 걸린 이유. 있으면 테두리가 바뀌고 아래에 문구가 붙는다 */
  error?: string
  /** 브라우저 자동완성 힌트. 로그인은 current-password, 가입은 new-password */
  autoComplete?: string
  placeholder?: string
  maxLength?: number
  /** 라벨 오른쪽에 놓는 링크 (예: "비밀번호 찾기") */
  labelAction?: ReactNode
  /** 칸 아래에 붙이는 것 (예: 비밀번호 강도 막대, 글자 수) */
  below?: ReactNode
}

/**
 * 로그인·회원가입 화면의 입력 한 칸.
 *
 * 이 프로젝트는 보통 스타일을 문자열로만 공유하고 컴포넌트로 감싸지 않는다
 * ({@link ./styles.ts} 참고). 여기서 컴포넌트를 만든 것은 모양뿐 아니라
 * <b>오류 문구와 입력칸의 연결</b>(aria-describedby)이 함께 묶여 있기 때문이다.
 * id를 두 곳에 맞춰 써야 하는 일이라, 페이지마다 손으로 적으면 한쪽에서 빠뜨린다.
 */
export function AuthField({
  id,
  label,
  type,
  value,
  onChange,
  error,
  autoComplete,
  placeholder,
  maxLength,
  labelAction,
  below,
}: Props) {
  const errorId = `${id}-error`

  return (
    <div className="flex flex-col gap-1.75">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-muted text-[12.5px] font-semibold">
          {label}
        </label>
        {labelAction}
      </div>

      <input
        id={id}
        type={type}
        className={error ? TEXT_INPUT_INVALID : TEXT_INPUT}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        maxLength={maxLength}
        // 오류가 있다는 사실을 스크린리더에도 알린다. 테두리 색만으로는 전달되지 않는다.
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />

      {below}

      {error && (
        <p id={errorId} className="text-crowded-deep m-0 text-xs" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
