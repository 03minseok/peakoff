package com.peakoff.trip.dto;

import com.peakoff.trip.domain.Trip;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateTripRequest(
		@NotBlank(message = "여행 이름을 입력해 주세요.")
		@Size(max = Trip.NAME_MAX_LENGTH, message = "여행 이름은 " + Trip.NAME_MAX_LENGTH + "자까지입니다.")
		String name) {
}
