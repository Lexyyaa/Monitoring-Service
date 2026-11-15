package com.ocs.monitoring.support.exception;

import com.ocs.monitoring.domain.exception.ErrorCode;

public record ErrorResponse(String code, String message) {

    public static ErrorResponse from(ErrorCode errorCode) {
        return new ErrorResponse(errorCode.name(), errorCode.getMessage());
    }
}
