package com.ocs.monitoring.domain.resource;

import java.util.List;

/** Cluster·Node·Namespace·Pod 이름 부분 검색. 정렬과 페이지는 DB에서 처리하고, filter는 이름 조건과 AND다 */
public interface ResourceSearchRepository {

    List<ResourceSearchItem> search(String keyword, IssueLevel filter, long offset, int limit);
}
