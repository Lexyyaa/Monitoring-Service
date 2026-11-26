package com.ocs.monitoring.domain.resource;

import java.time.Instant;
import java.util.List;

/************************************************************
 * 검색 결과 한 건
 * 탐색 경로를 함께 담음으로써 화면이 결과를 고르면 트리 위치를 바로 열 수 있게 한다
 ************************************************************/
public record ResourceSearchItem(
        long id,
        ResourceType resourceType,
        String name,
        String statusCode,
        IssueLevel issueLevel,
        Instant lastUpdatedAt,
        List<PathSegment> path) {}
