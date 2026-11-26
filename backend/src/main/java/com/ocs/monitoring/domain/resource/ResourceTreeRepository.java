package com.ocs.monitoring.domain.resource;

import java.util.List;

/************************************************************
 * 트리 조회 저장소 계약
 * 부모를 펼칠 때 그 부모의 직접 하위 한 단계만 읽는다
 * filter가 있으면 자기 일치(MATCH)와, 트리로 도달할 수 있는 하위에 일치가 있는 경로(PATH)만 남긴다
 ************************************************************/
public interface ResourceTreeRepository {

    List<TreeResource> findClusters(IssueLevel filter);

    List<TreeResource> findNodes(long clusterId, IssueLevel filter);

    /** 이 Node에 Pod가 배치된 Namespace (중복 없음) */
    List<TreeResource> findNamespaces(long nodeId, IssueLevel filter);

    /** Node와 Namespace를 함께 만족하는 Pod. filter가 있으면 그 심각도인 Pod만 */
    List<TreeResource> findPods(long nodeId, long namespaceId, IssueLevel filter);
}
