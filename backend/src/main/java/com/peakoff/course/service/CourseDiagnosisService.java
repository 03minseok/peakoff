package com.peakoff.course.service;

import java.time.LocalDate;
import java.util.List;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import com.peakoff.congestion.domain.CongestionProvider;
import com.peakoff.congestion.domain.DiagnosisGap;
import com.peakoff.course.domain.Course;
import com.peakoff.course.domain.CourseSlot;
import com.peakoff.course.dto.CourseDiagnosisRequest;
import com.peakoff.course.dto.CourseDiagnosisResponse;
import com.peakoff.global.error.NotFoundException;
import com.peakoff.place.domain.Place;
import com.peakoff.place.domain.PlaceCategories;
import com.peakoff.place.domain.SupportedRegion;
import com.peakoff.place.service.PlaceService;

/**
 * 사용자가 짠 코스를 받아 각 슬롯의 한적도와 코스 총점을 매긴다.
 *
 * <p>서비스가 개입하는 첫 지점이다. 코스를 짜는 동안에는 아무 점수도 끼어들지 않는다.
 */
@Service
@RequiredArgsConstructor
public class CourseDiagnosisService {

	private final PlaceService placeService;
	private final CongestionProvider congestionProvider;

	/**
	 * 요청의 모양(필수값·개수·범위)은 컨트롤러에서 {@code @Valid}가 이미 걸렀다.
	 * 여기서는 그 값들이 업무적으로 말이 되는지만 본다.
	 */
	public CourseDiagnosisResponse diagnose(CourseDiagnosisRequest request) {
		SupportedRegion region = SupportedRegion.fromSlug(request.region());
		List<CourseSlot> slots = request.slots().stream()
				.map(slot -> diagnoseSlot(slot, request.startDate()))
				.toList();

		// 총점(슬롯 한적도의 평균)은 Course.of가 계산한다. 설문 코스 생성도 같은 규칙을 쓴다.
		// Course 생성자가 일차 범위·점수 범위를 다시 검증한다. 여기서 틀리면 400으로 나간다.
		Course course = Course.of(region.toRegion(), request.startDate(), request.nights(), slots);

		return CourseDiagnosisResponse.from(course, region.slug());
	}

	/**
	 * 칸 하나를 진단한다. <b>자료가 없어도 예외를 던지지 않는다.</b>
	 *
	 * <p>예전에는 자료 없는 장소가 하나라도 있으면 404로 요청 전체를 죽였다. 그러면
	 * 밥집이 낀 코스는 진단 자체가 불가능하다 — 공사 집중률에 음식점이 통째로 없기 때문이다.
	 * 그 칸만 "진단 불가"로 표시하고 나머지는 정상적으로 진단한다.
	 *
	 * <p>사유를 두 갈래로 나눠 담는다. 기다리면 생기는 것과 아닌 것을 화면이 다르게 말해야 한다.
	 */
	private CourseSlot diagnoseSlot(CourseDiagnosisRequest.SlotRequest slotRequest, LocalDate startDate) {
		// 장소 자체가 없는 것은 여전히 404다. 요청이 잘못된 것이지 자료가 없는 것이 아니다.
		Place place = placeService.getById(slotRequest.placeId());

		// 2일차 슬롯은 시작일 다음 날 기준으로 본다. 날짜가 다르면 같은 장소라도 한적도가 다르다.
		LocalDate visitDate = startDate.plusDays(slotRequest.day() - 1L);

		if (!congestionProvider.hasData(place.id())) {
			/*
			 * 자료가 없다는 사실은 같지만 사용자에게 할 말이 다르다.
			 *
			 * 관광지인데 없으면 "우리가 못 매겼다"고 밝힌다 — 침묵하면 사용자는 자기가
			 * 잘못 담았다고 생각한다. 반대로 음식점·숙박은 애초에 예측 대상이 아니라
			 * 흔하게 나온다. 밥집마다 안내를 세우면 정작 읽어야 할 점수가 그 사이에 묻힌다.
			 *
			 * ⚠️ <b>"예측을 시도했는가"가 아니라 "말을 걸 분류인가"로 묻는다.</b>
			 * 쇼핑은 시도는 하지만(시장이 이어진다) 실제로 이어지는 것이 극소수라
			 * 침묵하는 쪽이다 — 상점 하나 담을 때마다 안내가 서면 점수가 묻힌다.
			 */
			DiagnosisGap gap = PlaceCategories.announcesMissingForecast(place.category())
					? DiagnosisGap.PLACE_NOT_FORECASTED
					: DiagnosisGap.CATEGORY_NOT_FORECASTED;
			return CourseSlot.undiagnosed(slotRequest.day(), slotRequest.order(), place, gap);
		}
		if (!congestionProvider.hasData(place.id(), visitDate)) {
			return CourseSlot.undiagnosed(
					slotRequest.day(), slotRequest.order(), place, DiagnosisGap.DATE_OUT_OF_FORECAST);
		}

		int quietness = congestionProvider.quietnessOf(place.id(), visitDate);
		return CourseSlot.diagnosed(slotRequest.day(), slotRequest.order(), place, quietness);
	}

}
