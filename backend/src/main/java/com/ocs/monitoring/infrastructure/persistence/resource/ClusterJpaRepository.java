package com.ocs.monitoring.infrastructure.persistence.resource;

import com.ocs.monitoring.domain.resource.Cluster;
import org.springframework.data.jpa.repository.JpaRepository;

/************************************************************
 * Cluster 단건 조회용 Spring Data JPA 저장소
 * ResourceRepositoryImpl이 ID로 Cluster를 읽을 때 쓴다
 ************************************************************/
public interface ClusterJpaRepository extends JpaRepository<Cluster, Long> {}
