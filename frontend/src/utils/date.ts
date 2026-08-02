/**
 * `<input type="date">`가 쓰는 yyyy-MM-dd 문자열로 바꾼다.
 *
 * <b>toISOString()을 쓰면 안 된다.</b> 그건 UTC 기준이라 한국 시간 저녁 9시 이후에는
 * 날짜가 하루 앞으로 밀린다. 9월 12일 밤에 열면 9월 11일이 기본값으로 잡히는 식이다.
 * 사용자가 보는 달력은 로컬 시간 기준이므로 로컬 값으로 직접 만든다.
 */
export function toDateInputValue(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function today(): string {
  return toDateInputValue(new Date())
}

export function daysFromToday(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return toDateInputValue(date)
}

/** "2026-09-12" → "9월 12일 (토)" */
export function formatKoreanDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  // month - 1: Date의 월은 0부터 시작한다
  const date = new Date(year, month - 1, day)
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()]
  return `${month}월 ${day}일 (${weekday})`
}

/**
 * "2026-09-12" → "9.12"
 *
 * 헤더처럼 자리가 좁은 곳에서 쓴다. 고정폭 글꼴과 함께 두면
 * 자릿수가 달라도 줄이 흔들리지 않는다.
 */
export function formatCompactDate(isoDate: string): string {
  const [, month, day] = isoDate.split('-').map(Number)
  return `${month}.${day}`
}

/** "2026-09-12" → "토요일" */
export function formatWeekday(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return `${['일', '월', '화', '수', '목', '금', '토'][date.getDay()]}요일`
}

/**
 * 박 수를 화면에 쓰는 기간 표기로 바꾼다. 0박 → "1일", 2박 → "3일".
 *
 * 내부에서는 박 수(nights)를 그대로 들고 다닌다. 서버 요청 필드가 박 수이고,
 * 일수로 바꿔 저장하면 보낼 때마다 되돌려야 해서 실수가 끼어들 자리가 생긴다.
 * 표기만 여기서 한 번 바꾼다.
 */
export function formatDuration(nights: number): string {
  return `${nights + 1}일`
}

/** 시작일과 박 수로 "9.12 → 9.14"를 만든다. */
export function formatDateRange(startDate: string, nights: number): string {
  const [year, month, day] = startDate.split('-').map(Number)
  const end = new Date(year, month - 1, day + nights)
  return `${formatCompactDate(startDate)} → ${end.getMonth() + 1}.${end.getDate()}`
}
