package com.ocs.monitoring.domain.resource.exception;

import com.ocs.monitoring.domain.exception.BusinessException;
import com.ocs.monitoring.domain.exception.ErrorCode;

/************************************************************
 * 리소스 조회의 업무 예외
 * 없는 리소스나 경로를 만날 때 notFound(404), 잘못된 입력을 만날 때 invalidParameter(400)를 던진다
 * 상황 이름의 정적 메서드로 만듦으로써 호출하는 쪽이 오류 코드를 직접 고르지 않게 한다
 ************************************************************/
public class ResourceException extends BusinessException {

    public ResourceException(ErrorCode errorCode) {
        super(errorCode);
    }

    /** 없는 리소스 또는 잘못된 상하위 경로 (404) */
    public static ResourceException notFound() {
        return new ResourceException(ErrorCode.RESOURCE_NOT_FOUND);
    }

    /** 잘못된 ID·종류·심각도·nodeId (400) */
    public static ResourceException invalidParameter() {
        return new ResourceException(ErrorCode.INVALID_PARAMETER);
    }
}
