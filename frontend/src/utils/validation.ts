/**
 * 로그인·회원가입 입력 규칙.
 *
 * 화면 두 곳(로그인·회원가입)이 같은 규칙을 쓴다. 각 페이지에 따로 적으면
 * 나중에 한쪽만 고쳐서 "가입은 되는데 로그인은 안 되는" 상태가 만들어진다.
 *
 * 여기 있는 것은 <b>보내기 전에 걸러내는 1차 검증</b>일 뿐이다.
 * 실제 판정(중복 이메일, 비밀번호 일치 여부)은 서버가 한다.
 * 백엔드의 검증 3층 구조에서 이건 층 바깥의 편의 장치다.
 */

/** 비밀번호 최소 길이. 서버 규칙이 정해지면 그 값에 맞춘다. */
export const PASSWORD_MIN_LENGTH = 8

/**
 * 이메일 모양 검사.
 *
 * RFC에 맞는 완전한 정규식을 쓰지 않는다. 그런 정규식은 수십 줄이 되고,
 * 정작 실제로 쓰는 주소를 거부하는 사고가 난다. 여기서 막고 싶은 것은
 * "@를 빼먹었다" 정도의 명백한 오타뿐이다. 진짜 유효성은 서버가 판단한다.
 */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** @returns 문제가 없으면 undefined, 있으면 화면에 그대로 띄울 한국어 메시지 */
export function validateEmail(email: string): string | undefined {
  const trimmed = email.trim()
  if (trimmed.length === 0) {
    return '이메일을 입력해 주세요.'
  }
  if (!EMAIL_SHAPE.test(trimmed)) {
    return '이메일 형식이 올바르지 않아요.'
  }
  return undefined
}

export function validatePassword(password: string): string | undefined {
  if (password.length === 0) {
    return '비밀번호를 입력해 주세요.'
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 해요.`
  }
  return undefined
}

/**
 * 로그인 화면의 비밀번호는 길이를 따지지 않는다.
 *
 * 규칙이 바뀌기 전에 가입한 사람이 자기 비밀번호를 맞게 넣고도
 * "8자 이상이어야 한다"며 막히면, 로그인할 방법이 사라진다.
 * 로그인에서는 비었는지만 보고, 맞고 틀림은 서버에 맡긴다.
 */
export function validatePasswordPresence(password: string): string | undefined {
  return password.length === 0 ? '비밀번호를 입력해 주세요.' : undefined
}

export function validatePasswordConfirm(
  password: string,
  confirm: string,
): string | undefined {
  if (confirm.length === 0) {
    return '비밀번호를 한 번 더 입력해 주세요.'
  }
  if (password !== confirm) {
    return '비밀번호가 서로 달라요.'
  }
  return undefined
}
