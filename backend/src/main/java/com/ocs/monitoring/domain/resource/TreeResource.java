package com.ocs.monitoring.domain.resource;

import java.time.Instant;

/************************************************************
 * 트리 한 행
 * 목록을 만들 때 상세 속성 없이 이름, 상태, 심각도, 변경 시각만 담는다
 * 만들 때 필터를 함께 받음으로써 matchRole을 한 곳에서 정한다 (필터가 없으면 null)
 ************************************************************/
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
