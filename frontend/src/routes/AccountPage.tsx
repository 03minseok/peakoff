import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { AuthField } from '../components/AuthField'
import { FormSheet } from '../components/FormSheet'
import { ApiRequestError, changePassword } from '../services/api'
import { useAuth } from '../state/authContext'
import { passwordStrength } from '../utils/passwordStrength'
import { validatePassword } from '../utils/validation'

const NICKNAME_MAX_LENGTH = 12

/** 어떤 시트가 열려 있는가. null이면 다 닫힌 상태 */
type Sheet = 'nickname' | 'password' | 'delete' | null

/**
 * 계정 정보 한 줄.
 *
 * <p>값과 "변경" 버튼이 같은 줄에 선다. 각 항목을 카드로 따로 떼면 세 개의 카드가
 * 나란히 서서 화면이 무거워지는데, 여기서 할 일은 대부분 "지금 값 확인"이지
 * 변경이 아니다. 자주 하지 않는 일에 큰 자리를 주지 않는다.
 */
function Row({
  label,
  value,
  action,
  last = false,
}: {
  label: string
  value: string
  action?: ReactNode
  last?: boolean
}) {
  return (
    <div
      className={`flex min-h-15 items-center gap-3 ${last ? '' : 'border-line/60 border-b'}`}
    >
      <span className="text-hint w-16 flex-none text-[12.5px] font-semibold">{label}</span>
      <span className="text-fg min-w-0 flex-1 truncate text-[14.5px]">{value}</span>
      {action}
    </div>
  )
}

const ROW_ACTION =
  'border-line bg-surface text-fg hover:bg-bg h-9 flex-none cursor-pointer rounded-[11px] border px-3.5 text-[13px] font-semibold transition-colors'

/**
 * 계정 관리.
 *
 * <p>마이페이지에서 갈라 나온 화면이다. 마이페이지는 <b>저장한 코스를 보는 곳</b>이라
 * 계정 자체를 바꾸는 일(닉네임·비밀번호·탈퇴)이 같은 화면에 섞이면, 코스를 훑다가
 * 탈퇴 버튼을 지나치게 된다. 되돌릴 수 없는 일은 일부러 한 걸음 더 들어와야 닿게 둔다.
 *
 * <p>변경은 전부 시트에서 한다. 화면에 입력칸 여섯 개를 펼쳐두면 무엇을 바꾸는 중인지
 * 흐려지고, "저장" 버튼 하나가 세 가지 일을 하게 된다.
 */
export function AccountPage() {
  const navigate = useNavigate()
  const { member, loading: authLoading, changeNickname, deleteAccount } = useAuth()

  const [sheet, setSheet] = useState<Sheet>(null)
  const [busy, setBusy] = useState(false)
  /** 서버가 거절한 이유. 시트 안에 띄운다 — 시트를 닫아버리면 이유를 읽을 자리가 없다 */
  const [failure, setFailure] = useState<string | null>(null)
  /** 성공 알림. 시트가 닫힌 뒤 본문 위에 띠로 남는다 */
  const [notice, setNotice] = useState<string | null>(null)

  const [nickname, setNickname] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [deletePassword, setDeletePassword] = useState('')

  const strength = passwordStrength(newPassword)
  const mismatch = confirm.length > 0 && newPassword !== confirm
  const passwordError = newPassword.length > 0 ? validatePassword(newPassword) : undefined

  function openSheet(next: Exclude<Sheet, null>) {
    // 열 때마다 비운다. 지난번에 치다 만 값이 남아 있으면 무엇을 보내는지 알 수 없다.
    setNickname(member?.nickname ?? '')
    setCurrentPassword('')
    setNewPassword('')
    setConfirm('')
    setDeletePassword('')
    setFailure(null)
    setNotice(null)
    setSheet(next)
  }

  function closeSheet() {
    setSheet(null)
    setFailure(null)
  }

  /**
   * 시트 안에서 서버를 부르는 공통 처리.
   *
   * <p>세 동작이 하는 일은 다르지만 <b>실패했을 때 할 일은 같다</b> — 시트를 열어둔 채
   * 이유를 보여주고 다시 시도하게 한다. 각자 try/catch를 쓰면 그중 하나는 시트를 닫아버리게 된다.
   */
  async function run(action: () => Promise<void>, onDone: () => void) {
    setBusy(true)
    setFailure(null)
    try {
      await action()
      onDone()
    } catch (error: unknown) {
      setFailure(
        error instanceof ApiRequestError
          ? error.message
          : '처리하지 못했어요. 잠시 후 다시 시도해 주세요.',
      )
    } finally {
      setBusy(false)
    }
  }

  // 확인이 끝나기 전에 튕겨내면 새로고침할 때마다 로그인 화면이 스쳐 지나간다.
  if (authLoading) {
    return <div className="text-hint px-5 py-10 text-center text-[13px]">불러오는 중…</div>
  }
  if (!member) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="mx-auto flex w-full max-w-[430px] flex-col gap-5.5 px-4 pt-1 pb-10 md:max-w-read md:px-0">
      <div className="flex flex-col gap-2">
        <Link
          to="/my"
          className="text-hint hover:text-fg -ml-1 w-fit p-1 text-[13px] font-medium no-underline"
        >
          ‹ 마이페이지
        </Link>
        <h1 className="text-fg m-0 text-[23px] leading-[1.3] font-bold tracking-[-0.02em]">
          계정 관리
        </h1>
      </div>

      {notice && (
        <div
          className="bg-quiet-tint text-brand-deep rounded-card flex items-center justify-between gap-3 p-3.5"
          role="status"
        >
          <span className="text-[13px]">{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="알림 닫기"
            className="text-brand-deep/70 hover:text-brand-deep grid h-7 w-7 flex-none cursor-pointer place-items-center rounded-full bg-transparent text-sm"
          >
            ×
          </button>
        </div>
      )}

      <section className="flex flex-col gap-2.5">
        <span className="text-hint text-[12.5px] font-semibold">로그인 정보</span>
        <div className="bg-surface shadow-rest rounded-card flex flex-col px-4">
          {/*
            이메일에는 변경 버튼이 없다. 이메일이 곧 로그인 아이디라 바꾸려면
            "그 주소가 정말 본인 것인가"를 메일로 확인하는 절차가 따라와야 한다.
            그 절차 없이 바꾸게 두면 남의 주소를 적어 계정을 잠글 수 있다.
          */}
          <Row label="이메일" value={member.email} />
          <Row
            label="닉네임"
            value={member.nickname}
            action={
              <button type="button" className={ROW_ACTION} onClick={() => openSheet('nickname')}>
                변경
              </button>
            }
          />
          <Row
            label="비밀번호"
            value="••••••••"
            last
            action={
              <button type="button" className={ROW_ACTION} onClick={() => openSheet('password')}>
                변경
              </button>
            }
          />
        </div>
        <p className="text-hint m-0 px-1 text-[12px] leading-[1.6]">
          이메일은 로그인 아이디라 변경할 수 없어요.
        </p>
      </section>

      {/*
        탈퇴는 맨 아래에 따로 둔다. 위 카드에 네 번째 줄로 넣으면 닉네임 바꾸러 왔다가
        같은 모양의 버튼을 잘못 누를 수 있다. 성격이 다른 일은 자리도 달라야 한다.
      */}
      <section className="border-line flex flex-col gap-3 border-t pt-5">
        <span className="text-hint text-[12.5px] font-semibold">계정 삭제</span>
        <div className="border-crowded-soft/60 flex flex-col gap-3 rounded-card border border-dashed p-4">
          <p className="text-muted m-0 text-[13px] leading-[1.65] text-pretty">
            탈퇴하면 저장해둔 코스가 함께 사라지고, 되돌릴 수 없어요. 계정 없이도 코스를 짜고
            진단받는 것은 그대로 쓸 수 있어요.
          </p>
          <button
            type="button"
            onClick={() => openSheet('delete')}
            className="text-crowded-deep border-crowded-soft hover:bg-crowded-tint h-11 w-fit cursor-pointer rounded-[12px] border bg-transparent px-4 text-[13.5px] font-semibold transition-colors"
          >
            회원 탈퇴
          </button>
        </div>
      </section>

      {sheet === 'nickname' && (
        <FormSheet
          title="닉네임 변경"
          description="코스와 화면에 표시되는 이름이에요."
          submitLabel="변경하기"
          canSubmit={nickname.trim().length > 0 && nickname.trim() !== member.nickname}
          busy={busy}
          failure={failure}
          onCancel={closeSheet}
          onSubmit={() =>
            void run(
              () => changeNickname(nickname.trim()),
              () => {
                closeSheet()
                setNotice('닉네임을 바꿨어요.')
              },
            )
          }
        >
          <AuthField
            id="account-nickname"
            label="새 닉네임"
            type="text"
            value={nickname}
            onChange={setNickname}
            autoComplete="nickname"
            maxLength={NICKNAME_MAX_LENGTH}
            below={
              <span className="text-hint text-xs">
                {nickname.length}/{NICKNAME_MAX_LENGTH}
              </span>
            }
          />
        </FormSheet>
      )}

      {sheet === 'password' && (
        <FormSheet
          title="비밀번호 변경"
          description="지금 쓰는 비밀번호를 함께 확인해요."
          submitLabel="변경하기"
          canSubmit={
            currentPassword.length > 0 && !passwordError && !mismatch && confirm.length > 0
          }
          busy={busy}
          failure={failure}
          onCancel={closeSheet}
          onSubmit={() =>
            void run(
              /*
               * 여기만 useAuth가 아니라 api를 직접 부른다. 비밀번호를 바꿔도
               * 로그인 상태(토큰·회원 정보)는 그대로라 Context가 할 일이 없다.
               */
              () => changePassword({ currentPassword, newPassword, newPasswordConfirm: confirm }),
              () => {
                closeSheet()
                setNotice('비밀번호를 바꿨어요.')
              },
            )
          }
        >
          <AuthField
            id="account-current-password"
            label="현재 비밀번호"
            type="password"
            value={currentPassword}
            onChange={setCurrentPassword}
            autoComplete="current-password"
          />
          <AuthField
            id="account-new-password"
            label="새 비밀번호"
            type="password"
            value={newPassword}
            onChange={setNewPassword}
            error={passwordError}
            autoComplete="new-password"
            placeholder="8자 이상, 숫자 포함"
            below={
              <div className="flex items-center gap-2.25">
                <div className="bg-line/70 h-1.25 flex-1 overflow-hidden rounded-[3px]">
                  <div
                    className={`h-full rounded-[3px] transition-all duration-200 ${strength.barClass}`}
                    style={{ width: `${strength.percent}%` }}
                  />
                </div>
                <span
                  className={`w-13 flex-none text-right text-[11.5px] font-semibold ${strength.textClass}`}
                >
                  {strength.label}
                </span>
              </div>
            }
          />
          <AuthField
            id="account-new-password-confirm"
            label="새 비밀번호 확인"
            type="password"
            value={confirm}
            onChange={setConfirm}
            error={mismatch ? '비밀번호가 일치하지 않아요' : undefined}
            autoComplete="new-password"
          />
        </FormSheet>
      )}

      {sheet === 'delete' && (
        <FormSheet
          title="정말 탈퇴할까요?"
          description="계정과 저장한 코스가 모두 사라져요. 되돌릴 수 없어요."
          submitLabel="탈퇴하기"
          cancelLabel="그대로 두기"
          danger
          canSubmit={deletePassword.length > 0}
          busy={busy}
          failure={failure}
          onCancel={closeSheet}
          onSubmit={() =>
            void run(
              () => deleteAccount(deletePassword),
              // 계정이 사라졌으니 이 화면에 남아 있을 수 없다.
              // 다음 렌더에서 member가 null이 되어 로그인 화면으로 밀려나기 전에 먼저 옮긴다.
              () => navigate('/', { replace: true }),
            )
          }
        >
          <AuthField
            id="account-delete-password"
            label="비밀번호 확인"
            type="password"
            value={deletePassword}
            onChange={setDeletePassword}
            autoComplete="current-password"
            placeholder="본인 확인을 위해 입력해 주세요"
          />
        </FormSheet>
      )}
    </div>
  )
}
