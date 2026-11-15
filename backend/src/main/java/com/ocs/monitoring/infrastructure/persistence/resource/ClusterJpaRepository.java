package com.ocs.monitoring.infrastructure.persistence.resource;

import com.ocs.monitoring.domain.resource.Cluster;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ClusterJpaRepository extends JpaRepository<Cluster, Long> {}
