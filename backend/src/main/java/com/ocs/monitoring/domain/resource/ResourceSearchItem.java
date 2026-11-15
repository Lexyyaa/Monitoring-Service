package com.ocs.monitoring.domain.resource;

import java.time.Instant;
import java.util.List;

public record ResourceSearchItem(
        long id,
        ResourceType resourceType,
        String name,
        String statusCode,
        IssueLevel issueLevel,
        Instant lastUpdatedAt,
        List<PathSegment> path) {}
