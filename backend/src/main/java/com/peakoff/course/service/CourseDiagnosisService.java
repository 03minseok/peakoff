package com.peakoff.course.service;

import java.time.LocalDate;
import java.util.List;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import com.peakoff.congestion.domain.CongestionProvider;
import com.peakoff.course.domain.Course;
import com.peakoff.course.domain.CourseSlot;
import com.peakoff.course.dto.CourseDiagnosisRequest;
import com.peakoff.course.dto.CourseDiagnosisResponse;
import com.peakoff.global.error.NotFoundException;
import com.peakoff.place.domain.Place;
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

	private CourseSlot diagnoseSlot(CourseDiagnosisRequest.SlotRequest slotRequest, LocalDate startDate) {
		Place place = placeService.getById(slotRequest.placeId());

		// 2일차 슬롯은 시작일 다음 날 기준으로 본다. 날짜가 다르면 같은 장소라도 한적도가 다르다.
		LocalDate visitDate = startDate.plusDays(slotRequest.day() - 1L);

		if (!congestionProvider.hasData(place.id())) {
			throw new NotFoundException("혼잡 예측 데이터가 없는 장소입니다: " + place.name());
		}
		int quietness = congestionProvider.quietnessOf(place.id(), visitDate);

		return new CourseSlot(slotRequest.day(), slotRequest.order(), place, quietness);
	}

}
