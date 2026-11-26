package com.ocs.monitoring.domain.resource;

import java.util.List;

/************************************************************
 * 통합 검색 저장소 계약
 * 검색을 요청받을 때 네 종류의 이름을 부분 일치로 찾고, 정렬과 페이지는 DB에서 처리한다
 * filter는 이름 조건과 AND로 건다
 ************************************************************/
public interface ResourceSearchRepository {

    List<ResourceSearchItem> search(String keyword, IssueLevel filter, long offset, int limit);
}
