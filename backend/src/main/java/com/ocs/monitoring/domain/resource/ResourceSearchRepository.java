package com.ocs.monitoring.domain.resource;

import java.util.List;

/** Cluster·Node·Namespace·Pod 이름 부분 검색. 정렬과 페이지는 DB에서 처리한다 */
public interface ResourceSearchRepository {

    List<ResourceSearchItem> search(String keyword, long offset, int limit);
}
