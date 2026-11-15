package com.ocs.monitoring.domain.resource;

import com.ocs.monitoring.domain.resource.exception.ResourceException;

/** 앞뒤 공백을 지운 검색어. 1~200자가 아니면 400 */
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
