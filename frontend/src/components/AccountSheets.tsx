import { useState } from 'react'
import { useNavigate } from 'react-router'
import { AuthField } from './AuthField'
import { FormSheet } from './FormSheet'
import { ApiRequestError, changePassword } from '../services/api'
import { useAuth } from '../state/authContext'
import { passwordStrength } from '../utils/passwordStrength'
import { validatePassword } from '../utils/validation'

const NICKNAME_MAX_LENGTH = 12

/** 열 수 있는 시트. null이면 전부 닫힌 상태 */
export type AccountSheet = 'nickname' | 'password' | 'delete'

interface Props {
  open: AccountSheet | null
  onClose: () => void
  /** 성공했을 때 보여줄 문구. 시트가 닫힌 뒤 부른 화면이 띠로 띄운다 */
  onDone: (message: string) => void
}

/**
 * 계정을 고치는 시트 셋.
 *
 * <p>마이페이지에서 떼어낸 이유는 <b>여는 자리가 갈리기 때문</b>이다. 닉네임·비밀번호는
 * 로그인 정보 카드에서, 탈퇴는 맨 아래 버튼에서 열리는데 셋 다 같은 성격이라 한 곳에 모여야 한다.
 * 입력값·처리 중 상태·실패 문구도 여기 갇혀 있어, 부른 화면은 "어느 시트를 열지"만 알면 된다.
 *
 * <p>시트를 열 때마다 입력이 비워진다. {@code key}가 시트 종류라, 종류가 바뀌면 리액트가
 * 컴포넌트를 새로 만들어 지난번에 치다 만 값이 남지 않는다.
 */
export function AccountSheets({ open, onClose, onDone }: Props) {
  if (!open) {
    return null
  }
  return <Sheet key={open} kind={open} onClose={onClose} onDone={onDone} />
}

function Sheet({
  kind,
  onClose,
  onDone,
}: {
  kind: AccountSheet
  onClose: () => void
  onDone: (message: string) => void
}) {
  const navigate = useNavigate()
  const { member, changeNickname, deleteAccount } = useAuth()

  const [busy, setBusy] = useState(false)
  /** 서버가 거절한 이유. 시트 안에 띄운다 — 닫아버리면 이유를 읽을 자리가 없다 */
  const [failure, setFailure] = useState<string | null>(null)

  const [nickname, setNickname] = useState(member?.nickname ?? '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [deletePassword, setDeletePassword] = useState('')

  const strength = passwordStrength(newPassword)
  const mismatch = confirm.length > 0 && newPassword !== confirm
  const passwordError = newPassword.length > 0 ? validatePassword(newPassword) : undefined

  /**
   * 서버를 부르는 공통 처리.
   *
   * <p>세 동작이 하는 일은 다르지만 <b>실패했을 때 할 일은 같다</b> — 시트를 열어둔 채
   * 이유를 보여주고 다시 시도하게 한다. 각자 try/catch를 쓰면 그중 하나는 시트를 닫아버린다.
   */
  async function run(action: () => Promise<void>, done: () => void) {
    setBusy(true)
    setFailure(null)
    try {
      await action()
      done()
    } catch (error: unknown) {
      setFailure(
        error instanceof ApiRequestError
          ? error.message
          : '처리하지 못했어요.\n잠시 후 다시 시도해 주세요.',
      )
    } finally {
      setBusy(false)
    }
  }

  if (kind === 'nickname') {
    return (
      <FormSheet
        title="닉네임 변경"
        description="코스와 화면에 표시되는 이름이에요."
        submitLabel="변경하기"
        canSubmit={nickname.trim().length > 0 && nickname.trim() !== member?.nickname}
        busy={busy}
        failure={failure}
        onCancel={onClose}
        onSubmit={() =>
          void run(
            () => changeNickname(nickname.trim()),
            () => {
              onClose()
              onDone('닉네임을 바꿨어요.')
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
            <span className="text-muted text-xs">
              {nickname.length}/{NICKNAME_MAX_LENGTH}
            </span>
          }
        />
      </FormSheet>
    )
  }

  if (kind === 'password') {
    return (
      <FormSheet
        title="비밀번호 변경"
        description="지금 쓰는 비밀번호를 함께 확인해요."
        submitLabel="변경하기"
        canSubmit={
          currentPassword.length > 0 && !passwordError && !mismatch && confirm.length > 0
        }
        busy={busy}
        failure={failure}
        onCancel={onClose}
        onSubmit={() =>
          void run(
            /*
             * 여기만 useAuth가 아니라 api를 직접 부른다. 비밀번호를 바꿔도
             * 로그인 상태(토큰·회원 정보)는 그대로라 Context가 할 일이 없다.
             */
            () => changePassword({ currentPassword, newPassword, newPasswordConfirm: confirm }),
            () => {
              onClose()
              onDone('비밀번호를 바꿨어요.')
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
    )
  }

  return (
    <FormSheet
      title="정말 탈퇴할까요?"
      description={'계정과 저장한 코스가 모두 사라져요.\n되돌릴 수 없어요.'}
      submitLabel="탈퇴하기"
      cancelLabel="돌아가기"
      danger
      canSubmit={deletePassword.length > 0}
      busy={busy}
      failure={failure}
      onCancel={onClose}
      onSubmit={() =>
        void run(
          () => deleteAccount(deletePassword),
          // 계정이 사라졌으니 이 화면에 남아 있을 수 없다. 다음 렌더에서 member가 null이 되어
          // 로그인 화면으로 밀려나기 전에 먼저 옮긴다.
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
  )
}
