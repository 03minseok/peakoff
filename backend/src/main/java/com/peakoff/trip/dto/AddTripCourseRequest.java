package com.peakoff.trip.dto;

import jakarta.validation.constraints.NotNull;

public record AddTripCourseRequest(
		@NotNull(message = "담을 코스를 골라 주세요.")
		Long courseId) {
}
