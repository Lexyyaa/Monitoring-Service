package com.ocs.monitoring.infrastructure.persistence.resource;

import com.ocs.monitoring.domain.resource.Namespace;
import org.springframework.data.jpa.repository.JpaRepository;

/************************************************************
 * Namespace 단건 조회용 Spring Data JPA 저장소
 * ResourceRepositoryImpl이 ID로 Namespace를 읽을 때 쓴다
 ************************************************************/
public interface NamespaceJpaRepository extends JpaRepository<Namespace, Long> {}
