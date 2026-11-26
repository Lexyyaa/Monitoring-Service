package com.ocs.monitoring.domain.exception;

import lombok.Getter;

/************************************************************
 * 업무 예외의 부모
 * Domain이 업무 규칙 위반을 만날 때 ErrorCode를 담아 던진다
 * ErrorCode만 들게 함으로써 Domain이 HTTP 상태를 몰라도 되게 한다
 ************************************************************/
@Getter
public abstract class BusinessException extends RuntimeException {

    private final ErrorCode errorCode;

    protected BusinessException(ErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }
}
