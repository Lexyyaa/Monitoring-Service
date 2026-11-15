package com.ocs.monitoring.domain.resource;

import java.time.Instant;

/** 트리 한 행. 목록에는 상세 속성을 넣지 않는다 */
public record TreeResource(
        long id,
        ResourceType resourceType,
        String name,
        String statusCode,
        IssueLevel issueLevel,
        Instant lastUpdatedAt) {}
