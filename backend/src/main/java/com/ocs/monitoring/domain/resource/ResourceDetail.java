package com.ocs.monitoring.domain.resource;

import java.time.Instant;
import java.util.List;
import java.util.Map;

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
