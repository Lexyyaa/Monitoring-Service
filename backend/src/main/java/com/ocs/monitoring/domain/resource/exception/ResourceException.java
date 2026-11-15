package com.ocs.monitoring.domain.resource.exception;

import com.ocs.monitoring.domain.exception.BusinessException;
import com.ocs.monitoring.domain.exception.ErrorCode;

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
