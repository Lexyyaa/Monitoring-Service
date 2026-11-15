package com.ocs.monitoring.domain.resource;

/** 0부터 시작하는 페이지. 20건 페이지를 위해 21건을 읽는다 */
public record SearchPageRequest(int page) {

    public static final int PAGE_SIZE = 20;

    public long offset() {
        return Math.multiplyExact((long) page, PAGE_SIZE);
    }

    public int fetchSize() {
        return PAGE_SIZE + 1;
    }
}
