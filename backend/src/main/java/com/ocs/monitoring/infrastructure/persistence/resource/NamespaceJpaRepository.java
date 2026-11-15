package com.ocs.monitoring.infrastructure.persistence.resource;

import com.ocs.monitoring.domain.resource.Namespace;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NamespaceJpaRepository extends JpaRepository<Namespace, Long> {}
