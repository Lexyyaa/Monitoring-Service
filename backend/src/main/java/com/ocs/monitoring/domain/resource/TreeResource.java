package com.ocs.monitoring.domain.resource;

import java.time.Instant;

/** 트리 한 행. 목록에는 상세 속성을 넣지 않는다. 필터가 없으면 matchRole은 null이다 */
public record TreeResource(
        long id,
        ResourceType resourceType,
        String name,
        String statusCode,
        IssueLevel issueLevel,
        Instant lastUpdatedAt,
        MatchRole matchRole) {

    public static TreeResource of(
            long id,
            ResourceType resourceType,
            String name,
            String statusCode,
            IssueLevel issueLevel,
            Instant lastUpdatedAt,
            IssueLevel filter) {
        return new TreeResource(
                id, resourceType, name, statusCode, issueLevel, lastUpdatedAt, MatchRole.of(issueLevel, filter));
    }
}
