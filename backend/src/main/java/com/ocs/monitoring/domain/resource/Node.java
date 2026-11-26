package com.ocs.monitoring.domain.resource;

import com.ocs.monitoring.domain.resource.exception.ResourceException;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.Immutable;

/************************************************************
 * Node 엔티티 (nodes 테이블, Cluster에 속함)
 * Pod 목록을 요청받을 때 함께 받은 Namespace가 같은 Cluster인지 직접 확인한다
 * 이 규칙을 Node가 가짐으로써 서비스에 업무 판단용 if를 두지 않는다 (ADR-008)
 * @Immutable로 둠으로써 조회 전용임을 보장한다 (변경 감지, UPDATE 없음)
 ************************************************************/
@Entity
@Immutable
@Table(name = "nodes")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Node {

    @Id
    private Long id;

    @Column(name = "cluster_id", nullable = false)
    private Long clusterId;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "ready_condition", nullable = false)
    private String readyCondition;

    @Column(name = "cpu_usage_percent")
    private BigDecimal cpuUsagePercent;

    @Column(name = "memory_usage_percent")
    private BigDecimal memoryUsagePercent;

    @Column(name = "disk_usage_percent")
    private BigDecimal diskUsagePercent;

    @Enumerated(EnumType.STRING)
    @Column(name = "issue_level", nullable = false)
    private IssueLevel issueLevel;

    @Column(name = "issue_reason")
    private String issueReason;

    @Column(name = "last_updated_at", nullable = false)
    private Instant lastUpdatedAt;

    /************************************************************
     * 소속 규칙 : 트리의 Node → Namespace 경로는 같은 Cluster 안에서만 성립한다
     * 다른 Cluster의 조합은 없는 경로로 본다 (404)
     ************************************************************/
    public void requireSameCluster(Namespace namespace) {
        if (!clusterId.equals(namespace.getClusterId())) {
            throw ResourceException.notFound();
        }
    }

    /************************************************************
     * 상세와 탐색 경로
     ************************************************************/
    public PathSegment toPathSegment() {
        return new PathSegment(ResourceType.NODE, id, name);
    }

    public ResourceDetail toDetail(Cluster cluster) {
        Map<String, Object> attributes = new LinkedHashMap<>();
        attributes.put("readyCondition", readyCondition);
        attributes.put("cpuUsagePercent", cpuUsagePercent);
        attributes.put("memoryUsagePercent", memoryUsagePercent);
        attributes.put("diskUsagePercent", diskUsagePercent);
        return new ResourceDetail(
                id,
                ResourceType.NODE,
                name,
                readyCondition,
                issueLevel,
                issueReason,
                lastUpdatedAt,
                List.of(cluster.toPathSegment(), toPathSegment()),
                attributes);
    }
}
