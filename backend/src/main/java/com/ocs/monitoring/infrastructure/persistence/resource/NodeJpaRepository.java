package com.ocs.monitoring.infrastructure.persistence.resource;

import com.ocs.monitoring.domain.resource.Node;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NodeJpaRepository extends JpaRepository<Node, Long> {}
