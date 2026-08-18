import { fetchAuthorizeUrl } from './api'
import type { SocialProvider } from '../types/api'

/**
 * 소셜 로그인을 시작하고, 돌아왔을 때 그것이 우리가 시작한 로그인인지 확인한다.
 *
 * <h3>state가 하는 일</h3>
 * 로그인을 시작할 때 임의의 값을 만들어 두 곳에 둔다 — 카카오로 보내는 주소와 이 브라우저.
 * 돌아왔을 때 둘이 같은지 본다.
 *
 * 없으면 이런 공격이 성립한다. 공격자가 <b>자기 계정으로</b> 카카오 로그인을 시작해 콜백 주소를
 * 얻은 뒤, 그 주소를 피해자가 누르게 만든다. 피해자의 브라우저는 공격자의 계정으로 로그인되고,
 * 피해자는 자기 계정인 줄 알고 여행 코스를 저장한다. 그 내용은 공격자가 자기 계정에서 열어 본다.
 *
 * <h3>왜 sessionStorage인가</h3>
 * localStorage는 탭을 닫아도 남아서, 몇 시간 전에 시작하다 만 로그인의 값이 그대로 통과한다.
 * 쿠키는 서버로 자동 전송되어 이 값이 갈 필요 없는 요청에까지 실린다.
 * sessionStorage는 이 탭에서만, 탭이 살아 있는 동안만 남는다 — 이 값의 수명과 정확히 맞는다.
 */
const STATE_KEY = 'peakoff.oauth.state'

/** 로그인을 마친 뒤 돌아갈 곳. 콜백 주소에는 이 정보를 실을 수 없어 여기 맡겨둔다 */
const RETURN_KEY = 'peakoff.oauth.returnTo'

/**
 * 로그인 창으로 보낸다.
 *
 * <p>주소를 서버에서 받아오는 이유는 {@link fetchAuthorizeUrl} 주석에 있다.
 * 받아온 뒤 곧바로 이동하므로, 이 함수가 반환된 뒤의 코드는 실행되지 않는다고 봐야 한다.
 *
 * @param returnTo 로그인을 마치면 돌아갈 경로
 */
export async function startSocialLogin(
  provider: SocialProvider,
  returnTo: string,
): Promise<void> {
  const state = createState()
  sessionStorage.setItem(STATE_KEY, state)
  sessionStorage.setItem(RETURN_KEY, returnTo)

  const { authorizeUrl } = await fetchAuthorizeUrl(provider, state)

  /*
   * navigate가 아니라 location.href다. 카카오는 우리 앱 바깥이라 리액트 라우터가 갈 수 없다.
   * replace가 아닌 이유: 뒤로 가기를 눌렀을 때 로그인 화면으로 돌아오는 편이 자연스럽다.
   */
  window.location.href = authorizeUrl
}

/**
 * 돌아온 요청이 우리가 시작한 것인지 확인한다.
 *
 * <p>맞든 틀리든 저장한 값을 <b>지운다.</b> 남겨두면 같은 값으로 두 번 통과할 수 있는데,
 * 그러면 한 번 쓰고 버리는 값이라는 전제가 깨진다.
 *
 * <p>반환 타입이 `received is string`인 이유: 이 검사를 통과하면 값이 있다는 뜻이기도 하다.
 * 통과한 뒤에도 호출하는 쪽이 null을 한 번 더 다뤄야 하면, 확인이 끝난 값에 대고
 * "혹시 없으면" 같은 분기를 다시 쓰게 된다 — 그 분기는 도달하지 않는 자리다.
 */
export function consumeState(received: string | null): received is string {
  const saved = sessionStorage.getItem(STATE_KEY)
  sessionStorage.removeItem(STATE_KEY)
  return saved !== null && received !== null && saved === received
}

/** 로그인을 마친 뒤 돌아갈 곳. 없으면 홈으로 */
export function consumeReturnTo(): string {
  const saved = sessionStorage.getItem(RETURN_KEY)
  sessionStorage.removeItem(RETURN_KEY)
  return saved ?? '/'
}

/**
 * 추측할 수 없는 값을 만든다.
 *
 * <p>{@code Math.random()}을 쓰지 않는다. 암호학적으로 안전하지 않아 앞뒤 값을 알면
 * 다음 값을 계산해낼 수 있고, 그러면 공격자가 우리가 만들 state를 미리 맞춰 놓을 수 있다.
 */
function createState(): string {
  return crypto.randomUUID()
}
