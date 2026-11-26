package com.ocs.monitoring.domain.resource;

import com.ocs.monitoring.domain.resource.exception.ResourceException;

/************************************************************
 * 리소스 심각도 (NONE, WARNING, ERROR, UNKNOWN)
 * 필터 파라미터를 받을 때 문자열을 심각도로 바꾸고, 비었으면 필터 없음(null)으로 본다
 * 잘못된 값을 여기서 400으로 막음으로써 저장소에 알 수 없는 필터가 들어가지 않게 한다
 ************************************************************/
public enum IssueLevel {
    NONE,
    WARNING,
    ERROR,
    UNKNOWN;

    public static IssueLevel from(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return valueOf(value.trim());
        } catch (IllegalArgumentException e) {
            throw ResourceException.invalidParameter();
        }
    }
}
