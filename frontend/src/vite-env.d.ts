/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * 카카오맵 JavaScript 키.
   *
   * frontend/.env 에 넣는다. 이 값은 브라우저로 나가므로 비밀이 아니지만,
   * 계정에 묶인 값이라 저장소에 커밋하지 않는다. 보호는 카카오 콘솔의
   * 도메인 제한으로 한다.
   */
  readonly VITE_KAKAO_MAP_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
