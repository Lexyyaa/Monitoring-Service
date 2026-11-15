package com.ocs.monitoring.application.resource;

import lombok.AccessLevel;
import lombok.NoArgsConstructor;

@NoArgsConstructor(access = AccessLevel.PRIVATE)
public final class ResourceCommand {

    public record Nodes(long clusterId) {}

    public record Namespaces(long nodeId) {}

    public record Pods(long nodeId, long namespaceId) {}

    public record Detail(String resourceType, long resourceId, Long nodeId) {}
}
