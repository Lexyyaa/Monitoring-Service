package com.ocs.monitoring.domain.resource;

import java.util.List;

/** 한 건 더 읽은 결과로 다음 페이지 여부를 판단한다 (총건수 집계 없음) */
public record ResourceSearchPage(List<ResourceSearchItem> items, boolean hasNext) {

    public static ResourceSearchPage of(List<ResourceSearchItem> rows) {
        int pageSize = SearchPageRequest.PAGE_SIZE;
        return new ResourceSearchPage(rows.stream().limit(pageSize).toList(), rows.size() > pageSize);
    }
}
