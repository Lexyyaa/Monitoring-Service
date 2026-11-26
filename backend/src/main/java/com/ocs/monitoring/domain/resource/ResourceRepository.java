package com.ocs.monitoring.domain.resource;

import java.util.Optional;

/************************************************************
 * 단건 조회 저장소 계약
 * 서비스가 부모나 상세 대상을 확인할 때 ID로 읽는다. 판단은 하지 않는다
 * 계약을 Domain에 둠으로써 Domain이 JPA, QueryDSL을 몰라도 되게 한다 (구현은 Infrastructure)
 ************************************************************/
public interface ResourceRepository {

    Optional<Cluster> findCluster(long id);

    Optional<Node> findNode(long id);

    Optional<Namespace> findNamespace(long id);

    /** Pod와 부모 세 개를 한 번에 읽는다 (Pod 상세용, 조인 1회) */
    Optional<PodLocation> findPodLocation(long id);

    /** 이 Namespace의 Pod가 있는 Node 중 가장 작은 ID (경로를 지정하지 않은 상세의 대표 경로) */
    Optional<Node> findRepresentativeHostNode(Namespace namespace);

    /** 지정한 Node에 이 Namespace의 Pod가 있을 때만 그 Node */
    Optional<Node> findHostNode(Namespace namespace, long nodeId);
}
