package com.ocs.monitoring.infrastructure.persistence.resource;

import com.ocs.monitoring.domain.resource.Node;
import org.springframework.data.jpa.repository.JpaRepository;

/************************************************************
 * Node 단건 조회용 Spring Data JPA 저장소
 * ResourceRepositoryImpl이 ID로 Node를 읽을 때 쓴다
 ************************************************************/
public interface NodeJpaRepository extends JpaRepository<Node, Long> {}
