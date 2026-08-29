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

/**
 * "2026-09-16" → "9월 16일"
 *
 * <p>{@link formatCompactDate}("9.16")와 따로 두는 이유: 저쪽은 <b>칸에 들어가는 값</b>이라
 * 짧아야 하고, 이쪽은 <b>문장에 섞이는 말</b>이라 읽히는 대로 적어야 한다.
 * "9.16의 경주를 발견했어요"는 문장 가운데 표가 하나 끼어든 것처럼 읽힌다.
 *
 * <p>{@link formatKoreanDate}("9월 16일 (수)")와도 갈린다 — 요일 괄호는 날짜를 고르는
 * 자리에서 필요한 정보지, 제목 한가운데 들어가면 문장이 끊긴다.
 */
export function formatMonthDay(isoDate: string): string {
  const [, month, day] = isoDate.split('-').map(Number)
  return `${month}월 ${day}일`
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

/**
 * 박 수를 "2박 3일" 형태로. 당일치기는 "당일치기".
 *
 * {@link formatDuration}("3일")과 쓰임이 다르다. 좁은 칩에는 일수만, 코스 이름이나
 * 카드 정보줄처럼 자리가 있는 곳에는 박까지 적는 편이 여행 기간으로 읽힌다.
 */
export function formatNights(nights: number): string {
  return nights === 0 ? '당일치기' : `${nights}박 ${nights + 1}일`
}

/**
 * 지난 시각을 "2일 전"처럼 어림잡아 적는다.
 *
 * 정확한 시각(2026-08-03 14:22)은 "언제 저장했더라"에 답하지 않는다.
 * 목록을 훑을 때 필요한 것은 최근인지 오래됐는지뿐이다.
 */
export function formatRelativeTime(isoInstant: string): string {
  const elapsedMs = Date.now() - new Date(isoInstant).getTime()
  const minutes = Math.floor(elapsedMs / 60_000)

  if (minutes < 1) {
    return '방금 전'
  }
  if (minutes < 60) {
    return `${minutes}분 전`
  }

  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return `${hours}시간 전`
  }

  const days = Math.floor(hours / 24)
  if (days < 7) {
    return `${days}일 전`
  }
  if (days < 30) {
    return `${Math.floor(days / 7)}주 전`
  }
  if (days < 365) {
    return `${Math.floor(days / 30)}개월 전`
  }
  return `${Math.floor(days / 365)}년 전`
}

/** "2026-09-16" → 그 날짜가 오늘보다 앞인지. 지난 여행을 가려낼 때 쓴다 */
export function isPastDate(isoDate: string): boolean {
  return isoDate < today()
}

/** 시작일과 박 수로 "9.12 → 9.14"를 만든다. */
export function formatDateRange(startDate: string, nights: number): string {
  const [year, month, day] = startDate.split('-').map(Number)
  const end = new Date(year, month - 1, day + nights)
  return `${formatCompactDate(startDate)} → ${end.getMonth() + 1}.${end.getDate()}`
}
