package com.ocs.monitoring.domain.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/************************************************************
 * 업무 오류 코드와 사용자 안내 문구
 * 예외를 응답으로 바꿀 때 GlobalExceptionHandler가 이 코드로 HTTP 상태와 문구를 정한다
 * 문구를 코드와 함께 고정함으로써 응답에 내부 메시지가 섞이지 않게 한다
 ************************************************************/
@Getter
@RequiredArgsConstructor
public enum ErrorCode {
    INVALID_PARAMETER("요청 파라미터를 확인해 주세요."),
    RESOURCE_NOT_FOUND("해당 리소스 또는 경로를 찾을 수 없습니다."),
    METHOD_NOT_ALLOWED("지원하지 않는 HTTP 메서드입니다."),
    INTERNAL_ERROR("요청을 처리하지 못했습니다."),
    SERVICE_UNAVAILABLE("데이터를 일시적으로 조회할 수 없습니다.");

    private final String message;
}
