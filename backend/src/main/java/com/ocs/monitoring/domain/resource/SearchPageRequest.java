package com.ocs.monitoring.domain.resource;

/************************************************************
 * 검색 페이지 요청 (0부터 시작)
 * 검색할 때 offset과 읽을 건수를 계산한다. 20건 페이지를 위해 21건을 읽는다
 * offset을 multiplyExact로 계산함으로써 아주 큰 page 값이 조용히 음수로 넘치지 않고 예외가 나게 한다
 ************************************************************/
public record SearchPageRequest(int page) {

    public static final int PAGE_SIZE = 20;

    public long offset() {
        return Math.multiplyExact((long) page, PAGE_SIZE);
    }

    public int fetchSize() {
        return PAGE_SIZE + 1;
    }
}
