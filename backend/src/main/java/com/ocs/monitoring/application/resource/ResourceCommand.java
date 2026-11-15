package com.ocs.monitoring.application.resource;

import lombok.AccessLevel;
import lombok.NoArgsConstructor;

@NoArgsConstructor(access = AccessLevel.PRIVATE)
public final class ResourceCommand {

    public record Clusters(String issueLevel) {}

    public record Nodes(long clusterId, String issueLevel) {}

    public record Namespaces(long nodeId, String issueLevel) {}

    public record Pods(long nodeId, long namespaceId, String issueLevel) {}

    public record Search(String query, String issueLevel, int page) {}

    public record Detail(String resourceType, long resourceId, Long nodeId) {}
}
