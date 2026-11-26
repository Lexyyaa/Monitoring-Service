package com.ocs.monitoring.domain.resource;

import com.ocs.monitoring.domain.resource.exception.ResourceException;

/************************************************************
 * 검색어 값 객체
 * 검색을 요청받을 때 앞뒤 공백을 지우고 1~200자가 아니면 400으로 막는다
 * 검증을 값 객체에 둠으로써 저장소에는 항상 유효한 검색어만 들어간다
 ************************************************************/
public record SearchKeyword(String value) {

    public static final int MAX_LENGTH = 200;

    public static SearchKeyword of(String raw) {
        String trimmed = raw == null ? "" : raw.trim();
        if (trimmed.isEmpty() || trimmed.length() > MAX_LENGTH) {
            throw ResourceException.invalidParameter();
        }
        return new SearchKeyword(trimmed);
    }
}
