package com.ocs.monitoring.domain.resource;

import java.util.List;

/** 트리의 직접 하위 목록. 펼친 부모의 한 단계만 읽는다 */
public interface ResourceTreeRepository {

    List<TreeResource> findClusters();

    List<TreeResource> findNodes(long clusterId);

    /** 이 Node에 Pod가 배치된 Namespace (중복 없음) */
    List<TreeResource> findNamespaces(long nodeId);

    /** Node와 Namespace를 함께 만족하는 Pod */
    List<TreeResource> findPods(long nodeId, long namespaceId);
}
