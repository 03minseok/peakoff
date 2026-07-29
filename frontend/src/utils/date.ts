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
