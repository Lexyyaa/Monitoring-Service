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
@Table(name = "namespaces")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Namespace {

    @Id
    private Long id;

    @Column(name = "cluster_id", nullable = false)
    private Long clusterId;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "phase", nullable = false)
    private String phase;

    @Column(name = "cpu_quota_used_millicores")
    private Long cpuQuotaUsedMillicores;

    @Column(name = "cpu_quota_limit_millicores")
    private Long cpuQuotaLimitMillicores;

    @Column(name = "memory_quota_used_mib")
    private Long memoryQuotaUsedMib;

    @Column(name = "memory_quota_limit_mib")
    private Long memoryQuotaLimitMib;

    @Enumerated(EnumType.STRING)
    @Column(name = "issue_level", nullable = false)
    private IssueLevel issueLevel;

    @Column(name = "issue_reason")
    private String issueReason;

    @Column(name = "last_updated_at", nullable = false)
    private Instant lastUpdatedAt;

    /************************************************************
     * 상세와 탐색 경로
     * 공유 Namespace는 여러 Node 아래에 나타나므로 경로의 Node(pathNode)를 받아서 만든다
     ************************************************************/
    public PathSegment toPathSegment() {
        return new PathSegment(ResourceType.NAMESPACE, id, name);
    }

    public ResourceDetail toDetail(Cluster cluster, Node pathNode) {
        Map<String, Object> attributes = new LinkedHashMap<>();
        attributes.put("phase", phase);
        attributes.put("cpuQuotaUsedMillicores", cpuQuotaUsedMillicores);
        attributes.put("cpuQuotaLimitMillicores", cpuQuotaLimitMillicores);
        attributes.put("memoryQuotaUsedMib", memoryQuotaUsedMib);
        attributes.put("memoryQuotaLimitMib", memoryQuotaLimitMib);
        return new ResourceDetail(
                id,
                ResourceType.NAMESPACE,
                name,
                phase,
                issueLevel,
                issueReason,
                lastUpdatedAt,
                List.of(cluster.toPathSegment(), pathNode.toPathSegment(), toPathSegment()),
                attributes);
    }
}
