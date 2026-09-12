# PEAKOFF

2026 관광데이터 활용 공모전 ②-2 웹·앱 구현 부문 출품작.
이 문서는 **저장소의 실제 구현 상태를 기술한 기준 문서**다. 기능설명서·PT 자료는 여기서 값을 가져간다.

> **읽는 법 — 이 문서의 세 층**
> - `[코드]` 실행 코드에서 직접 확인한 사실. 파일 경로가 함께 적혀 있다.
> - `[기획]` 의도·규칙. 코드로는 검증되지 않으며, 새 코드를 쓸 때 지켜야 하는 제약.
> - `[확인 필요]` 코드와 기획이 어긋나거나, 코드에서 확인할 수 없는 것.
>
> 최종 감사일: **2026-09-12** (브랜치 `develop`, 커밋 `f92a83a`).
> 값·경로는 그날의 코드 기준이다. 수정 전 반드시 코드에서 다시 확인할 것.

---

## 0. 절대 규칙 (위반 시 공모전 탈락/감점)

협상 불가. 코드 작성 시 항상 우선한다.

1. **공사 OpenAPI로 데이터를 가져온다. 파일 데이터나 DB 적재로 대체하지 않는다.**
   - 심사 시 인증키로 호출 이력을 검증하므로, 개발 기간 내내 실제 호출이 발생해야 한다.
   - 인메모리 캐시는 허용. 기본 TTL 6시간(`RegionCache.DEFAULT_TTL`).
   - 금지: 데이터를 DB에 영구 적재하고 API를 사실상 호출하지 않는 구조.
     현재 DB(H2/PostgreSQL)에는 **회원·저장코스·여행·즐겨찾기만** 들어간다.
   - **공사가 침묵할 때만 옛 값으로 메꾸고, 최대 사흘이다** (`TtlCache.MAX_STALE`).
   - ⚠️ **빈 응답(200 + 0건)이 멀쩡한 옛 값을 밀어내지 못하게 한다.**
     `RegionCache`의 `usable` 술어가 이 역할을 한다 — 예외로 던지지 않고 옛 값을 지킨다.
     옛 값이 없으면 그 지역만 조용히 빠진다.
2. **파일 데이터(Excel, CSV) 다운로드 활용 금지.** OpenAPI 호출 형태만 인정된다.
3. **폐기 예정 코드 사용 금지.** 지역/분류 지정은 **법정동 코드 / 신분류 코드**를 쓴다.
   - 사용 금지: 구 `지역코드 조회`, 구 `서비스 분류코드 조회`
   - 코드상 근거: `SupportedRegion`(법정동 10자리), `PlaceCategories`(`lclsSystm1`/`lclsSystm2`)
4. **공사 것처럼 오인시키지 않는다. 다만 출처 표기는 필수다.**
   - 금지: 서비스명·로고·브랜딩에 "한국관광공사"·"KTO", 공사 공식 CI/BI **이미지**
   - **필수: `출처: ⓒ한국관광공사`** (텍스트만). `TourAPI`처럼 API 이름만 단독 표기는 지양
   - "실시간"이 아니라 **"예측"**이라는 말을 남긴다. 화면 문구는 `… 기준 예측 · 출처: ⓒ한국관광공사`
5. **사용자 GPS 위치를 서버로 전송하지 않는다.**
   지역·장소는 사용자가 직접 선택한다. 지도에 "현재 위치" 기능을 넣지 않는다.
   `[코드]` 검증: `frontend/src`에 `navigator.geolocation` 호출이 없다.

### 개발 규칙

- **백엔드 코드를 작성·수정하기 전에 무엇을 어떻게 바꿀지 먼저 설명하고 승인을 받는다.**
- 한 번에 큰 덩어리를 만들지 않는다. 기능 하나씩 쪼개 구현하고 매번 동작을 확인한다.
- 코드 작성 후 **무엇을 왜 그렇게 짰는지 설명**한다 (PT에서 개발자가 직접 설명해야 한다).
- 인증키·시크릿은 **환경변수**로 처리. 코드에 하드코딩하거나 커밋하지 않는다.
- 기능이 하나 동작할 때마다 커밋한다 (개발 이력 자체가 심사 자료).
- **테스트 코드는 요청할 때만 작성한다.** 단, 점수 계산 로직과 도메인 검증은 예외.

---

## 1. 프로젝트 개요

### 무엇을 하는 서비스인가

사용자가 직접 짠 여행 코스를 한국관광공사 예측 데이터로 **진단**해, 붐빌 것으로 예측되는
자리를 **더 한적한 날짜 또는 더 한적한 장소**로 바꾸도록 돕는다.

- **지정과제**: 2번 — 유명 관광지 쏠림으로 인한 오버투어리즘(과밀화)
- **개발 마감**: 2026-09-21 16:00 (실질 마감 9/20 — 마감일 배포 금지)
- **팀**: 2인 (개발 1, 데이터 분석 겸 PM 1)
- **목표**: 대상(문화체육관광부 장관상)

### 서비스 방향 — "피하는 여행이 아니라 발견하는 여행"

`[기획]` + `[코드]` — 화면 문구가 이 방향을 실제로 따른다.

과밀 회피 서비스는 자칫 **사용자에게 희생을 요구하는 서비스**가 된다("거긴 붐비니 가지
마세요"). PEAKOFF는 그 반대로 선다 — **정량 추천과 발견의 재미**로 분산을 유도한다.

| 원칙 | 코드/화면의 증거 |
|---|---|
| 핵심 명소를 배제하지 않는다 | TIME OFF는 **장소를 그대로 두고 날짜만** 옮긴다 (`DateAlternativeService`) |
| 대안은 "덜 나쁜 곳"이 아니라 "새로 발견한 곳" | 버튼 문구 `새로운 곳 발견하기`·`더 여유로운 날 발견하기` (`DiagnosisPage.tsx:607-608`), 네비 `코스 발견` (`Nav.tsx:131`) |
| 결과를 손실이 아니라 발견으로 말한다 | `새로운 여행지를 N곳 발견했어요!` (`ResultPage.tsx:610`) |
| 이미 잘 고른 사람에게 참견하지 않는다 | `TimeOffStatus.ALREADY_QUIET`, `PlaceOffStatus.ALREADY_QUIET` |
| 추천 이유를 사용자가 검증할 수 있다 | 추천도 구성 내역(항목·점수·반영 비율)을 화면에 편다 |
| 같은 곳으로 모두를 보내지 않는다 | 모든 추천이 가중/균등 무작위 (2차 오버투어리즘 방지) |

### 대상 지역 — 11곳

**목록의 원천은 `backend/.../place/domain/SupportedRegion.java` 한 곳이다.**
화면은 `GET /api/regions`로 받아 간다. 아래는 읽는 사람을 위한 것이지 정의가 아니다.

경주 · 제주시 · 서귀포시 · 여수 · 속초 · 태안 · 춘천 · 가평 · 충주 · 통영 · 남원
(시도마다 하나씩. 강원(속초·춘천)과 제주(제주시·서귀포시)만 둘)

⚠️ 공사가 자료를 주는 단위가 시군구라 제주도는 두 지역으로 갈려 있다
(한라산과 성산일출봉을 한 코스에 못 담는다).

**`[기획]` 지역을 더 넣을 때 통과해야 하는 세 조건** (`analysis/region-candidates/RESULTS.md`):
① 무작위 6칸 코스에서 붐빔 1칸 이상 나올 확률 35% 이상 ② 집중률 예측 40곳 이상
③ 자치구로 안 쪼개진 단일 시군구

---

## 2. 기술 구조

### 스택

| 층 | 기술 | 근거 파일 |
|---|---|---|
| 백엔드 | Java 21 · Spring Boot 4.1.0 · Gradle | `backend/build.gradle` |
| 영속 | Spring Data JPA · H2(개발, 파일) / PostgreSQL(배포) | `application.yaml` |
| 인증 | Spring Security · JJWT 0.12.6 · BCrypt | `global/config/SecurityConfig.java` |
| API 문서 | springdoc-openapi 2.8.6 → `/docs` | `application.yaml` |
| LLM | `com.google.genai:google-genai:1.70.0` (Gemini) | `external/llm/` |
| 프론트 | React 19 · TypeScript · Vite 8 · Tailwind 4 · react-router 8 | `frontend/package.json` |
| 린트 | oxlint | `frontend/package.json` |
| E2E | Playwright (CI 제외, 수동 실행) | `frontend/playwright.config.ts` |
| 분석 | Python / Jupyter (**검증용. 서비스에 붙지 않는다**) | `analysis/` |

**앱 개발 안 함. 웹만.** 모바일 우선 반응형(390px 기준).

### 실행 진입점

| 대상 | 진입점 |
|---|---|
| 백엔드 | `backend/src/main/java/com/peakoff/PeakoffApplication.java` (포트 8080) |
| 프론트 | `frontend/src/main.tsx` → `App.tsx` (Vite dev 포트 5173) |
| 프론트 라우팅 | `frontend/src/App.tsx` |

### 디렉터리

```
peakoff/
├── backend/src/main/java/com/peakoff/
│   ├── auth/          로그인·회원가입·JWT·소셜(카카오/네이버)
│   ├── chat/          지역 추천 챗봇 (도메인 판단은 전부 여기)
│   ├── congestion/    한적도·등급·날짜 대안(TIME OFF)·이번주 한적한 곳
│   ├── course/        코스 진단·설문 초안(FULL PEAKOFF)·저장 코스
│   ├── external/kto/  공사 OpenAPI 클라이언트·프로바이더·캐시·이름매칭
│   ├── external/llm/  Gemini 클라이언트 (의도 읽기 / 문장 쓰기)
│   ├── favorite/      장소 즐겨찾기
│   ├── global/        설정·에러·공통 응답·Scores/Texts
│   ├── member/        회원 엔티티
│   ├── place/         장소·분류·지역·거리
│   ├── recommendation/ 추천도·대안(PLACE OFF)·가중 무작위
│   └── trip/          여행 묶음(저장 코스를 담는 폴더)
├── frontend/src/{routes,components,hooks,services,state,types,utils}
├── analysis/          검증용 파이썬 (서비스는 읽지 않는다)
├── docs/              FACT-SHEET · OPEN_DECISIONS · 개발 블로그
├── deploy/            docker-compose (EC2)
└── .github/workflows/ ci.yml(빌드·테스트) · deploy.yml
```

### 데이터 흐름

```
브라우저
  └─ /api/*  (Vite 개발 프록시 → :8080 / 배포는 vercel.json rewrite)
        ↓
   Controller  (DTO 검증: jakarta.validation)
        ↓
   Service     (도메인 규칙 조합)
        ↓
   Domain      ← 점수·경계·가중치가 사는 곳 (Quietness, CongestionLevel,
        ↓        RecommendationScorer, AlternativeStandard, WeightedPicker)
   *Provider   (인터페이스: CongestionProvider / PlaceProvider /
        ↓       RecommendationProvider / QuietSpotProvider / RegionProfileProvider)
        ├─ Kto*Provider  ── KtoApiCaller ── 공사 OpenAPI   (peakoff.kto.*=real)
        └─ Mock*Provider ── GyeongjuMockCatalog            (peakoff.kto.*=mock)
```

**프로바이더 인터페이스가 목업/실데이터를 가른다.** 도메인은 어느 쪽인지 모른다.
스위치는 `peakoff.kto.congestion` / `.place` / `.recommendation` 세 개이고,
`@ConditionalOnProperty`가 빈을 고른다.

### 캐시 계층

| 캐시 | TTL | 위치 |
|---|---|---|
| 지역 카탈로그 (국문 관광정보) | 6h | `KtoPlaceClient.cache` (`RegionCache`) |
| 집중률 예측 | 6h | `KtoCongestionClient.cache` |
| 연관 관광지 | 6h | `KtoRelatedClient.cache` |
| 중심 관광지 | 6h | `KtoHubClient.cache` |
| 대표 관광지(해결된 Place) | 6h | `KtoPlaceProvider.representativesCache` |
| 장소 상세(`detailCommon2`) | 6h · 최대 1,000건 | `KtoPlaceClient.detailCache` |
| 장소 소개글 | 24h · 최대 1,000건 | `KtoPlaceClient.descriptionCache` |
| 연관 이름 → Place 색인 | 6h | `KtoRecommendationProvider.relatedIndex` |
| 관심사 비율(챗봇) | 6h | `KtoRegionProfileProvider.shareCache` |
| 실패 백오프 | 60s | `TtlCache.FAILURE_BACKOFF` |
| 최대 stale 허용 | 3일 | `TtlCache.MAX_STALE` |

⚠️ **완성된 추천 결과는 서버가 캐시하지 않는다.** 캐시는 원자료 층에만 있다.
`KtoCacheWarmer`가 기동 시 카탈로그를 데우고 5시간마다 카탈로그·집중률을 갱신한다.

---

## 3. 현재 실제 구현 기능

### 3.0 화면 · 라우트 `[코드: frontend/src/App.tsx]`

| 경로 | 컴포넌트 | 역할 |
|---|---|---|
| `/` | `HomePage` | 진입. 챗봇 · 이번 주 한적한 곳 · 다른 사람들의 여행 |
| `/plan` | `PlanPage` | 지역·날짜·박수 입력 |
| `/recommend` | `RecommendPage` | **FULL PEAKOFF** — 설문 2문항 → 코스 초안 |
| `/course` | `CoursePage` | 코스 편집 (검색·추가·삭제·순서 변경·지도) |
| `/diagnosis` | `DiagnosisPage` | 진단 + **TIME OFF** + **PLACE OFF** |
| `/result` | `ResultPage` | 원안 vs 개선안 비교 · 저장 |
| `/my` | `MyPage` | 저장 코스·여행 묶음·즐겨찾기·계정 |
| `/data` | `DataPage` | 데이터 활용 설명 페이지 (심사용) |
| `/s/:token` | `SharedCoursePage` | 공유 링크로 본 코스 (로그인 불필요) |
| `/login` `/signup` `/oauth/callback/:provider` | 인증 화면 | |

### 3.1 공통 기능

| 기능 | 상태 | 근거 |
|---|---|---|
| 지역 목록 | 구현 완료 | `GET /api/regions` ← `SupportedRegion` |
| 장소 키워드 검색 (지역 내부 한정) | 구현 완료 | `GET /api/places?region=&keyword=` → `RegionCatalog.search` |
| 검색 전 대표 관광지 칩 | 구현 완료 | keyword 비우면 중심 관광지 기반 `representatives` |
| 코스 편집 (일자별 추가·삭제·순서) | 구현 완료 | `CoursePage.tsx` |
| 순서 변경 — 드래그 | 구현 완료 | `hooks/useDragSort.ts` (위/아래 버튼에서 업그레이드됨) |
| 지도 (카카오맵) | 구현 완료 | `components/CourseMap.tsx` · `hooks/useKakaoSdk.ts` |
| 예측 가능 기간 안내 | 구현 완료 | `GET /api/dates/forecast-window` |
| 장소 상세(주소·소개글) | 구현 완료 | `GET /api/places/{id}/description` |
| 즐겨찾기 | 구현 완료 | `/api/favorites` (회원 전용) |
| 여행 묶음(코스를 담는 폴더) | 구현 완료 | `/api/trips` |
| 이번 주 한적한 곳 | 구현 완료 | `GET /api/places/quiet-week` → `QuietWeekService` |
| 다른 사람들의 여행 | 구현 완료 | `GET /api/courses/recent` (공개 + 진단된 코스만) |
| 코스 공유 링크 | 구현 완료 | `POST /api/courses/{id}/share` → `/s/{token}` |
| 지역 추천 챗봇 | 구현 완료 (LLM 없어도 동작) | `/api/chat/*` |
| 공사 호출 수 확인 | 구현 완료 | `GET /api/quotas` |

**`[기획]` + `[코드 검증됨]` 코스 편집 화면(2단계)에는 한적도를 노출하지 않는다.**
후보 목록의 배지도, 지도 마커 색도. 점수를 미리 보여주면 "직접 짠 코스"가 아니라
시스템이 유도한 코스가 되어 진단의 의미가 사라진다.
검증: `CoursePage.tsx`에 `CongestionBadge`·`quietness`·`level`이 **한 번도 등장하지 않는다.**

### 3.2 TIME OFF — 날짜 대안 `[구현 완료]`

**엔드포인트**: `GET /api/dates/alternatives?slot=1:{placeId}&slot=2:{placeId}&date=&range=`
**서비스**: `congestion/service/DateAlternativeService.java`
**화면**: `DiagnosisPage.tsx` (`DATE_SEARCH_RANGE = 3`)

| 감사 항목 | 실제 구현 |
|---|---|
| 기존 코스 기준 작동 | ✅ 코스의 모든 방문을 `일차:장소ID` 쌍으로 넘긴다 (`PlannedVisit.parse`) |
| 선택일 전후 3일 탐색 | ✅ 화면이 `range=3` 고정 → 창 7일. 서버는 1~14 허용, 기본 3 |
| 과거 날짜 제외 | ✅ **목록에는 담되** `selectable=false`. 추천 후보에서는 `bestOption`이 `selectable` 필터로 제외 |
| 여러 날 코스에서 실제 방문일 반영 | ✅ `PlannedVisit.dateFrom(start) = start + (day-1)`. 후보 시작일마다 다시 계산 |
| 같은 곳 두 번 방문 | ✅ 중복 제거하지 않고 각 날짜로 각각 계산 |
| 관광지별 점수 | 그 방문일의 한적도 (`CongestionProvider.quietnessOf`) |
| 코스 점수 | **진단 가능한 방문만의 산술 평균** — `Math.round((float) sum / visits.size())` |
| 진단 가능한 것만 분모 | ✅ `hasData(placeId)`로 먼저 걸러 `scorable` 목록을 만든 뒤 그것만 센다 |
| 혼잡 데이터 없는 장소 0점 처리 | ❌ 하지 않는다. 후보 날짜 중 하나라도 자료가 없으면 그 **날짜 전체를 `OptionalInt.empty()`** 로 만들고 `DATE_OUT_OF_FORECAST` 칸으로 표시 |
| 원 선택일 보존 | ✅ 창의 중심은 `state.baseline.plan.startDate`(**원안 날짜**)이지 현재 적용 날짜가 아니다 (`DiagnosisPage.tsx:189`) |
| 최소 개선폭 | **5점** — `DateAlternativeService.MIN_IMPROVEMENT = 5` (private). 응답에 `minImprovement`로 실려 나간다 |
| 이미 여유로우면 권하지 않음 | ✅ 선택일 평균이 `QUIET`(≥65)면 `ALREADY_QUIET` — 더 나은 날이 있어도 권하지 않는다 |
| 동점 처리 / 우선순위 | 개선폭 내림차순 → **선택일과 가까운 순** → 날짜 오름차순 (`bestOption`) |

**상태 5종** (`TimeOffStatus`, 순서가 곧 우선순위):

| 값 | 조건 | 문구 |
|---|---|---|
| `INSUFFICIENT_DATA` | 진단 가능한 장소가 없거나, 모든 후보 날짜가 계산 불가 | 날짜 정보를 충분히 불러오지 못했어요 |
| `ALREADY_QUIET` | 선택일 평균이 65 이상 | 지금 일정도 충분히 여유로워요 |
| `CURRENT_BEST` | 개선되는 날이 하나도 없음 | 선택한 날짜가 앞뒤 며칠 중 가장 한적해요 |
| `MARGINAL` | 최선 개선폭 < 5 | 날짜별 혼잡 차이가 크지 않아요 |
| `RECOMMENDED` | 최선 개선폭 ≥ 5 | 더 한적한 날짜가 있어요 |

**응답 필드**: `status` `statusMessage` `selectedDate` `selectedQuietness` `selectedLevel`
`selectedLevelLabel` `bestDate` `bestImprovement` `minImprovement` `options[]`
각 `option`: `date` `quietness` `level` `levelLabel` `improvement` `selectable` `gap` `gapMessage`

### 3.3 PLACE OFF — 장소 교체 추천 `[구현 완료]`

**엔드포인트**: `GET /api/places/{placeId}/alternatives?date=&limit=&exclude=`
**구현체(실데이터)**: `external/kto/provider/KtoRecommendationProvider.java`
**구현체(목업)**: `recommendation/mock/MockRecommendationProvider.java`
**화면**: `components/AlternativeSheet.tsx` (`ALTERNATIVE_COUNT = 3`)

#### 후보를 만드는 두 출처

```
① 연관 관광지 (RELATED)          ② 지역 카탈로그 (REGIONAL_FALLBACK)
   TarRlteTarService1              areaBasedList2로 받은 지역 전체
   기준 장소 이름으로 조회          기준 장소와 같은 지역
        │                                 │
        └──────── 같은 5개 문 통과 ────────┘
                        ↓
        출처마다 1자리 보장 + 남은 자리 경합 (가중 무작위)
```

**`[기획]` 두 출처를 함께 보되 자리를 나눈다** — 지역 후보가 연관 후보보다 5~6배 많아
그냥 섞으면 상위권을 쓸어간다. 품질이 아니라 표본 크기 문제라 가중치가 아니라 자리 보장으로 푼다.

#### 5개의 문 (점수 매기기 **전**)

`[코드]` `KtoRecommendationProvider.scoreCandidates` / `.scoreRegional` — 두 출처가 같은 순서

| # | 조건 | 구현 |
|---|---|---|
| 1 | 자기 자신 제외 | `candidate.id().equals(origin.id())` |
| 2 | 같은 후보 중복 제외 | 연관: `alreadyTaken` Set / 두 출처 사이: `relatedIds` 차집합 |
| 3 | 카테고리 호환 | `PlaceCategories.compatible(origin, candidate)` — **중분류까지 본다** |
| 4 | 거리 상한 | `AlternativeStandard.isWithinReach` — **15km 직선거리** |
| 5 | 그 날짜 예측 자료 존재 | `congestionProvider.hasData(id, date)` |
| 6 | (점수 후) 최소 개선폭 | `AlternativeStandard.isWorthSuggesting` — **+5점 이상** |
| 7 | (뽑기 전) 코스 중복 | `exclude` 파라미터로 넘어온 id 제외 |

| 감사 항목 | 실제 구현 |
|---|---|
| 원래 관광지 기준 | ✅ `Place origin`을 받아 그것과의 거리·개선폭을 잰다 |
| 동일 지역 내부만 | ✅ `regionOf(origin)`로 지역을 특정하고 그 지역의 카탈로그·연관만 본다 |
| 동일 관광지 코드 제외 | ✅ (문 1) |
| 현재 코스 장소 제외 | ✅ `exclude` 쿼리 파라미터 (최대 50개). 화면도 한 번 더 거른다 |
| 이름·좌표상 동일 장소 제외 | ⚠️ **직접 검사는 없다.** 콘텐츠 ID 중복만 막는다. 이름·좌표 중복은 카탈로그 자체의 중복에 달려 있다 → `[확인 필요]` |
| 음식점·카페·숙박 처리 | ✅ **후보에서 자동 제외** — 문 5(`hasData`)가 `isForecastTarget`으로 FD/AC를 미리 거른다 |
| 방문일 집중률 자료 있는 후보만 | ✅ (문 5) |
| 거리 = Haversine 직선거리 | ✅ `place/domain/Distances.betweenKm` (지구 반지름 6371km) |
| Kakao 길찾기 거리 사용 여부 | ❌ **쓰지 않는다.** Kakao SDK는 지도 표시·공유에만 |
| 이동수단별 거리 제한 | ❌ **미구현.** 이동수단 입력 자체가 없다. 15km 고정 |
| 후보가 1개일 때 | ✅ 그 하나만 돌려준다. `reserveOne`이 빈 pool을 건너뛴다 |
| 뽑은 뒤 점수순 재정렬 | ❌ **하지 않는다** (의도). 화면은 **구간 단위로만** 정렬 |

#### 추천도 계산 `[코드: recommendation/domain/RecommendationScorer.java]`

```
추천도 = round( (한적도 × 70 + 근접도 × 30) / 100 )      ← ScoreWeights.DEFAULT
근접도 = clamp(100 − 거리km × 5, 0, 100)                 ← PENALTY_PER_KM = 5.0
```

- 반영 비율은 `ScoreWeights`가 소유하고 **응답의 `factors[].weightPercent`로 내려간다.**
  화면에 문자열로 박지 않는다.
- `ScoreWeights` 생성자가 두 가지를 강제한다: **합이 100** · **한적도 비율 ≥ 근접도 비율**
- 항목은 **둘뿐**이다. 연관성·카테고리 적합성·인기도는 `ScoreFactor`로 넣지 않는다.

#### 가중 무작위 `[코드: recommendation/domain/WeightedPicker.java]`

```
DEFAULT_POOL_SIZE = 3      상위 3개만 Pool
DEFAULT_BIAS      = 1.2    weight = max(score, 1) ^ 1.2
```
Pool을 점수 내림차순으로 자른 뒤 그 안에서 확률 비례 추출. `pickEvenly`는 균등 추출.

**뽑는 순서** (`findAlternatives`):
1. 연관 후보 pool에서 1자리 보장 (`reserveOne`)
2. 지역 후보 pool에서 1자리 보장
3. 남은 자리는 두 출처를 합쳐 중복 없이 뽑기 (`drawWithoutRepeat`)
4. **재정렬하지 않는다.** 뽑힌 차례 그대로 나간다

#### 세션 고정 `[코드: frontend/src/services/alternativeCache.ts]`

- 키: `planKey(region|startDate|nights)` + `placeId|visitDate`
- `planKey`가 바뀌면 **캐시 전체를 비운다** (지역·날짜·박수 변경 = 조건 변경)
- 시트를 닫았다 열어도 같은 목록 → 되돌아갈 후보를 잃지 않는다
- 다시 뽑기: `handleRedraw()` → `forgetAlternatives()` + `redrawCount++` (사용자 명시 요청만)
- ⚠️ 메모리 전용. **새로고침하면 사라진다** → `[확인 필요]`

#### 상태 6종 (`PlaceOffStatus`, `Alternatives.decide` 순서대로)

| 값 | 조건 | 문구 |
|---|---|---|
| `RECOMMENDED` | 뽑힌 후보가 있다 | (null — 화면이 목록을 그린다) |
| `ALL_CANDIDATES_IN_COURSE` | 자격 있는 후보가 전부 코스에 담겨 있다 | 더 한적한 곳들이 이미 이 날 코스에 담겨 있어요. |
| `NO_VALID_CANDIDATE` | 점수를 매긴 후보가 0개 | 이 자리를 대신할 만한 곳을 찾지 못했어요. |
| `ALREADY_QUIET` | 원래 자리가 이미 한적(≥65) | 여기는 이미 한적한 편이에요.\n굳이 바꾸지 않아도 좋아요. |
| `NO_MEANINGFUL_IMPROVEMENT` | 후보는 있었지만 +5를 넘는 것이 없다 | 지금보다 눈에 띄게 한적한 곳을 찾지 못했어요. |
| `ORIGIN_NOT_FORECASTED` | 원래 자리에 그 날짜 자료가 없다 | 예상 혼잡을 알 수 없는 곳이라 추천 순서를 매기지 못해요. |

**불변식**: `RECOMMENDED`면 목록이 비지 않고, 그 외면 목록이 비어 있다 (`Alternatives` 생성자가 강제).

#### 추천 근거 문구 `[코드: recommendation/domain/CandidateSource.java]`

**서버가 만든다.** 후보 출처에 따라 갈린다:
- `RELATED` → `"{원래장소}에 다녀간 사람들이 함께 찾은 곳 중에서 골랐어요."`
- `REGIONAL_FALLBACK` → `"{원래장소} 근처의 비슷한 곳 중에서 골랐어요."`

⚠️ 지역 후보에게 "함께 많이 찾는 곳"이라 하면 **계산하지 않은 것을 근거로 말하는 것**이 된다.

#### 예측 없는 장소의 별도 경로

`GET /api/places/{placeId}/nearby?limit=` — **추천이 아니다.**
같은 대분류 + 반경 5km(`NearbyPlaces.DEFAULT_RADIUS_KM`) + 거리순. 점수도 날짜도 없다.
화면은 `originQuietness === null`일 때 이 경로로 간다 (`AlternativeSheet.nearbyMode`).
⚠️ **대안 추천과 엔드포인트를 합치지 말 것** — 점수 자리가 빈 응답은 "아직 점수가 안 온 추천"으로 읽힌다.

### 3.4 FULL PEAKOFF — 설문 기반 코스 생성 `[부분 구현]`

**엔드포인트**: `POST /api/courses/recommend`
**서비스**: `course/service/CourseDraftService.java`
**화면**: `routes/RecommendPage.tsx`

#### 입력

| 항목 | 상태 | 값 |
|---|---|---|
| 지역 | ✅ | `region` (슬러그) |
| 날짜 | ✅ | `startDate` |
| 여행 기간 | ✅ | `nights` (0~6) |
| 일정 밀도 | ✅ | `density`: `RELAXED` / `BALANCED` / `PACKED` |
| 혼잡 민감도 | ✅ | `sensitivity`: `POPULAR` / `MIXED` / `QUIET` |
| **선호 유형(여행 스타일)** | ❌ **미구현 (의도적으로 걷어냄, 2026-08-27)** | 하나만 고르면 후보가 제주시 3곳·서귀포 2곳으로 쪼그라들었다 |
| **이동수단** | ❌ **미구현 (의도적으로 걷어냄, 2026-08-27)** | 대중교통을 고르면 반경 8km 밖이 통째로 잘렸다 |

**`[기획]` 문항을 늘릴 때 지킬 것: 어느 답을 골라도 코스가 나와야 한다.**
고른 대가로 결과가 비는 문항은 선택지가 아니라 함정이다.
남은 두 문항은 후보를 거르지 않는다 — 밀도는 슬롯 수만, 민감도는 점수 비중과 하한만 바꾼다.

#### 후보 풀

```java
placeProvider.representatives(region, POOL_SIZE=100)   // ← 중심 관광지 API
  .filter(PlaceCategories::isCourseCandidate)          // FD·AC·EV·VE05·VE09·VE10 제외
  .filter(congestionProvider::hasData)                 // 집중률 예측 대상만
```

⚠️ **중요 — 문서/기획과의 차이**:
- `[기획]` 문서는 중심 관광지를 "코스 자동 생성의 **첫 장소 후보**"라고 적어 왔다.
- `[코드]` 실제로는 **하루의 모든 슬롯이 이 100곳 안에서 나온다.**
- `[코드]` **연관 관광지 API는 FULL PEAKOFF에서 전혀 쓰이지 않는다.**
  다음 장소 후보는 같은 100곳 풀에서 거리·분류·점수로 고른다.

#### 생성 순서

```
for day in 1..nights+1:
    target = random(density.min, density.max)         # 그날 채울 칸 수
    seed   = pickOne(풀 − used, 한적도만으로 채점)      # scoreAlone
    for order in 2..target:
        reachable = 풀 − used
                    ∩ 직전 장소에서 ≤ MAX_HOP_KM(15km)
                    ∩ 그날 첫 장소에서 ≤ DAY_RADIUS_KM(25km)
        후보 = reachable 중 직전과 대분류가 다른 것, 없으면 reachable 전부
        pickOne(후보, scoreAgainst(직전, 후보, 민감도 가중치))
```

| 감사 항목 | 실제 구현 |
|---|---|
| 첫 장소 채점 | `scoreAlone` = 한적도 100%(`ScoreWeights.QUIETNESS_ONLY`). 근접도 항목 자체를 만들지 않는다 |
| 이후 장소 채점 | `scoreAgainst(직전 장소, 후보, 민감도 가중치)` — 교체 추천과 **같은 `RecommendationScorer`** |
| 중복 장소 제외 | ✅ `used` Set (코스 전체에 걸쳐, 날이 달라도 재사용 안 함) |
| 일자별 배치 | ✅ `day`, `order` 부여. 슬롯 수는 밀도별 랜덤 |
| 이동거리 제한 | **2중**: 홉 15km(`MAX_HOP_KM`) + 그날 반경 25km(`DAY_RADIUS_KM`) |
| 같은 분류 연속 금지 | ✅ 단, 후보가 없으면 완화(같은 분류 허용) |
| 사용자 취향 반영 | 민감도만. 유형 선호는 없음 |
| 가중 무작위 위치 | 매 슬롯 선택마다 (`pickOne`) |
| 코스 점수 | `Course.of` → **진단된 슬롯 한적도의 평균**. 초안은 전부 진단되므로 항상 값이 있다 |
| 생성 실패 | 풀이 비면 `NotFoundException`, 슬롯 0개면 `NotFoundException` |
| 부분 완성 | ✅ 하루를 다 못 채우면 채운 만큼만. 하루가 통째로 비면 그 날은 빈 채로 넘어간다 |

#### 혼잡 민감도가 바꾸는 것 `[코드: course/domain/survey/CrowdSensitivity.java]`

| 값 | 라벨 | 가중치(한적:근접) | 붐빔 제외 | pickBias | Pool 크기 |
|---|---|---|---|---|---|
| `POPULAR` | 유명한 곳 위주 | 55 : 45 | 아니오 | 1.0 | `Integer.MAX_VALUE`(전부) |
| `MIXED` | 적당히 섞기 | 70 : 30 | 아니오 | 1.5 | 8 |
| `QUIET` | 한적한 곳 위주 | 85 : 15 | **예** (`CROWDED` 제외) | 2.0 | 5 |

⚠️ `QUIET`의 "붐빔 제외"는 `CongestionLevel.MODERATE_THRESHOLD(35)`를 본다.
**경계를 옮기면 이 필터 범위도 함께 움직인다.**

#### 일정 밀도 `[코드: ItineraryDensity]`

| 값 | 라벨 | 하루 슬롯 |
|---|---|---|
| `RELAXED` | 여유 | 2~3 |
| `BALANCED` | 적당 | 3~4 |
| `PACKED` | 알차게 | 4~5 |

#### 응답과 화면

`CourseDraftResponse`: `region` `regionName` `startDate` `endDate` `nights` `days`
`totalQuietness`(non-null) `totalLevel` `totalLevelLabel` `slots[]`
각 slot: `day` `order` `visitDate` `place` `quietness` `level` `levelLabel`
`recommendation` `factors[]` `reason`

`reason`은 서버가 만든다 — 첫 칸 `"하루를 시작하는 곳"`, 이후 `"{직전장소}에서 N.Nkm"`.

⚠️ **초안 응답에는 `totalPresentable` / `diagnosedCount` / `forecastTargetCount` / `levelCounts`가 없다.**
프론트 타입 `CourseDraft extends Omit<CourseDiagnosis,'slots'>`가 이 필드들을 선언하지만
런타임에는 `undefined`다. **현재 `RecommendPage`가 읽지 않아 무해하다** → `[확인 필요]`

### 3.5 코스 진단

**엔드포인트**: `POST /api/courses/diagnose` · **서비스**: `CourseDiagnosisService`

슬롯마다 `visitDate = startDate + (day-1)`로 한적도를 매기고, 못 매기면 이유를 붙인다:

| `DiagnosisGap` | 조건 | 화면 문구 |
|---|---|---|
| `PLACE_NOT_FORECASTED` | 예측 대상 분류인데 목록에 없음 (`announcesMissingForecast`=true) | 예상 혼잡 정보가 없는 장소예요 |
| `CATEGORY_NOT_FORECASTED` | 애초에 예측 대상 분류가 아님 (FD·AC·SH) | **null — 아무 말도 하지 않는다** |
| `DATE_OUT_OF_FORECAST` | 장소는 대상인데 날짜가 창 밖 | 아직 예측이 나오지 않은 날짜예요 |

⚠️ **자료 없음을 0점으로 채우지 않는다.** `CourseSlot`이 `quietness`와 `gap` 중 정확히
하나만 갖도록 생성자가 강제한다.

**요청에는 한적도를 담지 않는다.** 첫 코스는 사용자의 의도를 존중하고, 점수는 서버가 진단해서 돌려준다.

### 3.6 원안 vs 개선안 비교 `[구현 완료]`

`routes/ResultPage.tsx` — `state.baseline`(원안 plan+days)과 현재 plan+days를 **각각 진단**해 맞댄다.
- 원안은 **그때의 날짜로** 진단한다. 지금 날짜로 계산하면 날짜를 옮겨 얻은 개선이 원안에도 반영된다
- 양쪽 다 `totalPresentable`일 때만 숫자를 견준다
- 좁은 화면에서는 `transform` 기반 스와이프 + 스위치로 번갈아 본다 (스크롤 상자를 쓰지 않는다)
- 바꾼 것이 없으면 두 갈래로 말한다: 날짜만 옮겼으면 그렇게, 아무것도 안 했으면 "원안 그대로입니다"

### 3.7 저장·인증

**인증 3층** (`[코드]` 모두 구현 완료):
1. 게스트 — 로그인 없이 편집·진단·교체까지 전부
2. 이메일/비밀번호 + JWT (`peakoff.jwt.validity: 7d`, BCrypt)
3. 소셜 로그인 — **카카오·네이버 모두 구현됨** (`auth/oauth/`)

**저장 코스** (`SavedCourse`):
- 저장하는 것: 이름 · 지역 · 시작일 · 박수 · 장소(일차·순서·id·이름) · **점수 스냅샷**
  (`totalQuietness` `diagnosedCount` `forecastTargetCount` `scoredAt`) · `publicCourse` · `shareToken`
- `totalQuietness`는 **nullable**. null이면 `scoredAt`도 null (매긴 적 없는데 시각만 남기면 거짓말)
- **총점이 없어도 저장을 막지 않는다** — 저장은 재료를 남기는 일이다 (`ResultPage.tsx:1515`)
- 회원당 최대 50개(`MAX_PER_MEMBER`). 이름 최대 30자
- 불러올 때 스냅샷을 먼저 보여주고, "다시 진단하기"를 눌러야 재계산

**남의 코스 공개 범위** (`GET /api/courses/recent`):
- 나가는 것: 닉네임 · 지역 · 기간 · 총점 · 등급 · **담긴 장소 전부**(`placeId` 포함)
- 나가지 않는 것: **코스 id** · **코스 이름** · 저장한 사람의 계정 정보
- 거르기: `isPublic == true` **AND** `totalQuietness != null` — 둘 다 `limit` **앞**에서 판정
- 기본값 비공개(`isPublic`이 null이면 `false`) — 고른 적 없는 옛 코스는 비공개로 읽는다

⚠️ **문서 불일치**: `CLAUDE.md`의 이전 판과 `SavedCourseController` Javadoc이 "이름 공개"에
대해 서로 다르게 적혀 있었다. **현재 코드 기준: `PublicCourseSummary`에 `name` 필드가 없다
= 이름은 나가지 않는다.** 공개 토글이 정하는 것은 "목록에 나갈지 말지"이고 닉네임은 함께 나간다.

### 3.8 지역 추천 챗봇 `[구현 완료 · LLM 없어도 동작]`

```
LLM ①  질문 → 관심사 · 기간조각      (GeminiIntentReader)
서버    그것으로 지역과 날짜를 정한다   ← 판단은 전부 여기 (RegionChatPicker)
LLM ②  우리가 준 값 → 문장            (GeminiCardLineWriter)
```

⚠️ **LLM이 지역을 고르게 하지 않는다.** 응답 스키마에 지역 칸을 만들지 않는 것으로 막는다.
관심사는 자유 문자열이 아니라 `Interest` enum 9개(FOOD·WATER·NATURE·HISTORY·CULTURE·
LEISURE·EXPERIENCE·SHOPPING·NONE).

⚠️ **LLM에게 날짜 산수를 시키지 않는다.** 모델은 `WEEK·3·WEEKEND` 같은 조각만 읽고,
달력은 `AskedPeriod`가 본다.

**지역 고르기** (`RegionChatPicker.pick`):
1. 거르기 — 관심사 비율이 **중앙값 이상**인 지역만 (`filtersRegions()`가 true일 때만)
2. 자르기 — 한적한 순 **위쪽 절반**, 최소 4곳(`MIN_POOL`)
3. 뽑기 — 그 통에서 **균등 무작위** 2장(`CARD_COUNT`)
4. 표시 순서만 `quietShare` 내림차순

**카드 숫자** = 그 기간의 (장소 × 날짜) 관측 중 **한적(≥65)인 관측의 비율**
(`KtoRegionProfileProvider.windowOf`). 지역 평균 한적도가 아니다.
`forecastSize`는 그 창에 자료가 있던 **장소 수**다.

**문구 갈림** (`RegionProfile.MANY_QUIET_SHARE = 40`):
- 40% 이상 → "한적한 곳이 많은 편이에요" / 40% 미만 → "덜 붐비는 편이에요"
- 그 기간 **전 지역**이 40% 미만 → `crowdedPeriod=true` → "어디나 붐빌 것 같아요"

**LLM 문장 검증** (`RegionCards.isUsable`) — 통과 못 하면 템플릿이 그 자리를 지킨다:
40자 이하 · **숫자 금지** · 다른 지역 이름 금지 · 금칙어
(`지금 현재 실시간 오늘 요즘 이번 주 이번주 이번 달 이번달 방문객 관광객 인파 유명`)

**상태 4종**: `OK` / `OFF_TOPIC` / `TOO_FAR`(창 밖 기간) / `UNAVAILABLE`
**호출 제한**: `CallLimiter`(키당) + `DailyBudget`(하루 600, `LlmProperties.DEFAULT_DAILY_LIMIT`)
인증키가 없거나 상한에 닿으면 오류가 아니라 **설문으로 안내**한다.

### 3.9 이번 주 한적한 곳 `[구현 완료]`

`GET /api/places/quiet-week?limit=` → `QuietWeekService`

```
FORECAST_DAYS = 7        오늘부터 7일
TOP_SHARE     = 0.35     지역별 한적한 순 상위 35%
MIN_CANDIDATES = 5       작은 지역이 조여지지 않게 하는 바닥
MAX_RESOLVE_ATTEMPTS = 12
```

1. 지역마다: 상위 35% 후보 → **`QUIET` 등급만 남김** → **균등 무작위**로 하나 뽑기
   → 그 하나만 우리 장소로 잇기(`resolve`). 못 이으면 그것만 빼고 다시 뽑기 (최대 12회)
2. 지역 대표들 중에서 다시 **균등 무작위**로 `limit`개

⚠️ **비율이지 개수가 아니다.** 예측 대상이 지역마다 69~244곳이라 개수로 자르면 큰 지역일수록 좁게 본다.
⚠️ **등급 필터를 비율 뒤에 한 겹 더 둔다.** "상위 35%가 전부 한적"은 실측의 사실이지 구조의 보장이 아니다.
⚠️ **이름 상태로 먼저 뽑고 뽑힌 하나만 잇는다.** 넓게 보는 층과 비싼 층을 가른 결과 응답이 오히려 빨라졌다.

---

## 4. 핵심 계산식과 정책값

**모든 값을 2026-09-12에 코드에서 다시 확인했다.**

### 4.1 집중률 → 한적도

| 항목 | 값 | 위치 | 성격 |
|---|---|---|---|
| API 원본 필드 | `cnctrRate` (문자열 → `Double.parseDouble`) | `KtoCongestionClient.fetch` | 공사 제공 |
| 원본 의미 | **0~100, 높을수록 붐빔** | — | 공사 제공 |
| 변환식 | `한적도 = clamp(100 − 집중률, 0, 100)` 후 `Math.round` → `int` | **`congestion/domain/Quietness.of`** — **한 곳뿐** | 확정 |
| 재정규화 | **없음** | — | 확정 |
| 반올림 시점 | **변환 시점**(도메인 진입). 화면은 정수를 그대로 표시 | `Quietness.of` | 확정 |
| 상·하한 | `Scores.MIN = 0` / `Scores.MAX = 100` | `global/support/Scores` | 공통 상수 |

### 4.2 등급 경계 — **3단계 (구현된 것)**

| 항목 | 값 | 위치 |
|---|---|---|
| `QUIET_THRESHOLD` | **65** (이상이면 한적) | `congestion/domain/CongestionLevel` |
| `MODERATE_THRESHOLD` | **35** (이상 65 미만이면 보통) | 같은 파일 |
| 붐빔 | 35 미만 | 같은 파일 |
| 라벨 | `한적` / `보통` / `붐빔` | `CongestionLevel.label()` |
| 근거 문구 | `예상 혼잡 낮음` / `예상 혼잡 보통` / `예상 혼잡 다소 높음` | `congestionPhrase()` |

**판정은 `CongestionLevel.fromQuietness(int)` 한 곳에서만 한다.**
프론트에는 경계 숫자를 비교하는 코드가 **없다** — 서버가 준 `level` 문자열로만 색과 배지를 고른다.

**`[논의된 변경안 · 미구현]` 5단계 안**
`0~34 붐빔 / 35~44 다소 붐빔 / 45~64 보통 / 65~74 비교적 한적 / 75~100 한적`
→ **코드에 존재하지 않는다.** `CongestionLevel`은 값이 3개뿐이고, 프론트 타입
`CongestionLevel = 'CROWDED' | 'MODERATE' | 'QUIET'`도 3개다.
적용하려면 최소한 이 여섯 곳이 함께 움직인다:
`CongestionLevel` · `CrowdSensitivity.allows` · `levelStyles.ts`(5색 팔레트 필요) ·
`CongestionBadge` · `CourseDiagnosisResponse.LevelCounts` · `QuietWeekService`의 QUIET 필터
· `RegionProfileProvider.windowOf`의 65 기준.

**경계 이동 시 함께 움직이는 것** — 잊으면 조용히 어긋난다:
- `CrowdSensitivity.QUIET`의 "붐비는 곳 제외" 범위 (35를 본다)
- `QuietWeekService`의 QUIET 등급 필터 (65를 본다)
- `KtoRegionProfileProvider.windowOf`의 챗봇 카드 비율 (65를 본다)
- `Alternatives.decide`의 `ALREADY_QUIET` 판정 (65를 본다)
- `DateAlternativeService.decide`의 `ALREADY_QUIET` 판정 (65를 본다)

### 4.3 개선량 하한

| 기능 | 상수 | 값 | 위치 | 비고 |
|---|---|---|---|---|
| PLACE OFF | `MIN_QUIETNESS_GAIN` | **5** | `recommendation/domain/AlternativeStandard` | 응답에 `minQuietnessGain`으로 노출 |
| TIME OFF | `MIN_IMPROVEMENT` | **5** | `congestion/service/DateAlternativeService` (private) | ⚠️ 코드 주석에 **"분석 검증 전 임시값"**. 응답에 `minImprovement`로 노출 |

⚠️ **값은 같지만 일부러 다른 상수다.** 날짜를 옮기는 것은 숙소·교통까지 딸린 큰 결정이고
장소 하나를 바꾸는 것은 가볍다 — 실행 비용이 다르니 언제든 갈릴 값이다.

### 4.4 거리

| 항목 | 값 | 위치 | 성격 |
|---|---|---|---|
| 계산 방식 | **Haversine 직선거리**, 지구 반지름 6371.0km | `place/domain/Distances.betweenKm` | 확정 |
| PLACE OFF 상한 | **15.0 km** | `AlternativeStandard.MAX_DISTANCE_KM` | 확정 |
| 근접도 감점 | **1km당 5점** → `clamp(100 − km×5, 0, 100)` | `RecommendationScorer.PENALTY_PER_KM` | ⚠️ **임시값** (코드 주석) |
| FULL 홉 상한 | **15.0 km** (직전 장소 → 다음 장소) | `CourseDraftService.MAX_HOP_KM` | ⚠️ **임시값** (근거는 아래와 같음) |
| FULL 하루 반경 | **25.0 km** (그날 첫 장소 기준) | `CourseDraftService.DAY_RADIUS_KM` | ⚠️ **임시값** (이동수단 문항을 걷어내며 넓은 쪽을 남김) |
| nearby 반경 | **5.0 km** | `NearbyPlaces.DEFAULT_RADIUS_KM` | ⚠️ **임시값** (코드 주석) |
| 이름 매칭 안전거리 | **2.0 km** | `KtoCongestionProvider.MAX_LINK_DISTANCE_KM` | 확정 |
| 이동수단별 차등 | **없음** | — | 미구현 |

### 4.5 추천 점수와 가중치

| 항목 | 값 | 위치 |
|---|---|---|
| 기본 가중치 | 한적도 **70** : 근접도 **30** | `ScoreWeights.DEFAULT` — ⚠️ 코드 주석에 **"분석 검증 전 임시값"** |
| 한적도 단독 | **100 : 0** | `ScoreWeights.QUIETNESS_ONLY` (FULL의 첫 슬롯) |
| 민감도별 | 55:45 / 70:30 / 85:15 | `CrowdSensitivity` — ⚠️ 코드 주석에 **"분석 검증 전 임시값"** |
| 불변식 | 합=100 **AND** 한적도 ≥ 근접도 | `ScoreWeights` 생성자 |
| 합산 | `round(Σ(score × weightPercent) / 100)` | `RecommendationScorer.weightedScore` |

⚠️ **추천도는 100점 만점이 아니다.** 실측 분포 25~80, 중앙 53. 화면은 숫자를 구간 문구로 옮긴다.

### 4.6 후보 제한 · 랜덤 · 세션

| 항목 | 값 | 위치 |
|---|---|---|
| PLACE OFF Pool 크기 | **3** | `WeightedPicker.DEFAULT_POOL_SIZE` |
| PLACE OFF 가중 지수 | **1.2** | `WeightedPicker.DEFAULT_BIAS` |
| 화면 요청 개수 | **3** (= Pool 크기) | `AlternativeSheet.ALTERNATIVE_COUNT` |
| 서버 기본 limit | 5 (최대 20) | `PlaceController.DEFAULT_ALTERNATIVE_LIMIT` |
| FULL Pool·bias | 민감도별 (∞/8/5 · 1.0/1.5/2.0) | `CrowdSensitivity` |
| FULL 후보 풀 | **100** | `CourseDraftService.POOL_SIZE` |
| 챗봇 카드 수 / 최소 통 | **2** / **4** | `RegionChatPicker.CARD_COUNT` / `MIN_POOL` |
| 이번주 상위 비율 / 최소 | **0.35** / **5** | `QuietWeekService.TOP_SHARE` / `MIN_CANDIDATES` |
| 난수원 | `ThreadLocalRandom` 래퍼 — **시드 고정 없음** | `global/config/RandomConfig` |
| 세션 고정 | 메모리 Map, `planKey` 변경 시 전체 비움 | `services/alternativeCache.ts` |
| 교체 근거 보존 | `sessionStorage`, 최대 60건 | `services/swapEvidence.ts` |

⚠️ **화면이 Pool 크기(3)만큼만 요청한다.** 8개를 요청하면 "다 가져가라"와 같아 Pool이 무의미해진다.
⚠️ **뽑은 뒤 점수순으로 다시 정렬하지 않는다.** 정렬은 화면의 **구간 단위**까지만.

### 4.7 화면의 추천도 구간

| 상수 | 값 | 문구 | 위치 |
|---|---|---|---|
| `TIER_GOOD_MIN` | **64** | `✨ 이날 가기 좋아요` | `AlternativeSheet.tsx:150` |
| `TIER_FAIR_MIN` | **46** | `이런 곳도 있어요` | `AlternativeSheet.tsx:151` |
| 그 아래 | — | **문구 없음** (깎아내리지 않는다) | — |

경계는 임의의 70/50이 아니라 **실측 추천도 분포의 1·3분위수**(150건, 2026-08-29).
`[확인 필요]` 이 두 값은 **프론트에만 있다.** 서버가 내려주지 않으므로
가중치가 바뀌면 이 경계도 따로 갱신해야 한다.

### 4.8 코스 총점과 진단률

| 항목 | 값 | 위치 |
|---|---|---|
| 총점 = | **진단된 슬롯 한적도의 산술 평균** (반올림). 추천도가 섞이지 않는다 | `Course.averageQuietness` |
| 진단 없으면 | **`null`** (0으로 채우지 않는다) | 같은 곳 |
| `diagnosedCount` | 한적도가 매겨진 슬롯 수 | `Course.diagnosedCount()` |
| `forecastTargetCount` | 진단됐거나 `gap != CATEGORY_NOT_FORECASTED`인 슬롯 수 | `Course.forecastTargetCount()` |
| 숫자 표시 조건 | `diagnosed ≥ 2` **AND** `diagnosed / forecastTarget ≥ 0.50` | `CourseScoreStandard` |
| 미충족 시 | `totalPresentable=false` → 화면이 **등급 요약**을 편다 (`levelCounts`) | `CourseDiagnosisResponse.LevelCounts` |
| 충족 시 | 모수를 함께 적는다 — "관광지 N곳 중 M곳의 예측자료 기준" | 화면 |

⚠️ **이 조건을 저장과 묶지 않는다.** 묶으면 경주 코스의 41.7%가 저장 불가가 된다.
⚠️ `"전체 코스 혼잡도"`라는 명칭은 쓰지 않는다.

### 4.9 그 밖의 정책값

| 항목 | 값 | 위치 |
|---|---|---|
| 박 수 상한 | 6박 | `CourseDiagnosisRequest` · `CourseRecommendRequest` · `SaveCourseRequest` |
| 코스 장소 상한 | 50곳 | 같은 DTO들 |
| `exclude` 상한 | 50곳 | `PlaceController` |
| TIME OFF range | 1~14, 기본 3 | `DateAlternativeController` |
| 검색 limit | 기본 20, 최대 100 | `PlaceController.DEFAULT_SEARCH_LIMIT` |
| 저장 코스 상한 | 50개 / 회원 | `SavedCourse.MAX_PER_MEMBER` |
| 코스 이름 | 30자 | `SavedCourse.NAME_MAX_LENGTH` |
| 공유 토큰 | 62진 16자, `SecureRandom` | `SavedCourseService` |
| JWT 유효기간 | 7일 | `application.yaml` |
| 서버 시계 | `Asia/Seoul` 고정 | `global/config/TimeConfig` |

---

## 5. API 및 데이터 매핑

### 5.1 활용 공사 OpenAPI

| 데이터 | 경로 (`https://apis.data.go.kr/…`) | 호출 파일 | 상태 |
|---|---|---|---|
| 국문 관광정보 (지역 목록) | `/B551011/KorService2/areaBasedList2` | `KtoPlaceClient.fetchCatalog` | 사용 |
| 국문 관광정보 (상세·소개글) | `/B551011/KorService2/detailCommon2` | `KtoPlaceClient.detailItem` | 사용 |
| 집중률 예측 | `/B551011/TatsCnctrRateService/tatsCnctrRatedList` | `KtoCongestionClient.fetch` | 사용 |
| 연관 관광지 | `/B551011/TarRlteTarService1/areaBasedList1` | `KtoRelatedClient.fetch` | 사용 |
| 중심 관광지 | `/B551011/LocgoHubTarService1/areaBasedList1` | `KtoHubClient.fetch` | 사용 |
| 지역별 방문자수 빅데이터 | — | — | **현재 미사용** |

**공통 파라미터** (`KtoApiCaller.uriOf`): `serviceKey` · `MobileOS=ETC` · `MobileApp=PEAKOFF` · `_type=json`

> **"현재 미사용"은 지우지 않고 남긴다.** 계산에 넣지 않은 데이터를 근거로 말할 수는 없으므로
> 화면과 기능설명서에서는 빼되, 나중에 붙일 자리로 표에는 남겨 둔다.

#### ① 집중률 예측 — `TatsCnctrRateService/tatsCnctrRatedList`

| | |
|---|---|
| 요청 | `areaCd`(법정동 앞 2자리) · `signguCd`(앞 5자리) · `numOfRows=10000` · `pageNo=1` |
| 사용 응답 필드 | `tAtsNm`(관광지명) · `baseYmd`(yyyyMMdd) · `cnctrRate`(0~100 실수) · `totalCount` |
| 쓰는 기능 | **전 기능** — 진단 · TIME OFF · PLACE OFF · FULL PEAKOFF · 홈 · 챗봇 |
| 캐시 | 6h, 빈 응답이 옛 값을 밀어내지 못함(`usable` 술어) |
| 실패 처리 | `KtoApiException` → 옛 값(≤3일)으로 응답, 없으면 예외 전파 → `EXTERNAL_UNAVAILABLE`(503) |
| 빈 응답 | `RegionForecast.empty()` + WARN 로그. 캐시에는 반영 안 함 |
| 예측 마지막 날 | 응답에서 읽는다(`RegionForecast.lastDate`). **상수로 박지 않는다** |
| 매칭 | **관광지명 문자열만.** 콘텐츠 ID가 없다 → 이름 매칭 (5.3 참조) |
| 페이징 | ❌ **없다.** `totalCount > 10,000`이면 WARN만 남긴다 → `[확인 필요]` |

⚠️ **예측 범위는 조회 시점부터 앞으로 24~30일이고 과거 날짜는 없다. 길이가 고정이 아니다.**
⚠️ **창 밖 날짜를 막지 않는다.** 여행은 원래 미리 계획한다. 진단은 200으로 뜨고 그 칸이
`DATE_OUT_OF_FORECAST`가 된다. 색도 경고(붐빔)가 아니라 보통(앰버)이다.
⚠️ **같은 날짜의 예측값도 갱신되면서 바뀐다.** 저장 코스에 스냅샷을 남기고 열 때마다 재계산하지 않는 이유.

#### ② 국문 관광정보 — `KorService2/areaBasedList2`

| | |
|---|---|
| 요청 | `lDongRegnCd`(관광정보 법정동 앞 2자리) · `lDongSignguCd`(3~5자리) · `arrange=A` · `numOfRows=5000` |
| 사용 응답 필드 | `contentid` · `title` · `mapx`(경도) · `mapy`(위도) · `lclsSystm1`(대분류) · `lclsSystm2`(중분류) · `firstimage` |
| 쓰는 기능 | 검색 · 코스 편집 · PLACE OFF 지역 후보 · 이름 매칭 · 챗봇 관심사 비율 |
| 캐시 | 6h (`RegionCache`), 빈 응답 방어 |
| 버리는 행 | id/제목 없음 · 좌표 파싱 실패 · **한국 범위 밖**(위도 33.0~38.7, 경도 124.5~132.0) · 분류 없음 |
| 페이징 | ❌ 없다. `totalCount > 5,000`이면 WARN → `[확인 필요]` |

⚠️ **`mapx`가 경도, `mapy`가 위도다.** `toPlace`가 이 순서를 명시적으로 뒤집어 담는다.
⚠️ **좌표는 공사 값만 쓰고 보완하지 않는다.** 틀린 좌표는 없는 것보다 나쁘다.
⚠️ **화면이 검색으로 찾는 것과 서버가 지역을 통째로 받는 것은 다른 이야기다.**
서버는 지역 카탈로그를 한 번 받아 6시간 캐시하고, 검색은 그 위에서 돈다(`RegionCatalog.search` — 공백 제거 + 소문자 부분일치).

#### ③ 연관 관광지 — `TarRlteTarService1/areaBasedList1`

| | |
|---|---|
| 요청 | `baseYm=202504` **(하드코딩)** · `areaCd` · `signguCd` · `numOfRows=20000` |
| 사용 응답 필드 | `tAtsNm`(기준) · `rlteTatsNm`(연관) · `rlteRank`(순위) · `rlteSignguCd`(같은 시군구만 남김) |
| 쓰는 기능 | **PLACE OFF 후보 생성만** |
| 캐시 | 6h |
| 역할 | **후보를 만드는 출발점 + 인기도 하한.** 점수 항목이 아니다 |

⚠️ **연관 순위를 점수로 쓰지 않는다** (2026-08-31 실측). 연관 순위와 한적도가 **음의 상관**
(6개 지역 26,819쌍, 켄달 타우 **−0.073**, 6곳 중 5곳 음수). 가점을 주면
"더 붐비는 곳을 더 밀어라"가 되어 과제와 정면으로 어긋난다.

#### ④ 중심 관광지 — `LocgoHubTarService1/areaBasedList1`

| | |
|---|---|
| 요청 | `baseYm=202504` **(하드코딩)** · `areaCd` · `signguCd` · `numOfRows=500` |
| 사용 응답 필드 | `hubTatsNm` · `hubRank`(정렬) |
| 쓰는 기능 | 검색 전 대표 관광지 칩 · **FULL PEAKOFF 후보 풀(100곳 전체)** |
| 캐시 | 6h (이름) + 6h (해결된 Place) |

⚠️ **대표 목록의 순서는 인기 순이지 추천 순이 아니다.** 인기 장소는 붐비는 장소이므로 추천 점수에 쓰지 않는다.

### 5.2 그 밖의 외부 의존

| 대상 | 용도 | 위치 | 혼잡도 데이터로 쓰는가 |
|---|---|---|---|
| **Kakao 지도 SDK** (`dapi.kakao.com/v2/maps/sdk.js`) | 지도 표시만 | `hooks/useKakaoSdk.ts` | ❌ |
| **Kakao 공유 SDK** | 코스 공유하기 | `hooks/useKakaoShare.ts` | ❌ |
| **Kakao Local API** | — | **사용하지 않는다** | — |
| **Kakao 길찾기 API** | — | **사용하지 않는다** | — |
| **Kakao / Naver OAuth** | 소셜 로그인 | `auth/oauth/` | ❌ |
| **Google Gemini** | 챗봇 질문 읽기·문장 쓰기만. 지역은 안 고른다 | `external/llm/` | ❌ (꺼져도 서비스는 돈다) |

**Kakao Local을 혼잡도로 쓰지 않는다는 방향은 코드와 일치한다.** 좌표·주소는 전부 공사 값이다.

### 5.3 관광지 매칭 `[코드: external/kto/support/PlaceNameMatcher.java]`

집중률 API는 **관광지명 문자열(`tAtsNm`)만** 준다. 콘텐츠 ID가 없어 이름으로 이을 수밖에 없다.
`"경주 불국사 [유네스코 세계유산]"` 같은 값이 온다.

**정규화** (`normalize`): 쉼표 뒤 절단 → `[...]` 제거 → `(...)` 제거 → `/`·`·` → 공백
→ 공백 전부 제거 + 소문자 → 지역어(예: `경주`) 접두/접미 1회 제거

**매칭 4단계** — 위에서부터, 각 단계마다 `onlyOne`(정확히 1개일 때만 확정):
1. **원문 그대로** 같은가 (`rawKey`: 공백 제거 + 소문자)
2. **수동 연결표** (`MANUAL_LINKS`, 16쌍 — `양남주상절리`→`경주 양남 주상절리 전망대` 등)
3. **정규화 변형 교집합** (전체형 / 지역어 제거형 두 벌)
4. **포함 매칭** + `plausible` 술어 통과

**오매칭 방어**:
- ⚠️ **여러 후보가 나오면 확정하지 않는다** (`onlyOne`이 `Optional.empty()`). 이번 연동의 최대 위험
- ⚠️ **쇼핑(SH)은 포함 매칭 자체를 막는다** (`requiresExactNameMatch`) —
  `"다이소 경복궁역점" → "경복궁"`은 좌표 검사로도 못 막는다
- ⚠️ **포함 매칭에는 2km 좌표 검사**를 건다 (`couldBeSamePlace`) — 같은 이름의 다른 장소를 막는다
- 지역어 제거형은 **2자 이상**일 때만 변형으로 쓴다 (`MIN_STRIPPED_LENGTH`)

### 5.4 분류 체계 `[코드: place/domain/PlaceCategories.java]`

**신분류 코드**를 쓴다. 대분류 `lclsSystm1`, 중분류 `lclsSystm2`.

| 코드 | 라벨 | 예측 대상 | 자료 없음 안내 | 코스 후보 |
|---|---|---|---|---|
| HS | 역사·유적 | ✅ | ✅ | ✅ |
| NA | 자연·풍경 | ✅ | ✅ | ✅ |
| VE | 문화·명소 | ✅ | ✅ | ✅ (VE05·VE09·VE10 제외) |
| LS | 레저·스포츠 | ✅ | ✅ | ✅ |
| EX | 체험 | ✅ | ✅ | ✅ |
| EV | 축제·행사 | ✅ | ✅ | ❌ |
| SH | 쇼핑 | ✅ (시장만) | ❌ | ✅ |
| FD | 음식점 | ❌ | ❌ | ❌ |
| AC | 숙박 | ❌ | ❌ | ❌ |
| C01 | 여행코스 | ❌ | ❌ | ✅ |

**교체 호환 규칙** (`compatible`, **양방향**):
- HS ↔ HS · VE 중 `VE07`(박물관) `VE06` `VE12`
- NA ↔ NA · VE 중 `VE01`(전망대) `VE03`(공원)
- VE → VE 전부 (단 `VE05` 리조트 · `VE09` 도서관 · `VE10` 수련관은 대상에서 제외)
- 그 밖은 같은 대분류끼리만

⚠️ **대분류만 보면 `VE`가 박물관·워터파크·리조트를 한데 묶어 황리단길 자리에 리조트가 올라온다.**
⚠️ **양방향으로 맞춘다** — 한쪽만 열면 같은 두 장소가 어느 쪽을 누르느냐에 따라 다른 답을 준다.

### 5.5 데이터 누락 · 예외 처리 요약

| 상황 | 처리 | 위치 |
|---|---|---|
| 인증키 없음 | `KtoApiException` — 어디를 확인할지 알려주는 메시지 | `KtoApiCaller.body` |
| 인증 실패 (`OpenAPI_ServiceResponse`) | 활용신청 안내를 담은 예외 | `failIfAuthError` |
| `resultCode != "0000"` | 예외 | `body` / `failIfParameterError` |
| 네트워크 실패 / 타임아웃 | 연결 3s · 읽기 8s → `KtoApiException` | `KtoApiCaller` |
| 응답이 JSON이 아님 | 앞 200자를 담아 예외 | `readTree` |
| 200 + 0건 | `empty()` 반환 + WARN, **캐시 갱신 안 함** | `RegionCache(usable)` |
| 호출 실패 직후 재요청 | 60초 백오프 — 옛 값(≤3일) 반환 | `TtlCache.FAILURE_BACKOFF` |
| 옛 값이 3일 초과 | 예외 전파 | `TtlCache.MAX_STALE` |
| 파싱 불가 행 | 건너뛰고 건수만 WARN | `KtoCongestionClient` · `KtoPlaceClient` |
| 좌표 없음/범위 밖 | 그 장소를 **버린다** | `KtoPlaceClient.toPlace` |
| 예측 없는 장소 | `hasData=false` → `DiagnosisGap` / 후보에서 제외 | 전역 |
| 예측 없는 날짜 | `hasData(id,date)=false` → `DATE_OUT_OF_FORECAST` | 전역 |
| 이름 매칭 실패 | 그 장소는 예측 없는 것으로 취급 | `KtoCongestionProvider.locate` |
| 카탈로그에 없는 장소 조회 | `detailCommon2`로 단건 조회, 실패 시 `empty()` | `KtoPlaceProvider.findById` |
| 챗봇 LLM 불가 | 오류가 아니라 설문 안내 / 템플릿 문장 | `RegionChatService` |
| 지역 프로필 수집 중 실패 | 그 지점에서 멈추고 모은 것까지만 | `KtoRegionProfileProvider.profiles` |
| 서버 예외 → HTTP | `ErrorCode` 7종 매핑 | `GlobalExceptionHandler` |

**전역 응답 포맷**: `{ success, data }` 또는 `{ success:false, error:{ code, message, fields? } }`

---

## 6. 사용자 화면과 문구

### 6.1 화면에 실제로 노출되는 숫자

| 숫자 | 노출 위치 | 계산 주체 |
|---|---|---|
| 한적도 (0~100) | 진단 타임라인 배지 · 대안 카드 배지 · 홈 한적한 곳 · 저장 코스 카드 | **서버** |
| 등급 배지 (한적/보통/붐빔) | 위와 같은 자리 | **서버**(`level` + `levelLabel`) |
| 코스 총점 | 진단 화면 · 결과 화면 (단, `totalPresentable=true`일 때만) | **서버** |
| 개선폭 (`+N`) | TIME OFF 요약 · 대안 카드 | **서버**(`improvement`) |
| 추천도 (25~80) | **펼쳐보기 안에서만** — "추천도 구성 내역" | **서버** |
| 항목별 점수·반영 비율 | 같은 펼쳐보기 (`factors[]`) | **서버** |
| 거리 (`N.Nkm`) | 대안 카드 · 초안 슬롯 근거 | **서버**(`detail` 문자열) |
| 챗봇 카드 비율 (`한적 N%`) | 홈 챗봇 카드 | **서버**(`quietShare`) |

**프론트엔드가 계산하는 것은 하나도 없다.** 점수·등급·판정은 전부 서버가 준 값이다.

### 6.2 문구를 만드는 주체

| 문구 | 만드는 곳 |
|---|---|
| 등급 라벨 (`한적`/`보통`/`붐빔`) | 서버 `CongestionLevel.label()` (프론트에 `FALLBACK_LABEL`도 있으나 서버 값 우선) |
| TIME OFF 상태 문구 5종 | 서버 `TimeOffStatus.message()` |
| PLACE OFF 상태 문구 6종 | 서버 `PlaceOffStatus.message()` |
| 진단 불가 사유 문구 | 서버 `DiagnosisGap.message()` (`CATEGORY_NOT_FORECASTED`은 **null**) |
| 추천 근거 문구 | 서버 `CandidateSource.noteFor()` |
| FULL 슬롯 근거 | 서버 `CourseDraftService.reasonFor()` |
| 챗봇 카드 문장 | 서버 템플릿(`CardLineTemplate`) 또는 검증 통과한 LLM 문장 |
| **추천도 구간 문구** (`이날 가기 좋아요` 등) | **프론트** `AlternativeSheet.tsx` |
| 빈 목록 보정 문구 | 프론트 — 화면이 걸러낸 경우만 (`남은 후보가 이미 이 날 코스에 담겨 있어요.`) |

⚠️ **판단의 근거와 그 판단을 설명하는 말이 갈라지면 한쪽만 바뀐다.** 임계값을 서버에 두는 것과 같은 이유.

### 6.3 목록 정렬 문구 규칙

- **"추천도가 높은 순이에요" 같은 문구를 쓰지 않는다.** 목록은 구간으로만 세운다
- 정렬 기준이 곧 **화면에 보이는 값**이어야 한다 — 줄 세운 것이 카드에 적힌 문구 그 자체다
- 같은 구간 안은 서버가 뽑은 차례 그대로 (JS `sort`가 안정 정렬)

### 6.4 상태별 화면

| 상태 | 처리 |
|---|---|
| 로딩 | `phase: 'loading'` — 진단은 재조회 시 `'refreshing'`으로 이전 결과를 유지 |
| 오류 | `ApiRequestError.message`를 그대로 보여준다 (서버 문구가 사용자용) |
| 빈 결과 | 서버 `statusMessage`를 띄운다. 화면이 걸러낸 경우만 프론트 문구 |
| 곁들이는 정보 실패 | 화면을 막지 않는다 — TIME OFF·예측창 조회는 실패하면 조용히 생략 |
| 총점 없음 | 점수 자리만 비우고 장소·순서·지도는 그대로 그린다. 저장도 막지 않는다 |
| 지도 키 없음 | `MapSdkStatus = 'no-key'` — 지도 자리만 대체 표시 |

### 6.5 디자인 규칙 `[기획]`

**팔레트의 원천은 넉 줄짜리 색 띠 한 장이다** — 네이비 `#364F6B` · 틸 `#3FC1C9` ·
회백 `#F5F5F5` · 핑크 `#FC5185`. 네 색에 각각 자리를 하나씩 주었고 겹치는 색이 없다.

| 원색 | 자리 | 토큰 |
|---|---|---|
| 네이비 `#364F6B` | 잉크 (글자·어두운 면) | `--c-fg: #2A3E54` (한 단계 내림) |
| 틸 `#3FC1C9` | 브랜드 · 지정 메인 색 | `--c-brand` |
| 회백 `#F5F5F5` | 화면 바탕 | `--c-bg` |
| 핑크 `#FC5185` | 붐빔 | 정체성 자리에 원색, 기능 단계는 파생 |

**혼잡 3단계는 브랜드와 별개다**:
한적 `#14A07C` (배경 `#DEF5E4`) / 보통 `#E9AE3E` (배경 `#FBF0D2`) / 붐빔 `#E82C6E` (배경 `#FDDFE9`)
- 색조에 더해 **명도로도 갈린다** (보통 0.48 > 한적 0.27 > 붐빔 0.20) — 색각 이상 대응
- 단계마다 다섯 칸: `tint` → `soft` → `solid` → `strong` → `deep` (`levelStyles.ts`)
- **배경과 글자색은 항상 짝으로** 쓴다 (`LEVEL_ON_SOLID`)

**지켜야 할 것**:
- 색은 `index.css`의 `--c-*` 한 곳에서만 정의. 컴포넌트에 hex를 박지 않는다
  (예외 셋: 외부 브랜드색 / 카카오맵 캔버스 경로선 / `public/favicon.svg`)
- 브랜드 틸 위의 글자는 **흰색이 아니라 잉크**(`text-fg`) — 흰 글자는 2.2:1
- 글자·테두리·초점링에는 `brand-deep`(`#156067`). `brand`는 배경 전용
- 로고 정의는 `components/BrandMark.tsx` **한 곳**. 글자는 `PEAKOFF`로 붙여 쓴다
- 본문 글자 대비 4.5:1 이상
- ⚠️ **화면 바닥에 붙는 고정 막대를 두지 않는다** (크롬 안드로이드 도구막대 뒤로 숨는다)
- ⚠️ **가로로 미는 상자(`overflow-x-auto`)를 만들지 않는다.** `overscroll-x-contain`도 방패가 아니다
  — 옆으로 넘기는 느낌이 필요하면 `transform` + `touch-action: pan-y`로 만든다
- 좁은 화면에서 한 화면에 다 못 넣으면 **스위치로 번갈아 보여준다** — 잘라내지 않는다
- 걷어낸 것 (**되살리지 말 것**): 팔레트 띠 모티프 · 바탕 wash · 사진 위의 모서리 동그라미

---

## 7. 실행 및 테스트 방법

### 7.1 설치·실행

```bash
# 백엔드 (포트 8080)
cd backend && ./gradlew bootRun
# 프론트 (포트 5173, /api는 8080으로 프록시)
cd frontend && npm ci && npm run dev
```

Java 21 필요. Swagger UI: `http://localhost:8080/docs`

### 7.2 환경변수 (**이름만. 값은 저장소에 두지 않는다**)

| 이름 | 용도 | 없으면 |
|---|---|---|
| `KTO_SERVICE_KEY` | 공사 OpenAPI 인증키 (포털의 **Encoding** 키) | 실데이터 모드에서 모든 공사 호출 실패 |
| `KTO_CONGESTION` / `KTO_PLACE` / `KTO_RECOMMENDATION` | `mock` \| `real` | 기본 `mock` |
| `PEAKOFF_JWT_SECRET` | JWT 서명 키 (32바이트 이상) | 매 기동마다 임의 키 → 재시작 시 로그인 풀림 |
| `GEMINI_API_KEY` | 챗봇 LLM | 챗봇만 꺼지고 나머지는 동작 |
| `KAKAO_CLIENT_ID` / `KAKAO_CLIENT_SECRET` / `KAKAO_REDIRECT_URI` | 카카오 로그인 | 카카오 로그인만 불가 |
| `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` / `NAVER_REDIRECT_URI` | 네이버 로그인 | 네이버 로그인만 불가 |
| `SPRING_DATASOURCE_URL` / `_USERNAME` / `_PASSWORD` | DB | 기본 H2 파일(`./data/peakoff`) |
| `PEAKOFF_DEV_ENDPOINTS` | `/api/dev/**` 개방 | 기본 `false` |
| `PEAKOFF_CHAT_MODEL` / `PEAKOFF_CHAT_DAILY_LIMIT` | LLM 모델·상한 | `gemini-3.1-flash-lite` / 600 |
| `VITE_KAKAO_MAP_KEY` (프론트) | 카카오맵 JS 키 | 지도 자리만 대체 표시 |

로컬 개발에서는 `backend/src/main/resources/application-local.yml`이 같은 값을 담는다.
**이 파일은 `.gitignore`에 걸려 있고 커밋 이력에도 없다** (감사 시 확인함). 캡처·공유 금지.

### 7.3 빌드·테스트 명령

```bash
cd backend  && ./gradlew build          # 컴파일 + 테스트
cd backend  && ./gradlew test
cd frontend && npx tsc --noEmit         # 타입 검사
cd frontend && npm run lint             # oxlint
cd frontend && npm run build            # tsc -b && vite build
cd frontend && npm run ui:flow          # E2E 흐름 (서버가 떠 있어야 함, CI 제외)
cd frontend && npm run ui:shot          # 화면 스크린샷 (CI 제외)
```

**CI** (`.github/workflows/ci.yml`) — PR과 main push에서 두 job이 나란히 돈다:
백엔드 `./gradlew build` / 프론트 `tsc --noEmit` → `lint` → `build`.
CI에는 `application-local.yml`이 없어 `peakoff.kto.*`가 전부 `mock`이다 —
**인증키 없이 돌고 공사 일일 한도를 태우지 않는다.**

### 7.4 외부 API 없이 검증 가능한 범위

| 검증 가능 | 검증 불가 (실키 필요) |
|---|---|
| 모든 도메인 계산 (한적도 변환·등급·추천도·가중 무작위·코스 총점) | 실제 공사 응답 파싱 |
| 컨트롤러 계약 (`ApiEndpointsTest` — mock 프로파일) | 이름 매칭의 실제 적중률 |
| 인증 흐름 (`AuthApiTest`) | 예측 창 길이 |
| 이름 정규화 (`PlaceNameMatcherTest`) | 지역별 후보 분포 |
| 캐시 TTL·stale·백오프 (`TtlCacheTest`) | E2E 전체 흐름 |

목업은 **경주 한 지역만** 있다 (`place/mock/GyeongjuMockCatalog`).
목업 한적도는 요일 계수(주말 0.80 · 금 0.92 · 평일 1.08)를 곱한 것이라 **날짜 제한이 없다.**

---

## 8. 구현 상태표

| 기능 | 상태 | 근거 |
|---|---|---|
| **코스 편집** (검색·추가·삭제·순서·지도) | 구현 완료 | `CoursePage.tsx` · `useDragSort` |
| 검색 전 대표 관광지 칩 | 구현 완료 | `PlaceService.search` (keyword 빈값) |
| **한적도 진단** (3단계 배지) | 구현 완료 | `CourseDiagnosisService` · `CongestionLevel` |
| **TIME OFF** (날짜 대안) | 구현 완료 | `DateAlternativeService` · 상태 5종 |
| **PLACE OFF** (장소 교체) | 구현 완료 | `KtoRecommendationProvider` · 상태 6종 |
| **FULL PEAKOFF** (설문 코스) | **부분 구현** | 2문항만. 선호 유형·이동수단 없음. 연관 관광지 미사용 |
| 추천 근거 노출 (구성 내역) | 구현 완료 | `factors[]` + 서버 문구 |
| 추천 분산 (가중/균등 무작위) | 구현 완료 | `WeightedPicker` · 재정렬 없음 |
| 세션 내 추천 고정 | 구현 완료 (메모리 한정) | `alternativeCache.ts` |
| **원안 vs 개선안 비교** | 구현 완료 | `ResultPage.tsx` |
| **코스 저장·비교** | 구현 완료 | `SavedCourse*` · 최대 50개 |
| 코스 공유 링크 | 구현 완료 | `/api/courses/{id}/share` |
| 여행 묶음 (폴더) | 구현 완료 | `/api/trips` |
| 즐겨찾기 | 구현 완료 | `/api/favorites` |
| **지역 추천 챗봇** | 구현 완료 | `/api/chat/*` · LLM 없어도 동작 |
| 이번 주 한적한 곳 | 구현 완료 | `QuietWeekService` |
| 다른 사람들의 여행 | 구현 완료 | `/api/courses/recent` |
| 게스트 모드 (1층) | 구현 완료 | 저장만 로그인 필요 |
| 이메일 로그인 + JWT (2층) | 구현 완료 | `AuthService` · `JwtProvider` |
| 소셜 로그인 카카오·네이버 (3층) | 구현 완료 | `auth/oauth/` |
| 데이터 활용 설명 화면 | 구현 완료 | `/data` (`DataPage.tsx`) |
| 공사 호출 수 확인 | 구현 완료 | `/api/quotas` · `KtoCallLog` |
| **5단계 등급** | **미구현 (논의 중)** | `CongestionLevel`은 3단계 |
| **이동수단별 거리 제한** | **미구현 (의도적 제외)** | 15km 고정 |
| **선호 유형(여행 스타일) 문항** | **미구현 (의도적 제외)** | 후보가 쪼그라들어 걷어냄 |
| **집중률 API 페이징** | **미구현** | 상한 초과 시 WARN만 |
| **지역별 방문자수 빅데이터** | **미구현 (계획 없음)** | 표에 자리만 남김 |
| 시간대 조정 제안 | **미구현 (보류)** | 공사 데이터에 시간대 정보 확인 안 됨 |
| 짜 온 코스 붙여넣어 진단 | **미구현 (안 만들기로 확정, 2026-09-10)** | 주제를 넓혀 가장 강한 칸을 묽게 만든다 |
| 커뮤니티 (리뷰·댓글·게시판) | **범위 밖** | — |

### 범위 밖 (요청받지 않는 한 제안하지도 말 것)

블루/그린 무중단 배포 · Docker 오케스트레이션 · Prometheus/Grafana · 부하 테스트 ·
Materialized View 등 고급 DB 최적화 · 마이크로서비스 분리 · GPS 위치 기능 ·
최단 경로 최적화 알고리즘 · 커뮤니티 기능

배포는 "심사위원이 URL로 접속해 안정적으로 사용 가능한 상태"면 충분하다.

---

## 9. 알려진 제한사항과 확인 필요 사항

### 9.1 코드와 문서/기획의 불일치

| # | 항목 | 문서·기획 | 실제 코드 | 조치 |
|---|---|---|---|---|
| 1 | 중심 관광지의 역할 | "코스 자동 생성의 **첫 장소 후보**" | 하루의 **모든 슬롯**이 이 100곳에서 나온다 | 기능설명서는 코드 기준으로 쓸 것 |
| 2 | FULL PEAKOFF의 연관 관광지 | "다음 장소 후보 생성에 사용" | **전혀 쓰지 않는다** | 기획 확인 필요 — 붙일지 말지 |
| 3 | 5단계 등급 | 논의 중 | 3단계만 존재 | 결정 전까지 기능설명서에 쓰지 말 것 |
| 4 | 이동수단 입력 | 감사 요청서에 항목으로 있음 | 입력·처리 모두 없음 | 의도적 제외임을 명시할 것 |
| 5 | `DateAlternativeController` Javadoc | `ALREADY_QUIETEST` 상태를 언급 | 그런 값이 없다 (5종은 `INSUFFICIENT_DATA`·`ALREADY_QUIET`·`CURRENT_BEST`·`MARGINAL`·`RECOMMENDED`) | 코드 주석 수정 필요 |
| 6 | `ResultPage.tsx:1567` 주석 | "총점이 없으면 저장 버튼이 잠겨 있다" | 잠기지 않는다 (같은 파일 1515~1529행이 반대로 설명) | 코드 주석 수정 필요 |
| 7 | `SavedCourseController` Javadoc | "코스 이름은 담기지 않는다" | 맞다 — 다만 이전 `CLAUDE.md`는 "이름도 함께 나간다"고 적혀 있었다 | **코드가 맞다.** 이 문서에서 정정함 |
| 8 | `KtoCongestionProvider` Javadoc 2곳 | "집중률→한적도 변환은 **임시식**", "관측 33~69라 늘려야 할지 확정해야" | `Quietness`가 **2026-08-31에 확정**으로 뒤집었다("한때 '임시값'이라 적어 두었다… 늘릴 여지가 없다") | **`Quietness`가 맞다.** 두 주석이 옛 판단을 그대로 들고 있다 — 코드 주석 수정 필요 |
| 9 | 같은 파일 클래스 Javadoc | "지금은 집중률만 실연동됐고 **장소·대안은 아직 목업**이다" | 셋 다 `real`로 돈다 | 코드 주석 수정 필요 |
| 10 | `/data` 화면 | "관심사는 정해진 **아홉** 중 하나" | `Interest.promptOptions()`가 `NONE`을 빼고 만든다 = **여덟** (테스트가 `doesNotContain("NONE")`으로 못박음) | **이번에 화면을 고쳤다** |

### 9.2 하드코딩 · 임시값

| 항목 | 값 | 위치 | 위험 |
|---|---|---|---|
| 연관 관광지 기준월 | `"202504"` | `KtoRelatedClient.BASE_MONTH` | 공사가 옛 월을 닫으면 PLACE OFF 연관 후보가 통째로 빈다 |
| 중심 관광지 기준월 | `"202504"` | `KtoHubClient.BASE_MONTH` | 같은 이유로 대표 칩과 FULL 후보 풀이 빈다 |
| 지도 초기 중심 좌표 | 경주 시내 `35.8397, 129.2124` | `CourseMap.tsx:40` | 장소를 받기 전 잠깐만 쓰는 값 — 실사용 영향 없음 |
| 배포 API 주소 | 고정 IP | `frontend/vercel.json` | IP가 바뀌면 배포본이 죽는다 |
| 가정한 일일 한도 | `1000` | `KtoCallLog.ASSUMED_DAILY_LIMIT` | 포털이 알려주지 않아 가정한 값. `/api/quotas` 비율의 근거 |
| 수동 이름 연결표 | 16쌍 | `PlaceNameMatcher.MANUAL_LINKS` | 경주·제주·여수만 있다. 지역이 늘면 손으로 채워야 한다 |
| 추천도 구간 경계 | 64 / 46 | `AlternativeSheet.tsx` (프론트 전용) | 가중치가 바뀌면 따로 갱신해야 함 |

### 9.3 확인 필요 사항 (**이번 작업에서 코드를 고치지 않았다**)

| # | 사항 | 위치 | 판단 |
|---|---|---|---|
| 1 | **집중률·카탈로그 응답에 페이징이 없다.** `totalCount`가 상한(10,000 / 5,000)을 넘으면 WARN만 남기고 잘린 채로 쓴다 | `KtoCongestionClient` · `KtoPlaceClient` | 현재 최대 지역이 상한 아래인지 실측 확인 필요 |
| 2 | **이름·좌표가 같은 중복 장소를 거르는 코드가 없다.** 콘텐츠 ID 중복만 막는다 | `KtoRecommendationProvider` | 카탈로그 자체에 중복이 있으면 같은 곳이 두 번 추천될 수 있다 |
| 3 | **대안 세션 고정이 메모리 전용.** 새로고침하면 추천이 다시 뽑힌다 | `alternativeCache.ts` | `sessionStorage`로 옮길지 결정 필요 (`swapEvidence`는 이미 그렇게 한다) |
| 4 | **`CourseDraft` 프론트 타입이 서버가 보내지 않는 필드를 선언한다** (`totalPresentable` 등) | `types/api.ts:341` | 현재 읽는 곳이 없어 무해. 읽으면 `undefined` |
| 5 | **`/api/quotas`가 인증 없이 열려 있다.** 같은 정보를 주는 `/api/dev/kto-calls`는 스위치로 잠겨 있다 | `SecurityConfig.PUBLIC_API` | 심사 증빙 목적이면 의도. 아니면 잠글지 결정 필요 |
| 6 | **미사용 import 10건** | `CourseDiagnosisService`(1) `SavedCourseService`(5) `KtoCongestionClient`(1) `KtoPlaceClient`(1) `KtoCongestionProvider`(1) `KtoRecommendationProvider`(1) | 컴파일·동작에는 영향 없음 |
| 7 | **`RecommendationScorer.quietnessFactor`가 `level` 파라미터를 쓰지 않는다** | `RecommendationScorer.java` | 죽은 인자 |
| 8 | **`CandidateSource` 프론트 타입이 아무 데서도 쓰이지 않는다.** 서버는 `source` 필드를 보내지 않고 문구만 보낸다 | `types/api.ts:167` | 타입만 남은 상태 |
| 9 | **빌드 산출물이 저장소에 남아 있다** — `backend/bin/`, `backend/build/`, `backend/hs_err_pid*.log` | | `.gitignore` 확인 필요 |
| 10 | **번들이 559KB (gzip 158KB)** — vite가 경고 | `frontend/dist` | 코드 스플리팅 검토. 현재 사용성 문제는 확인 안 됨 |
| 11 | **`SavedCourseService.livePlaceOf`에 `@Transactional`이 private 메서드에 붙어 있다** | `SavedCourseService` | 스프링 프록시가 적용하지 않는다 (무해하지만 오해를 부른다) |

### 9.4 데이터 의미상 한계 (**기능설명서에 반드시 적을 것**)

1. **집중률은 예측·통계값이지 실시간 값이 아니다.** UI 문구는 "예상 혼잡 / 예측 기반".
2. **집중률은 절대 방문객 수가 아니다.** 공사가 제공하는 0~100 지표이고, 우리는
   `100 − 집중률`로 뒤집어 쓸 뿐 절대 인원·현장 밀도로 환산하지 않는다.
   화면 어디에도 사람 수를 세는 표현이 없고, 챗봇은 `방문객·관광객·인파`를 금칙어로 막는다.
3. **장소 간 비교가 성립한다고 판단한 근거**: 전국 표본(64개 시군구 · 관측 87,150건)에서
   원자료가 0.3~100.0으로 척도 전 구간을 쓰고, 장소별 30일 합계가 322~2,957로 제각각이었다
   (변동계수 0.32) — 즉 **장소 안 정규화가 아니다.** PLACE OFF와 FULL PEAKOFF가
   서로 다른 관광지의 값을 직접 견주는 근거가 이것이다 (`analysis/national/RESULTS.md`).
   ⚠️ 다만 이는 **분포 관찰에 근거한 판단**이지 공사가 명세로 보장한 것은 아니다.
4. **예측 대상은 관광지와 시장뿐이다.** 음식점·숙박은 애초에 없다.
5. **관광지 식별자가 이름 문자열뿐이라** 이름 매칭에 실패하면 그 장소는 조용히 빠진다.
6. **예측 창이 24~30일로 고정이 아니고, 같은 날짜의 값도 갱신되면서 바뀐다.**

### 9.5 테스트되지 않은 경로

- 실데이터(`real`) 프로바이더 전체 — 모든 테스트가 `mock` 프로파일이다
- 소셜 로그인의 실제 OAuth 왕복
- 챗봇의 LLM 경로 (`GeminiIntentReader` · `GeminiCardLineWriter`)
- E2E 흐름 (`flow.spec.ts` — 실행하려면 서버 + 실키 필요, CI 제외)
- 프론트엔드 단위 테스트 **없음** (타입 검사와 린트만)

### 9.6 향후 결정이 필요한 정책

1. 5단계 등급을 도입할 것인가 (도입하면 6곳이 함께 움직인다 — 4.2 참조)
2. FULL PEAKOFF에 연관 관광지를 붙일 것인가
3. 연관/중심 관광지 `baseYm`을 어떻게 최신으로 유지할 것인가
4. `/api/quotas` 공개 범위
5. 대안 세션 고정을 새로고침 너머로 유지할 것인가

그 밖의 열린 결정은 `docs/OPEN_DECISIONS.md`에 모아 두었다.

---

## 부록 A. 전체 API 목록

| 메서드 | 경로 | 인증 | 컨트롤러 |
|---|---|---|---|
| GET | `/api/health`, `/health` | 공개 | `HealthController` |
| GET | `/api/regions` | 공개 | `RegionController` |
| GET | `/api/places?region=&keyword=&limit=` | 공개 | `PlaceController` |
| GET | `/api/places/quiet-week?limit=` | 공개 | `PlaceController` |
| GET | `/api/places/{id}/alternatives?date=&limit=&exclude=` | 공개 | `PlaceController` |
| GET | `/api/places/{id}/nearby?limit=` | 공개 | `PlaceController` |
| GET | `/api/places/{id}/description` | 공개 | `PlaceController` |
| GET | `/api/dates/forecast-window` | 공개 | `DateAlternativeController` |
| GET | `/api/dates/alternatives?slot=&date=&range=` | 공개 | `DateAlternativeController` |
| POST | `/api/courses/diagnose` | 공개 | `CourseController` |
| POST | `/api/courses/recommend` | 공개 | `CourseController` |
| POST/PUT/GET/DELETE | `/api/courses`, `/api/courses/{id}` | 인증 | `SavedCourseController` |
| POST | `/api/courses/{id}/share` | 인증 | `SavedCourseController` |
| GET | `/api/courses/shared/{token}` | 공개 | `SavedCourseController` |
| GET | `/api/courses/recent?limit=` | 공개 | `SavedCourseController` |
| GET/POST/DELETE | `/api/trips`, `/api/trips/{id}/courses/...` | 인증 | `TripController` |
| GET/PUT/DELETE | `/api/favorites`, `/api/favorites/{placeId}` | 인증 | `FavoriteController` |
| POST | `/api/auth/signup`, `/api/auth/login` | 공개 | `AuthController` |
| GET/PATCH/DELETE | `/api/auth/me`, `/me/nickname`, `/me/password` | 인증 | `AuthController` |
| GET/POST | `/api/auth/oauth/{provider}/authorize`, `/api/auth/oauth/{provider}`, `/link` | 공개 | `OAuthController` |
| GET/POST | `/api/chat/status`, `/api/chat/regions`, `/api/chat/regions/lines` | 공개 | `ChatController` |
| GET | `/api/quotas?date=` | 공개 | `QuotaController` |
| GET | `/api/dev/kto-calls`, `/api/dev/chat-intent`, `/api/dev/chat-regions` | `peakoff.dev.endpoints=true`일 때만 | 개발용 |
| GET | `/docs`, `/v3/api-docs`, `/swagger-ui/**` | 공개 | springdoc |

`인증` = JWT Bearer 토큰 필요 (`Authorization: Bearer …`).
**게스트는 검색·편집·진단·TIME OFF·PLACE OFF·FULL PEAKOFF를 전부 로그인 없이 쓸 수 있다** —
공개 목록(`SecurityConfig.PUBLIC_API`)에 `/api/places/**` · `/api/courses/diagnose` ·
`/api/courses/recommend` · `/api/dates/**` · `/api/chat/**`이 들어 있다.
로그인이 필요한 것은 **저장·내 코스·여행 묶음·즐겨찾기·계정**뿐이다.
`JwtAuthenticationFilter`는 토큰이 없으면 인증을 세우지 않고 그냥 통과시킨다 —
그래서 공개 경로에서는 회원/게스트가 같은 코드를 지난다.

## 부록 B. 참고 문서

| 문서 | 내용 |
|---|---|
| `docs/FACT-SHEET.md` | 심사·PT용 사실 정리 (이 문서와 중복되는 내용이 많다) |
| `docs/OPEN_DECISIONS.md` | 열린 정책 결정과 임계값이 어디 있는지 |
| `docs/backend-patterns.md` | 백엔드 구현 관례 |
| `docs/blog-*.md` | 문제 해결 기록 (챗봇·이름매칭 성능·캐시 타임아웃·소셜 로그인) |
| `analysis/national/RESULTS.md` | 전국 표본 분포 — 등급 경계와 척도 판단의 근거 |
| `analysis/region-candidates/RESULTS.md` | 지역 확장 조건과 후보 실측 |
| `analysis/pool-mix/compare.py` | 두 출처 자리 배분 시뮬레이션 (RESULTS 문서 없음 — 스크립트만) |
| `analysis/quietness-scale/` | 한적도 척도 검토 (RESULTS 문서 없음 — 스크립트만) |
| `analysis/forecast-drift/DRIFT-LOG.md` | 같은 날짜 예측값의 변화폭 측정 |
