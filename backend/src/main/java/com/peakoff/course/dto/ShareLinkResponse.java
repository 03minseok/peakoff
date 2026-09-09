package com.peakoff.course.dto;

/**
 * 공유 링크의 열쇠. 화면이 {@code {origin}/s/{token}}으로 이어 붙인다 — 주소의 앞부분(어느 배포본인지)은
 * 서버가 아니라 화면이 안다. 서버가 완성 주소를 만들면 미리보기 배포(vercel 프리뷰)에서 운영 주소가 나간다.
 */
public record ShareLinkResponse(String token) {
}
