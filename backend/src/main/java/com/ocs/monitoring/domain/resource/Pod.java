package com.ocs.monitoring.domain.resource;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.Immutable;

@Entity
@Immutable
@Table(name = "pods")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Pod {

    @Id
    private Long id;

    @Column(name = "cluster_id", nullable = false)
    private Long clusterId;

    @Column(name = "namespace_id", nullable = false)
    private Long namespaceId;

    @Column(name = "node_id", nullable = false)
    private Long nodeId;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "phase", nullable = false)
    private String phase;

    @Column(name = "ready")
    private Boolean ready;

    @Column(name = "restart_count", nullable = false)
    private Integer restartCount;

    @Column(name = "cpu_usage_millicores")
    private Long cpuUsageMillicores;

    @Column(name = "memory_usage_mib")
    private Long memoryUsageMib;

    @Enumerated(EnumType.STRING)
    @Column(name = "issue_level", nullable = false)
    private IssueLevel issueLevel;

    @Column(name = "issue_reason")
    private String issueReason;

    @Column(name = "last_updated_at", nullable = false)
    private Instant lastUpdatedAt;

    /************************************************************
     * 상세와 탐색 경로
     ************************************************************/
    public PathSegment toPathSegment() {
        return new PathSegment(ResourceType.POD, id, name);
    }

    public ResourceDetail toDetail(Cluster cluster, Node node, Namespace namespace) {
        Map<String, Object> attributes = new LinkedHashMap<>();
        attributes.put("phase", phase);
        attributes.put("ready", ready);
        attributes.put("restartCount", restartCount);
        attributes.put("cpuUsageMillicores", cpuUsageMillicores);
        attributes.put("memoryUsageMib", memoryUsageMib);
        return new ResourceDetail(
                id,
                ResourceType.POD,
                name,
                phase,
                issueLevel,
                issueReason,
                lastUpdatedAt,
                List.of(cluster.toPathSegment(), node.toPathSegment(), namespace.toPathSegment(), toPathSegment()),
                attributes);
    }
}
