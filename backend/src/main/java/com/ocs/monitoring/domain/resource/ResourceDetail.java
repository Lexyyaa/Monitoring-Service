package com.ocs.monitoring.domain.resource;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/************************************************************
 * 상세 결과 (네 종류 공통 모양)
 * 상세를 요청받을 때 엔티티가 자기 속성과 경로를 이 모양으로 만든다
 * 종류마다 다른 값을 attributes에 담음으로써 상세 응답 하나로 네 종류를 표현한다
 ************************************************************/
public record ResourceDetail(
        long id,
        ResourceType resourceType,
        String name,
        String statusCode,
        IssueLevel issueLevel,
        String issueReason,
        Instant lastUpdatedAt,
        List<PathSegment> path,
        Map<String, Object> attributes) {}
