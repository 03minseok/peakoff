import { useEffect, useState } from 'react'
import { ArrowDownToLine } from './icons'
import { Link, useLocation } from 'react-router'
import { useAuth } from '../state/authContext'
import { addCourseToTrip, fetchTrips } from '../services/api'
import { PRIMARY_BUTTON, TEXT_INPUT } from './styles'
import { useScrollLock } from '../hooks/useScrollLock'
import type { Trip } from '../types/api'

/** 여행 이름 최대 길이. 서버 SavedCourse.NAME_MAX_LENGTH와 같은 값이어야 한다 */
const NAME_MAX_LENGTH = 30

interface Props {
  /** 이름 입력란에 미리 채워둘 값. 예: "경주 2박 3일" */
  defaultName: string
  /**
   * 이미 저장한 코스를 고쳐 쓰는 중인가. 마이페이지의 "수정하기"로 들어온 경우다.
   *
   * <p>문구만 바뀐다 — 하는 일은 부르는 쪽이 정한다(이쪽은 {@code onSave}를 부를 뿐이다).
   * 그래도 문구는 갈려야 한다. "저장할까요?"라고 물어놓고 옛 코스를 덮어쓰면,
   * <b>사용자는 코스가 하나 더 생기는 줄 알고 눌렀다가 원래 것을 잃는다.</b>
   */
  editing?: boolean
  /** 공개 토글의 처음 상태. 고쳐 쓰는 중이면 저장해둔 값이 온다 */
  defaultPublic?: boolean
  onClose: () => void
  /**
   * 계정 저장. 실패하면 예외를 던진다.
   *
   * <p>저장된 코스 id를 돌려준다 — 저장 직후 "여행에 담기"를 펴려면 어느 코스인지 알아야 한다.
   */
  onSave: (name: string, isPublic: boolean) => Promise<number>
}

type Phase = 'asking' | 'saved' | 'failed'

/**
 * 저장 직후 여행에 담는 자리.
 *
 * <h3>왜 여기인가</h3>
 * 여행에 담고 싶은 순간은 <b>저장한 그 순간</b>이다. 이 줄이 없으면 마이페이지로 가서
 * 여행 탭을 열고 그 여행의 담기 목록에서 방금 그 코스를 다시 찾아야 한다 —
 * 세 걸음을 더 걷게 하고, 그 사이에 대개 잊는다.
 *
 * <p>⚠️ <b>저장을 막지 않는다.</b> 여행은 있으면 좋은 것이지 저장의 조건이 아니다.
 * 목록을 못 불러와도, 여행이 하나도 없어도 저장은 이미 끝나 있다 —
 * 이 자리는 저장 결과 화면이지 저장 절차가 아니다.
 */
type TripPick =
  | { status: 'loading' }
  | { status: 'ready'; trips: Trip[] }
  | { status: 'done'; tripName: string }
  | { status: 'hidden' }

const OUTLINE_BUTTON =
  'h-13 cursor-pointer rounded-ui border border-line bg-surface text-[15.5px] font-semibold text-fg transition-colors hover:bg-bg disabled:cursor-not-allowed disabled:text-hint'

const GHOST_BUTTON =
  'h-11 cursor-pointer rounded-ui bg-transparent text-[13.5px] font-medium text-hint transition-colors hover:text-muted'

/**
 * 코스를 저장하려 할 때 아래에서 올라오는 시트.
 *
 * <p>화면을 옮기지 않고 그 자리에서 묻는다. 저장은 결과를 확인하다가 곁들이는 행동이지
 * 새 화면으로 넘어갈 만큼 큰 일이 아니다.
 *
 * <h3>저장은 계정에만 한다</h3>
 * 예전에는 "이 기기에만 저장"(localStorage)이 함께 있었다. 뺀 이유는 그 저장이
 * <b>저장처럼 보이지만 저장이 아니었기</b> 때문이다 — 브라우저 데이터를 지우거나 다른 기기로
 * 옮기면 사라지고, 시크릿 모드에서는 애초에 실패한다. 사용자는 "저장했다"고 믿는데
 * 서비스는 그걸 지켜줄 수 없는 상태였다.
 *
 * <p>대신 <b>게스트는 저장 직전까지 전부 쓸 수 있다.</b> 코스 편집·진단·대안 교체·날짜 이동은
 * 로그인 없이 그대로 돌아간다. 로그인은 진입 장벽이 아니라 남기고 싶을 때 거치는 문이다.
 *
 * <p>그래서 게스트에게는 <b>이름을 묻지 않는다.</b> 아직 저장할 수 없는데 이름부터 짓게 하면
 * 채워 넣은 것이 버려진다.
 */
export function SaveCourseSheet({
  defaultName,
  editing = false,
  defaultPublic = true,
  onClose,
  onSave,
}: Props) {
  const { member } = useAuth()
  const location = useLocation()

  const [name, setName] = useState(defaultName)
  /*
    홈에 보일지. 새 코스의 기본은 켜 둔다 — 토글이 눈앞에 있어 사용자가 알고 고르고,
    아무도 공개하지 않으면 "요즘 저장된 여행"이 늘 비어 아무에게도 쓸모가 없다.

    ⚠️ 고쳐 쓰는 중이면 <b>저장해둔 값</b>이 온다. 늘 켜짐으로 열면 비공개로 둔 코스가
    고치는 것만으로 홈에 나간다 — 사용자가 그 화면에서 한 일은 장소를 바꾼 것뿐인데.
  */
  const [isPublic, setIsPublic] = useState(defaultPublic)
  const [phase, setPhase] = useState<Phase>('asking')
  /** 방금 저장한 코스. 여행에 담을 때 쓴다 */
  const [savedCourseId, setSavedCourseId] = useState<number | null>(null)
  /**
   * 방금 한 저장이 <b>덮어쓰기였는가.</b> 누른 순간의 {@code editing}을 담아 둔다 —
   * 저장이 끝나면 {@code editing}이 곧바로 켜지므로 그 값으로는 성공 화면을 그릴 수 없다.
   */
  const [savedAsEdit, setSavedAsEdit] = useState(false)
  const [tripPick, setTripPick] = useState<TripPick>({ status: 'loading' })
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  // 뒤 화면 잠금. ⚠️ body가 아니라 html에 건다 — 이유는 useScrollLock 주석에
  useScrollLock()
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey)


    return () => {
      window.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  const trimmedName = name.trim()
  const nameIsValid = trimmedName.length > 0 && trimmedName.length <= NAME_MAX_LENGTH

  async function handleSave() {
    if (!nameIsValid) {
      return
    }
    setFailure(null)
    setSaving(true)
    try {
      /*
        ⚠️ <b>지금의 editing을 붙잡아 둔다.</b>

        {@code onSave}가 끝나면 부르는 쪽이 "이제 이 코스를 고쳐 쓰는 중"으로 표시하는데
        ({@code markSaved}), 그 값이 곧 이 시트의 {@code editing}이다. 그래서 새 코스를
        저장하고 나면 성공 화면이 그려질 때는 이미 {@code editing}이 켜져 있어
        <b>"수정한 내용을 저장했어요"</b>가 떴다 — 방금 처음 만든 코스인데.

        <p>지금 화면이 답할 것은 "이 저장이 무엇이었나"이지 "지금 상태가 무엇인가"가
        아니다. 누른 순간의 값을 남겨 그것으로 말한다.
      */
      const wasEdit = editing
      const courseId = await onSave(trimmedName, isPublic)
      setSavedAsEdit(wasEdit)
      setPhase('saved')
      setSavedCourseId(courseId)

      /*
        여행 목록은 저장이 끝난 뒤에 부른다. 미리 불러 두면 저장하지 않고 닫는 사람에게도
        요청이 나가는데, 이 값은 저장한 다음에만 쓸 데가 있다.
      */
      fetchTrips()
        .then((trips) => setTripPick(trips.length === 0 ? { status: 'hidden' } : { status: 'ready', trips }))
        // 여행 담기는 덤이다. 못 불러왔다고 저장 성공 화면에 오류를 세우지 않는다.
        .catch(() => setTripPick({ status: 'hidden' }))
    } catch (error: unknown) {
      // 서버가 이유를 준다(저장 개수 초과 등). 그대로 보여주는 편이 친절하다.
      setFailure(error instanceof Error ? error.message : '저장하지 못했어요.')
      setPhase('failed')
    } finally {
      setSaving(false)
    }
  }

  /*
   * 로그인·가입을 마치면 이 화면으로 되돌아오게 한다.
   *
   * 없으면 게스트가 "로그인하고 저장하기"를 눌렀다가 홈으로 떨어져, 방금 짠 코스를 스스로
   * 찾아 들어와야 한다. 코스 자체는 sessionStorage에 남아 있지만 <b>돌아오는 길이 없으면</b>
   * 남아 있다는 사실을 알 방법이 없다.
   */
  const returnTo = { from: location.pathname }

  /*
    고쳐 쓰는 중에는 <b>하는 일이 다르다는 것을 문구가 말한다.</b>
    "저장할까요?"로 물으면 코스가 하나 더 생기는 줄 알고 누르게 되는데,
    실제로는 원래 코스를 덮어쓴다. 되돌릴 수 없는 일은 누르기 전에 알려야 한다.
  */
  const title =
    phase === 'saved'
      ? savedAsEdit
        ? '수정한 내용을 저장했어요'
        : '계정에 저장했어요'
      : phase === 'failed'
        ? '저장하지 못했어요'
        : member
          ? editing
            ? '수정한 내용으로 바꿀까요?'
            : '코스를 저장할까요?'
          : null

  const description =
    phase === 'saved'
      ? savedAsEdit
        ? '원래 코스가 방금 고친 내용으로 바뀌었어요.'
        : '어느 기기에서 로그인해도 이 코스를 다시 열어볼 수 있어요.'
      : phase === 'failed'
        ? (failure ?? '저장하지 못했어요.\n잠시 후 다시 시도해 주세요.')
        : member
          ? editing
            ? '새 코스로 따로 남지 않고, 마이페이지에 있던 그 코스가 이 내용으로 바뀌어요.'
            : '이름을 붙여 계정에 담아두면 나중에 다른 코스와 나란히 볼 수 있어요.'
          : '계정을 만들면 짠 코스를 저장해두고, 다음에 짠 코스와 한적 지수를 나란히 맞대어 볼 수 있어요.'

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/*
        뒤 화면을 덮는 막. 눌러서 닫을 수 있다.
        버튼이 아니라 div이므로 키보드 사용자를 위해 아래 "나중에 할게요"와 Esc가 같은 일을 한다.
      */}
      <div
        className="sheet-dim absolute inset-0 bg-[rgb(42_62_84/0.4)]"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className="sheet-panel bg-bg relative max-h-[92svh] overflow-y-auto rounded-t-[26px] shadow-[0_-10px_40px_rgb(42_62_84/0.24)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-course-title"
      >
        {/* 손잡이. 이 면이 아래에서 끌어올린 것이라는 신호다. */}
        <div className="flex justify-center pt-2.5">
          <span className="bg-line h-1 w-9.5 rounded-[2px]" aria-hidden="true" />
        </div>

        <div className="mx-auto flex w-full max-w-form flex-col gap-4.5 px-5.5 pt-5 pb-6">
          <div className="flex flex-col gap-2.25">
            <span
              className="bg-brand-tint text-brand-deep grid h-11.5 w-11.5 place-items-center rounded-[16px] text-xl"
              aria-hidden="true"
            >
              <ArrowDownToLine />
            </span>
            <h2
              id="save-course-title"
              className="text-fg m-0 text-[22px] leading-[1.35] font-bold tracking-[-0.02em] text-pretty"
            >
              {title ?? (
                <>
                  코스를 저장하려면
                  <br />
                  로그인하세요
                </>
              )}
            </h2>
            <p className="m-0 text-sm leading-[1.65] text-pretty whitespace-pre-line">{description}</p>
          </div>

          {/*
            이름은 <b>저장할 수 있는 사람에게만</b> 묻는다. 저장을 마친 뒤에도 묻지 않는다 —
            이름을 고치는 자리는 목록이지 여기가 아니다.
          */}
          {member && phase !== 'saved' && (
            <div className="flex flex-col gap-1.75">
              <div className="flex items-baseline justify-between gap-2">
                <label htmlFor="course-name" className="text-muted text-[12.5px] font-semibold">
                  여행 이름
                </label>
                <span
                  className={`text-xs ${trimmedName.length > NAME_MAX_LENGTH ? 'text-crowded-deep' : 'text-hint'}`}
                >
                  {trimmedName.length}/{NAME_MAX_LENGTH}
                </span>
              </div>
              <input
                id="course-name"
                type="text"
                className={TEXT_INPUT}
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={NAME_MAX_LENGTH}
                placeholder="예: 한적한 경주 첫 여행"
              />
              {/*
                공개 여부. <b>알리는 대신 고르게 한다.</b>

                예전에는 "이 이름은 홈에 보일 수 있어요"라고 알리기만 했다. 알리는 것도
                감추는 것보다는 낫지만, 싫은 사람에게 선택지가 없었다.

                기본을 켜 두는 이유: 토글이 이름 바로 아래 있어 저장 전에 반드시 눈에 들어오고,
                아무도 공개하지 않으면 "요즘 저장된 여행"이 늘 비어 아무에게도 쓸모가 없다.

                체크박스를 label로 감싸 글자를 눌러도 켜지게 한다 — 네모 하나만 누르게 하면
                손가락으로는 잘 안 맞는다.
              */}
              <label className="hover:bg-bg -mx-1.5 flex cursor-pointer items-start gap-2.5 rounded-[12px] px-1.5 py-2 transition-colors">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(event) => setIsPublic(event.target.checked)}
                  className="accent-brand mt-0.5 h-4 w-4 flex-none cursor-pointer"
                />
                <span className="flex flex-col gap-0.5">
                  <span className="text-fg text-[13.5px] font-medium">
                    다른 사람들에게도 보여주기
                  </span>
                  {/*
                    ⚠️ <b>무엇이 나가는지 여기서 정확히 말한다</b> (2026-08-31 고침).

                    카드 제목이 "챔석님의 경주"가 되면서 <b>나가는 값이 뒤바뀌었다</b> —
                    닉네임이 나가고 코스 이름은 안 나간다. 그런데 이 문구는 그 반대를
                    말하고 있었다("이 이름과 장소가 보여요 · 누가 저장했는지는 알려지지 않아요").

                    <p>동의를 받는 자리에서 틀린 말을 하면 <b>동의가 아니다.</b> 화면이 하는 일과
                    이 두 줄은 언제나 함께 고쳐야 한다.
                  */}
                  <span className="text-hint text-[12px] leading-[1.55]">
                    홈의 &lsquo;요즘 저장된 여행&rsquo;에 닉네임과 장소가 보여요.
                    <br />
                    코스 이름은 나만 볼 수 있어요.
                  </span>
                </span>
              </label>
            </div>
          )}

          {/*
            "지금 짠 코스는 그대로 있어요" 안내는 <b>로그인 화면으로 옮겼다.</b>
            결과 화면이 게스트를 시트 없이 로그인 화면으로 바로 보내면서,
            그 말이 필요한 자리도 그쪽이 됐다.
          */}

          <div className="flex flex-col gap-2.25">
            {phase === 'saved' ? (
              <>
                {/*
                  ■ 여행에 담기.

                  담고 싶은 순간은 저장한 그 순간이다. 이 줄이 없으면 마이페이지 → 여행 탭 →
                  그 여행의 담기 목록에서 방금 그 코스를 다시 찾아야 한다.

                  <p>여행이 하나도 없으면 아예 그리지 않는다({@code hidden}). 저장을 막 끝낸
                  사람에게 "여행을 먼저 만드세요"라고 하면, 하지 않아도 될 일을 시키는 것이다 —
                  여행은 마이페이지에서 만들면 된다.
                */}
                {tripPick.status === 'ready' && savedCourseId !== null && (
                  <div className="border-line flex flex-col gap-2 rounded-ui border p-3">
                    <span className="text-hint text-[12.5px] font-semibold">여행에 담기</span>
                    <div className="flex flex-wrap gap-1.5">
                      {tripPick.trips.map((trip) => (
                        <button
                          key={trip.id}
                          type="button"
                          className="bg-brand-tint text-brand-deep hover:bg-brand-soft rounded-chip min-h-9 cursor-pointer border-0 px-3.5 text-[13px] font-semibold transition-colors"
                          onClick={() => {
                            /*
                              담기에 실패해도 저장은 이미 끝났다. 실패를 붙잡아 화면에 세우면
                              "저장했는데 실패했다"로 읽힌다 — 조용히 목록만 닫는다.
                            */
                            void addCourseToTrip(trip.id, savedCourseId)
                              .then(() => setTripPick({ status: 'done', tripName: trip.name }))
                              .catch(() => setTripPick({ status: 'hidden' }))
                          }}
                        >
                          {trip.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {tripPick.status === 'done' && (
                  <p className="text-quiet-deep bg-quiet-tint rounded-ui m-0 px-3 py-2.5 text-[13px]">
                    "{tripPick.tripName}" 여행에 담았어요.
                  </p>
                )}

                <Link
                  to="/my"
                  className={`${PRIMARY_BUTTON} grid place-items-center no-underline`}
                >
                  마이페이지에서 보기
                </Link>
                <button type="button" className={OUTLINE_BUTTON} onClick={onClose}>
                  닫기
                </button>
              </>
            ) : member ? (
              <>
                <button
                  type="button"
                  className={PRIMARY_BUTTON}
                  onClick={() => void handleSave()}
                  disabled={!nameIsValid || saving}
                >
                  {saving ? '저장 중…' : editing ? '이 내용으로 바꾸기' : '저장하기'}
                </button>
                <button type="button" className={GHOST_BUTTON} onClick={onClose}>
                  나중에 할게요
                </button>
              </>
            ) : (
              <>
                {/*
                  <b>여기까지 오는 일은 드물다.</b> 결과 화면이 게스트를 로그인 화면으로
                  바로 보내므로, 이 갈래는 시트가 열린 뒤에 로그인이 풀린 경우
                  (토큰 만료 등)의 안전망이다.

                  ⚠️ <b>가입 버튼을 따로 두지 않는다.</b> 카카오·네이버 로그인은 로그인
                  화면에만 있어서, 가입을 먼저 권하면 소셜로 들어오려던 사람에게 그 길이
                  아예 안 보인다. 로그인 화면에 회원가입 링크가 있고 돌아올 곳도 함께 넘어간다.
                */}
                <Link
                  to="/login"
                  state={returnTo}
                  className={`${PRIMARY_BUTTON} grid place-items-center no-underline`}
                >
                  로그인하고 저장하기
                </Link>
                <button type="button" className={GHOST_BUTTON} onClick={onClose}>
                  나중에 할게요
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
