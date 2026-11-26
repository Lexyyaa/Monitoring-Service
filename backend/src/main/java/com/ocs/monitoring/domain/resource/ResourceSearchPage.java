package com.ocs.monitoring.domain.resource;

import java.util.List;

/************************************************************
 * 검색 결과 한 페이지
 * 저장소가 한 건 더 읽어 올 때 넘친 한 건이 있으면 다음 페이지가 있다고 판단한다
 * 총건수를 세지 않음으로써 결과가 많아도 COUNT 쿼리 비용이 들지 않는다
 ************************************************************/
public record ResourceSearchPage(List<ResourceSearchItem> items, boolean hasNext) {

    public static ResourceSearchPage of(List<ResourceSearchItem> rows) {
        int pageSize = SearchPageRequest.PAGE_SIZE;
        return new ResourceSearchPage(rows.stream().limit(pageSize).toList(), rows.size() > pageSize);
    }
}
