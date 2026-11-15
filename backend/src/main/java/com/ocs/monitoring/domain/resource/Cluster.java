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
@Table(name = "clusters")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Cluster {

    @Id
    private Long id;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "control_plane_status", nullable = false)
    private String controlPlaneStatus;

    @Column(name = "kubernetes_version")
    private String kubernetesVersion;

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
        return new PathSegment(ResourceType.CLUSTER, id, name);
    }

    public ResourceDetail toDetail() {
        Map<String, Object> attributes = new LinkedHashMap<>();
        attributes.put("controlPlaneStatus", controlPlaneStatus);
        attributes.put("kubernetesVersion", kubernetesVersion);
        return new ResourceDetail(
                id,
                ResourceType.CLUSTER,
                name,
                controlPlaneStatus,
                issueLevel,
                issueReason,
                lastUpdatedAt,
                List.of(toPathSegment()),
                attributes);
    }
}
