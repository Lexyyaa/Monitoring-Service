package com.ocs.monitoring.infrastructure.persistence.resource;

import static com.ocs.monitoring.domain.resource.QCluster.cluster;
import static com.ocs.monitoring.domain.resource.QNamespace.namespace;
import static com.ocs.monitoring.domain.resource.QNode.node;
import static com.ocs.monitoring.domain.resource.QPod.pod;

import com.ocs.monitoring.domain.resource.ResourceTreeRepository;
import com.ocs.monitoring.domain.resource.ResourceType;
import com.ocs.monitoring.domain.resource.TreeResource;
import com.querydsl.jpa.JPAExpressions;
import com.querydsl.jpa.impl.JPAQueryFactory;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

/************************************************************
 * 트리 조회 (QueryDSL)
 * 목록에 필요한 컬럼만 프로젝션하고, 정렬은 이름·ID 순서로 DB에서 처리한다
 ************************************************************/
@Repository
@RequiredArgsConstructor
public class ResourceTreeRepositoryImpl implements ResourceTreeRepository {

    private final JPAQueryFactory queryFactory;

    @Override
    public List<TreeResource> findClusters() {
        return queryFactory
                .select(cluster.id, cluster.name, cluster.controlPlaneStatus, cluster.issueLevel, cluster.lastUpdatedAt)
                .from(cluster)
                .orderBy(cluster.name.asc(), cluster.id.asc())
                .fetch()
                .stream()
                .map(row -> new TreeResource(
                        row.get(cluster.id),
                        ResourceType.CLUSTER,
                        row.get(cluster.name),
                        row.get(cluster.controlPlaneStatus),
                        row.get(cluster.issueLevel),
                        row.get(cluster.lastUpdatedAt)))
                .toList();
    }

    @Override
    public List<TreeResource> findNodes(long clusterId) {
        return queryFactory
                .select(node.id, node.name, node.readyCondition, node.issueLevel, node.lastUpdatedAt)
                .from(node)
                .where(node.clusterId.eq(clusterId))
                .orderBy(node.name.asc(), node.id.asc())
                .fetch()
                .stream()
                .map(row -> new TreeResource(
                        row.get(node.id),
                        ResourceType.NODE,
                        row.get(node.name),
                        row.get(node.readyCondition),
                        row.get(node.issueLevel),
                        row.get(node.lastUpdatedAt)))
                .toList();
    }

    /************************************************************
     * DB에는 Node-Namespace 관계가 없으므로 이 Node에 Pod가 배치된 Namespace를 도출한다
     * EXISTS로 찾으므로 Pod가 여러 개여도 Namespace는 한 행이다
     ************************************************************/
    @Override
    public List<TreeResource> findNamespaces(long nodeId) {
        return queryFactory
                .select(namespace.id, namespace.name, namespace.phase, namespace.issueLevel, namespace.lastUpdatedAt)
                .from(namespace)
                .where(JPAExpressions.selectOne()
                        .from(pod)
                        .where(pod.namespaceId.eq(namespace.id), pod.nodeId.eq(nodeId))
                        .exists())
                .orderBy(namespace.name.asc(), namespace.id.asc())
                .fetch()
                .stream()
                .map(row -> new TreeResource(
                        row.get(namespace.id),
                        ResourceType.NAMESPACE,
                        row.get(namespace.name),
                        row.get(namespace.phase),
                        row.get(namespace.issueLevel),
                        row.get(namespace.lastUpdatedAt)))
                .toList();
    }

    @Override
    public List<TreeResource> findPods(long nodeId, long namespaceId) {
        return queryFactory
                .select(pod.id, pod.name, pod.phase, pod.issueLevel, pod.lastUpdatedAt)
                .from(pod)
                .where(pod.nodeId.eq(nodeId), pod.namespaceId.eq(namespaceId))
                .orderBy(pod.name.asc(), pod.id.asc())
                .fetch()
                .stream()
                .map(row -> new TreeResource(
                        row.get(pod.id),
                        ResourceType.POD,
                        row.get(pod.name),
                        row.get(pod.phase),
                        row.get(pod.issueLevel),
                        row.get(pod.lastUpdatedAt)))
                .toList();
    }
}
