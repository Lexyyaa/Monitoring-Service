package com.ocs.monitoring.application.resource;

import lombok.AccessLevel;
import lombok.NoArgsConstructor;

/************************************************************
 * Application 입력
 * Controller가 요청을 넘길 때 HTTP 값을 문자열 그대로 담는다
 * 그대로 담음으로써 enum 변환과 업무 값 해석을 Application에 모은다
 ************************************************************/
@NoArgsConstructor(access = AccessLevel.PRIVATE)
public final class ResourceCommand {

    public record Clusters(String issueLevel) {}

    public record Nodes(long clusterId, String issueLevel) {}

    public record Namespaces(long nodeId, String issueLevel) {}

    public record Pods(long nodeId, long namespaceId, String issueLevel) {}

    public record Search(String query, String issueLevel, int page) {}

    public record Detail(String resourceType, long resourceId, Long nodeId) {}
}
