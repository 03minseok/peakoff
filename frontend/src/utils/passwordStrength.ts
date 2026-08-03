/**
 * 비밀번호 강도. 회원가입 화면의 막대와 라벨에 쓴다.
 *
 * 강도를 <b>막지 않고 보여주기만 한다.</b> "약함"이어도 가입은 된다.
 * 규칙을 빡빡하게 걸면 사용자는 규칙을 통과하는 가장 짧은 비밀번호를 만들 뿐이고,
 * 그건 대개 더 안전하지도 않다. 최소 조건(8자)만 강제하고 나머지는 안내로 둔다.
 */

export interface PasswordStrength {
  /** 막대 너비 백분율 (0~100) */
  percent: number
  /** "약함" · "보통" · "안전" · "매우 안전". 입력 전에는 빈 문자열 */
  label: string
  /** 막대 색 */
  barClass: string
  /** 라벨 글자색 */
  textClass: string
}

/**
 * 네 가지를 만족할수록 강해진다: 8자 이상 / 숫자 / 영문 / 기호.
 *
 * 글자색에 -deep 계열을 쓰는 이유: 막대와 같은 색(#CE5138 등)을 11.5px 글자에 쓰면
 * 흰 배경에서 대비가 모자라 잘 안 읽힌다. 같은 계열의 진한 값으로 낮춰 잡는다.
 */
export function passwordStrength(password: string): PasswordStrength {
  if (password.length === 0) {
    return { percent: 0, label: '', barClass: 'bg-line', textClass: 'text-hint' }
  }

  let score = 0
  if (password.length >= 8) score += 1
  if (/\d/.test(password)) score += 1
  if (/[a-zA-Z]/.test(password)) score += 1
  if (/[^\w\s]/.test(password)) score += 1

  if (score <= 1) {
    return {
      percent: 30,
      label: '약함',
      barClass: 'bg-crowded',
      textClass: 'text-crowded-deep',
    }
  }
  if (score === 2) {
    return {
      percent: 55,
      label: '보통',
      barClass: 'bg-moderate',
      textClass: 'text-moderate-deep',
    }
  }
  if (score === 3) {
    return {
      percent: 80,
      label: '안전',
      barClass: 'bg-brand',
      textClass: 'text-brand-deep',
    }
  }
  return {
    percent: 100,
    label: '매우 안전',
    barClass: 'bg-brand',
    textClass: 'text-brand-deep',
  }
}
