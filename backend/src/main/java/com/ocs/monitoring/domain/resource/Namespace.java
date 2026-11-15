package com.ocs.monitoring.domain.resource;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
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
}
