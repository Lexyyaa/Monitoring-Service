package com.ocs.monitoring.support.exception;

import com.ocs.monitoring.domain.exception.ErrorCode;

/************************************************************
 * 오류 응답 본문 {code, message}
 * 예외를 응답으로 바꿀 때 ErrorCode에서만 만듦으로써 정해진 코드와 문구만 나가게 한다
 ************************************************************/
public record ErrorResponse(String code, String message) {

    public static ErrorResponse from(ErrorCode errorCode) {
        return new ErrorResponse(errorCode.name(), errorCode.getMessage());
    }
}
