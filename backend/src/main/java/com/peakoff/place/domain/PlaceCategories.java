package com.peakoff.place.domain;

import java.util.Map;
import java.util.Set;

/**
 * 공사 <b>신분류 코드</b>의 대분류를 화면에 쓸 이름으로 옮긴다.
 *
 * <p>구 서비스 분류코드({@code cat1/cat2/cat3})는 26년 폐기 예정이라 쓰지 않는다.
 * 실제로 최근 등록분은 구 코드 자리가 비어 있고 신분류만 채워져 온다.
 *
 * <h3>이름을 우리가 정하는 이유</h3>
 * 응답에는 코드({@code HS})만 오고 한글 이름이 딸려오지 않는다. 화면에 코드를 그대로
 * 띄울 수는 없으니 어딘가에서 이름을 붙여야 하는데, 그 자리를 한 곳으로 모은다.
 *
 * <p>⚠️ <b>아래 이름은 실제 데이터를 보고 붙인 것이지 공사가 정한 명칭이 아니다.</b>
 * 경주 621건의 분포를 보고 지었다. 공식 명칭이 확인되면 여기만 고치면 된다.
 *
 * @see #labelOf(String)
 */
public final class PlaceCategories {

	/**
	 * 대분류 코드 → 화면 이름. 경주 실측 분포(2026-08-22)를 괄호에 적어 둔다.
	 *
	 * <p>{@code VE}가 가장 애매하다 — 워터파크·리조트·금리단길·동궁원이 한데 묶여 있어
	 * 하나의 성격으로 부르기 어렵다. 그래서 이름만으로 판단하지 않고 중분류를 함께 본다
	 * ({@link #VE_NOT_TOURABLE}, {@link #VE_SCENIC}, {@link #VE_CULTURE}).
	 */
	private static final Map<String, String> LABELS = Map.ofEntries(
			Map.entry("HS", "역사·유적"),     // 109건 — 왕릉·사지·유적
			Map.entry("NA", "자연·풍경"),     // 41건 — 항구·숲·정원
			Map.entry("VE", "문화·명소"),     // 75건 — 성격이 섞여 있다
			Map.entry("LS", "레저·스포츠"),   // 11건 — 루지·사격장·골프
			Map.entry("EX", "체험"),          // 13건 — 체험관·공방
			Map.entry("SH", "쇼핑"),          // 31건 — 시장·상점
			Map.entry("FD", "음식점"),        // 211건 — 가장 많다
			Map.entry("AC", "숙박"),          // 121건
			Map.entry("EV", "축제·행사"),     // 8건 — 기간이 정해져 있다
			Map.entry("C01", "여행코스"));    // 1건

	/**
	 * 공사 집중률이 <b>예측 대상으로 삼는 분류.</b>
	 *
	 * <h3>이 집합이 하는 일</h3>
	 * 진단하지 못한 칸에 <b>사유를 말할지 말지</b>를 가른다. 여기 든 분류인데 자료가 없으면
	 * "예상 혼잡 정보가 없는 장소예요"라고 말하고, 여기 없는 분류(음식점·숙박·쇼핑)는
	 * 아무 말도 하지 않는다.
	 *
	 * <p>말하지 않는 쪽이 필요한 이유: 경주 621곳 중 음식점이 211곳, 숙박이 121곳이다.
	 * 코스에 밥집이 서넛만 있어도 안내 문구가 화면을 채워, 정작 읽어야 할 점수들이 그 사이에 묻힌다.
	 * <b>애초에 예측하지 않기로 되어 있는 것을 "없다"고 알리는 것은 정보가 아니다.</b>
	 *
	 * <p>반대로 역사·유적은 109곳 중 36곳만 예측이 있다. 세 번 중 두 번은 자료가 없는데,
	 * 여기서 침묵하면 사용자는 <b>담는 방법을 잘못 알았다고 생각한다</b> — 같은 관광지인데
	 * 어떤 곳은 점수가 뜨고 어떤 곳은 아무것도 없으니 자기 탓을 찾게 된다.
	 *
	 * <h3>왜 화면이 아니라 여기서 가르는가</h3>
	 * 공사가 나중에 음식점을 예측하기 시작하면 이 집합만 고치면 된다. 화면에 코드를 박아 두면
	 * 그날 화면을 찾아다녀야 한다. 임계값과 가중치를 서버에 둔 것과 같은 이유다.
	 *
	 * <p>축제(EV)는 넣었다 — 기간이 정해진 행사라 혼잡이 본질이다.
	 *
	 * <h3>쇼핑(SH)을 넣었다 (2026-08-26)</h3>
	 * 예전에는 뺐다 — 시장은 붐빔이 실제 이슈지만 기념품 가게·상점이 섞여 있어 애매하다고 봤다.
	 * 실측해 보니 <b>공사가 예측하는 쇼핑은 시장뿐</b>이라, 애매함은 우리 걱정이었지 데이터의
	 * 성질이 아니었다. 동문재래시장·서귀포매일올레시장·광장시장·강릉 중앙시장이 다 여기 있다.
	 *
	 * <p>⚠️ 대신 <b>쇼핑은 이름이 정확히 같을 때만 잇는다</b>({@link #requiresExactNameMatch}).
	 * 그리고 자료가 없어도 말을 걸지 않는다({@link #announcesMissingForecast}) —
	 * 셋을 한 집합으로 두면 하나를 열 때 셋이 함께 열린다.
	 */
	private static final Set<String> FORECAST_TARGETS =
			Set.of("HS", "NA", "VE", "LS", "EX", "EV", "SH");

	/**
	 * 자료가 없을 때 <b>"우리가 못 매겼다"고 말해 줄</b> 분류.
	 *
	 * <p>{@link #FORECAST_TARGETS}와 갈라 둔 이유: 쇼핑은 예측 대상이지만
	 * <b>실제로 이어지는 것은 극소수</b>다. 제주시 296곳 중 6곳, 서귀포 99곳 중 4곳,
	 * 경주는 31곳 중 0곳이다(2026-08-26 실측).
	 *
	 * <p>여기에 쇼핑을 넣으면 상점 하나 담을 때마다 "예상 혼잡 정보가 없는 장소예요"가
	 * 화면에 서고, 정작 읽어야 할 점수들이 그 사이에 묻힌다.
	 * <b>애초에 예측되는 일이 드문 것을 "없다"고 알리는 것은 정보가 아니다</b> —
	 * 음식점·숙박에 침묵하는 것과 같은 이유다.
	 *
	 * <p>반대로 역사·유적은 109곳 중 36곳이 예측된다. 세 번 중 두 번은 없는데,
	 * 여기서 침묵하면 사용자는 <b>담는 방법을 잘못 알았다고 생각한다.</b>
	 *
	 * <p>총점의 분모도 이 기준을 따른다({@code Course.forecastTargetCount}) —
	 * 진단되지 않은 쇼핑은 분모에서 빠지므로, 상점을 담을수록 총점이 사라지는 일이 없다.
	 * <b>진단된 쇼핑은 분자·분모 양쪽에 들어간다.</b>
	 */
	private static final Set<String> ANNOUNCE_MISSING = Set.of("HS", "NA", "VE", "LS", "EX", "EV");

	/**
	 * <b>이름이 정확히 같을 때만</b> 이어야 하는 분류.
	 *
	 * <h3>왜 쇼핑만인가</h3>
	 * 상호에 지명을 붙이는 관습이 있다. 포함 매칭을 열어 두면 이렇게 된다(종로구 실측):
	 *
	 * <pre>
	 * "다이소 경복궁역점"   → "경복궁"     생활용품점이 궁궐의 혼잡도를 받는다
	 * "올리브영 대학로점"   → "대학로"
	 * "CU 도두항점"         → "도두항"
	 * </pre>
	 *
	 * <p><b>좌표 검증으로도 못 막는다.</b> 다이소 경복궁역점은 실제로 경복궁 2km 안에 있다 —
	 * 이름도 닮고 위치도 가까운데 같은 장소가 아니다. 예전 "불국사밀면 → 불국사"와 같은 부류인데,
	 * 그쪽은 분류로 걸러 낼 수 있었지만 이쪽은 분류가 같다.
	 *
	 * <p>완전 일치만 허용하면 <b>남는 것이 전부 시장·관광시설</b>이 된다.
	 * 종로구에서 32건이 4건으로 줄면서 오연결 29건이 통째로 사라졌고, 잃은 것은 없다.
	 */
	private static final Set<String> EXACT_NAME_ONLY = Set.of("SH");

	/**
	 * {@code VE} 안에서 <b>자연을 보러 가는</b> 성격. 자연·풍경과 서로 대신할 수 있다.
	 *
	 * <p>전망대·등대(VE01)와 공원(VE03)이다. 실측한 이름들이 성격을 그대로 보여준다 —
	 * 양남 주상절리 전망대, 거린사슴전망대, 사라봉공원, 노리매공원.
	 */
	private static final Set<String> VE_SCENIC = Set.of("VE01", "VE03");

	/**
	 * {@code VE} 안에서 <b>보고 배우러 가는</b> 성격. 역사·유적과 서로 대신할 수 있다.
	 *
	 * <p>박물관·미술관(VE07), 공연장(VE06), 책방·소규모 문화공간(VE12).
	 * 국립경주박물관·김영갑갤러리가 여기다.
	 */
	private static final Set<String> VE_CULTURE = Set.of("VE07", "VE06", "VE12");

	/**
	 * {@code VE}지만 <b>관광 대상으로 보지 않는</b> 중분류. 후보에서 뺀다.
	 *
	 * <ul>
	 *   <li>{@code VE05} 리조트·관광단지 — 마우나오션 리조트, 라온호텔. 숙박이 본질이라
	 *       관광지 자리를 대신할 수 없다. 분석 문서도 명시적으로 제외한다</li>
	 *   <li>{@code VE09} 도서관·문화원 — 경주중앙도서관, 조천읍도서관. 생활 시설이다</li>
	 *   <li>{@code VE10} 수련관·경기장 — 청소년수련관, 제주월드컵경기장</li>
	 * </ul>
	 *
	 * <p>이것들을 빼면서 경주의 대안 자리가 둘 줄었다. <b>줄어드는 것이 맞다</b> —
	 * 불국사를 바꾸려는 사람에게 보문관광단지를 권할 이유가 없다.
	 */
	private static final Set<String> VE_NOT_TOURABLE = Set.of("VE05", "VE09", "VE10");

	/**
	 * 설문 코스에 <b>올리지 않는</b> 대분류.
	 *
	 * <h3>왜 생겼는가 (2026-08-27)</h3>
	 * 예전에는 설문의 "여행 스타일"({@code TravelStyle})이 후보를 걸렀다. 스타일이
	 * 역사·자연·문화 셋뿐이라 <b>하나만 고르면 후보가 통째로 쪼그라들었다</b> —
	 * 제주시에서 역사만 고르면 3곳, 서귀포는 2곳이었다. 1박 2일에 네댓 칸을 채워야 하는데
	 * 거기서 이미 못 채운다.
	 *
	 * <p>그래서 <b>고르게 하는 대신 빼는 쪽으로 뒤집었다.</b> 예측이 있는 곳은 기본적으로
	 * 다 후보이고, 코스 슬롯에 어울리지 않는 것만 여기서 뺀다.
	 *
	 * <ul>
	 *   <li>{@code FD} 음식점 — 집중률이 예측하지 않아 한적도를 매길 수 없다.
	 *       코스 추천은 혼잡을 분산하는 장치인데, 한적도를 모르는 곳을 권하면
	 *       "덜 붐비는 곳으로 안내한다"는 말이 성립하지 않는다. 사용자가 코스 편집에서
	 *       직접 담는 것은 막지 않는다</li>
	 *   <li>{@code AC} 숙박 — 코스 슬롯은 "그 날 어디를 가는가"이지 "어디서 자는가"가 아니다</li>
	 *   <li>{@code EV} 축제·행사 — 기간이 정해져 있어 여행 날짜에 안 열릴 수 있다.
	 *       안 하는 축제가 코스에 박히면 그대로 오답이 된다</li>
	 * </ul>
	 *
	 * <p>⚠️ 쇼핑({@code SH})은 <b>남긴다.</b> 공사가 예측하는 쇼핑은 사실상 시장뿐이라
	 * (동문재래시장·서귀포매일올레시장) 관광 대상으로 볼 만하고, 빼면 제주 후보가 다시 준다.
	 *
	 * <p>여기 없는 {@code VE}는 {@link #VE_NOT_TOURABLE}이 한 번 더 거른다 —
	 * 리조트·도서관·수련관이 그 코드 아래 섞여 있다.
	 *
	 * <h3>⚠️ 목업 코드를 함께 적는다</h3>
	 * 목업 집중률은 카탈로그에 있는 <b>모든 장소에 값을 준다</b>(요일 보정만 하므로).
	 * 실데이터에서는 음식점·숙박에 예측이 없어 {@code hasData}가 알아서 걸러 주지만,
	 * 목업 구간에서는 그 그물이 없다 — {@code MOCK-*}를 빼먹으면 목업으로 화면을 볼 때
	 * <b>밥집과 숙소가 코스에 올라온다.</b>
	 */
	private static final Set<String> NOT_FOR_COURSE = Set.of(
			"FD", "AC", "EV",
			"MOCK-RESTAURANT", "MOCK-CAFE", "MOCK-STAY");

	/** 코드를 못 알아볼 때 쓰는 이름. 빈 이름으로 두면 화면 곳곳이 빈자리가 된다. */
	private static final String UNKNOWN = "기타";

	private PlaceCategories() {
	}

	/**
	 * 분류를 만든다. 코드가 비어 있으면 {@code null}을 돌려준다 —
	 * 분류를 모르는 장소는 후보에서 걸러야지, "기타"라는 분류를 가진 것처럼 다루면
	 * 스타일 필터가 조용히 통과시킨다.
	 */
	public static PlaceCategory of(String largeCode) {
		return of(largeCode, null);
	}

	/**
	 * 대분류와 중분류로 분류를 만든다.
	 *
	 * <p>중분류는 없어도 된다. 있으면 {@link #compatible}이 {@code VE} 안을 가를 수 있고,
	 * 없으면 대분류만으로 판단한다.
	 */
	public static PlaceCategory of(String largeCode, String mediumCode) {
		if (largeCode == null || largeCode.isBlank()) {
			return null;
		}
		return new PlaceCategory(largeCode, mediumCode, labelOf(largeCode));
	}

	/**
	 * 이 후보가 그 자리를 대신할 수 있는 분류인가.
	 *
	 * <h3>왜 "같은 대분류"만으로는 부족했는가</h3>
	 * 코드가 정확히 같아야 통과시켰더니, 역사·유적 자리에 <b>박물관</b>이 못 들어갔다.
	 * 경주 국립경주박물관과 제주 김영갑갤러리는 유적을 보러 온 사람이 충분히 갈 만한 곳인데
	 * 분류 코드가 {@code VE}라는 이유로 잘렸다. 반대로 {@code VE}끼리는 전부 통과해서
	 * 황리단길 자리에 <b>리조트</b>가 올라왔다.
	 *
	 * <p>중분류로 {@code VE}를 갈라 양쪽을 함께 고친다.
	 * <pre>
	 * 역사·유적(HS) ↔ HS · 박물관·공연장·책방(VE07/06/12)
	 * 자연·풍경(NA) ↔ NA · 전망대·공원(VE01/03)
	 * 문화·명소(VE) ↔ 관광 대상인 VE 전부
	 * 그 밖(LS·EX·EV·FD·AC·SH) ↔ 같은 대분류만
	 * </pre>
	 *
	 * <p><b>양방향이 맞아떨어진다.</b> 유적에서 박물관으로 갈 수 있으면 박물관에서 유적으로도
	 * 갈 수 있어야 한다 — 한쪽만 열어 두면 같은 두 장소가 어느 쪽을 누르느냐에 따라
	 * 다른 답을 준다.
	 *
	 * <p>실측 효과(2026-08-25): 대안이 있는 자리가 제주시 72→77곳, 서귀포 62→68곳으로 늘고,
	 * 경주는 24→22곳으로 줄었다. 경주가 줄어든 것은 리조트·관광단지가 빠졌기 때문이다.
	 *
	 * @param origin    교체 대상 장소의 분류
	 * @param candidate 후보의 분류
	 */
	public static boolean compatible(PlaceCategory origin, PlaceCategory candidate) {
		if (origin == null || candidate == null) {
			return false;
		}
		// 관광 대상이 아닌 곳은 어느 자리도 대신할 수 없다.
		if (!isTourable(candidate)) {
			return false;
		}

		String from = origin.code();
		String to = candidate.code();

		if ("HS".equals(from)) {
			return "HS".equals(to) || ("VE".equals(to) && isOneOf(VE_CULTURE, candidate.subCode()));
		}
		if ("NA".equals(from)) {
			return "NA".equals(to) || ("VE".equals(to) && isOneOf(VE_SCENIC, candidate.subCode()));
		}
		if ("VE".equals(from)) {
			if ("VE".equals(to)) {
				return true;
			}
			if (isOneOf(VE_SCENIC, origin.subCode())) {
				return "NA".equals(to);
			}
			if (isOneOf(VE_CULTURE, origin.subCode())) {
				return "HS".equals(to);
			}
			/*
			 * 남는 것은 놀러 가는 곳(VE02 테마파크·워터파크, VE04 거리·마을)과
			 * 중분류를 모르는 VE다. 이들은 VE 안에서만 바꾼다 — 강동 워터파크나
			 * 황리단길을 역사 유적·자연과 바꿔치면 여행의 성격이 통째로 달라진다.
			 */
			return false;
		}
		return from.equals(to);
	}

	/**
	 * 관광 대상으로 볼 수 있는 분류인가.
	 *
	 * <p>중분류를 모르면 <b>대상으로 본다.</b> 목업 카탈로그처럼 중분류가 없는 자리에서
	 * 전부 제외해 버리면 후보가 통째로 사라진다 — 모르는 것을 "아니다"로 단정하지 않는다.
	 *
	 * @see #VE_NOT_TOURABLE 무엇을 왜 뺐는지
	 */
	private static boolean isTourable(PlaceCategory category) {
		return !"VE".equals(category.code())
				|| !isOneOf(VE_NOT_TOURABLE, category.subCode());
	}

	/**
	 * 중분류가 그 집합에 드는가. <b>모르면 아니다.</b>
	 *
	 * <p>{@code Set.of(...)}는 불변 집합이라 {@code contains(null)}이
	 * <b>{@code NullPointerException}을 던진다.</b> 그냥 {@code false}를 돌려주지 않는다.
	 * 중분류가 없는 장소가 하나만 섞여도 추천이 통째로 터지므로 여기서 먼저 막는다 —
	 * 실제로 목업 카탈로그가 그 경우였다.
	 */
	private static boolean isOneOf(Set<String> codes, String subCode) {
		return subCode != null && codes.contains(subCode);
	}

	public static String labelOf(String largeCode) {
		return LABELS.getOrDefault(largeCode, UNKNOWN);
	}

	/**
	 * 공사 집중률이 이 분류를 예측하는가.
	 *
	 * <p>분류를 모르는 장소({@code null})는 <b>대상이 아니라고 본다.</b> 모르는 것을
	 * 관광지로 쳐서 "자료가 없어요"라고 말하면, 실은 우리가 분류를 못 읽은 것을
	 * 공사 탓으로 돌리게 된다.
	 *
	 * @see #FORECAST_TARGETS 어떤 분류를 넣고 뺐는지, 그리고 왜
	 */
	public static boolean isForecastTarget(PlaceCategory category) {
		return category != null && FORECAST_TARGETS.contains(category.code());
	}

	/**
	 * 자료가 없을 때 <b>사용자에게 그 사실을 알릴</b> 분류인가.
	 *
	 * <p>{@link #isForecastTarget}과 갈라 물어야 한다. 예측을 시도하는 것과,
	 * 실패했을 때 말을 거는 것은 다른 판단이다 — 쇼핑은 시도하되 침묵한다.
	 *
	 * @see #ANNOUNCE_MISSING 무엇을 왜 넣고 뺐는지
	 */
	public static boolean announcesMissingForecast(PlaceCategory category) {
		return category != null && ANNOUNCE_MISSING.contains(category.code());
	}

	/**
	 * 설문 코스의 슬롯에 올릴 수 있는 분류인가.
	 *
	 * <p>분류를 모르는 장소({@code null})는 <b>올리지 않는다.</b> 무엇인지 모르는 것을
	 * 코스에 넣으면 근거 문구에 적을 이름조차 없다.
	 *
	 * <p>이 판단이 화면이 아니라 여기 있는 이유는 {@link #FORECAST_TARGETS}와 같다 —
	 * 무엇을 코스에 올릴지가 바뀌면 이 파일만 고치면 된다.
	 *
	 * @see #NOT_FOR_COURSE 무엇을 왜 뺐는지
	 * @see #VE_NOT_TOURABLE {@code VE} 안에서 한 번 더 거르는 것
	 */
	public static boolean isCourseCandidate(PlaceCategory category) {
		return category != null
				&& !NOT_FOR_COURSE.contains(category.code())
				&& isTourable(category);
	}

	/**
	 * 이름이 <b>정확히 같을 때만</b> 이어야 하는 분류인가.
	 *
	 * <p>참이면 포함 매칭을 쓰지 않는다. 상호에 지명이 붙는 분류에서
	 * "다이소 경복궁역점 → 경복궁" 같은 짝이 생기는 것을 막는다.
	 *
	 * @see #EXACT_NAME_ONLY 왜 쇼핑만인지
	 */
	public static boolean requiresExactNameMatch(PlaceCategory category) {
		return category != null && EXACT_NAME_ONLY.contains(category.code());
	}
}
