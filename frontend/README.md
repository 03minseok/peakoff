# PEAKOFF — 웹

React 19 · TypeScript · Vite · Tailwind CSS v4 · React Router.
서비스 전체 설명과 실행 방법은 [저장소 README](../README.md)에 있다.

```bash
npm ci
npm run dev        # http://localhost:5173 — /api는 8080으로 프록시된다
npm run build      # tsc -b && vite build
npm run lint       # oxlint
npm run ui:shot    # Playwright로 화면을 열어 찍는다 (백엔드·프론트가 떠 있어야 한다)
npm run ui:report  # 찍은 결과 보기
```

`.env`는 `.env.example`을 복사해 만든다. 지금 쓰는 값은 `VITE_KAKAO_MAP_KEY` 하나이고,
비워 두면 지도 자리에 안내가 뜨는 대신 목록으로 코스를 편집할 수 있다.

## 이 폴더에서 지키는 것

- **모바일 우선.** 390px 기준으로 설계하고 데스크톱에서 깨지지 않게 한다.
- **색은 `src/index.css`의 `--c-*` 한 곳에서만 정의한다.** 컴포넌트에 hex를 박지 않는다.
  예외는 토큰이 닿지 않는 자리뿐이다 — 외부 브랜드색(카카오·네이버), 지도가 그리는 캔버스,
  React 바깥인 `public/favicon.svg`.
- **화면 바닥에 붙는 고정 막대를 두지 않는다.** 모바일 브라우저 도구막대와 자리를 다툰다.
- **가로로 미는 스크롤 상자를 만들지 않는다.** 끝까지 민 제스처가 페이지로 이어져
  화면 전체가 밀린다. 넘기는 느낌이 필요하면 `transform`으로 만든다.
- **코스 편집 화면에는 한적도를 노출하지 않는다.** 첫 코스는 사용자의 의도를 존중한다 —
  시스템이 개입하는 시점은 진단부터다.

자세한 근거는 [`CLAUDE.md`](../CLAUDE.md)의 "프론트엔드 디자인 규칙"에 있다.
