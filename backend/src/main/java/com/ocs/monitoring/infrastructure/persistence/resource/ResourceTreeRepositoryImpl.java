package com.ocs.monitoring.infrastructure.persistence.resource;

import static com.ocs.monitoring.domain.resource.QCluster.cluster;
import static com.ocs.monitoring.domain.resource.QNamespace.namespace;
import static com.ocs.monitoring.domain.resource.QNode.node;
import static com.ocs.monitoring.domain.resource.QPod.pod;

import com.ocs.monitoring.domain.resource.IssueLevel;
import com.ocs.monitoring.domain.resource.QPod;
import com.ocs.monitoring.domain.resource.ResourceTreeRepository;
import com.ocs.monitoring.domain.resource.ResourceType;
import com.ocs.monitoring.domain.resource.TreeResource;
import com.querydsl.core.types.dsl.BooleanExpression;
import com.querydsl.jpa.JPAExpressions;
import com.querydsl.jpa.impl.JPAQueryFactory;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

/************************************************************
 * 트리 조회 (QueryDSL)
 * 목록에 필요한 컬럼만 프로젝션하고, 정렬은 이름·ID 순서로 DB에서 처리한다
 * 필터는 자기 일치 OR 하위 EXISTS로 만든다. 하위 근거는 트리에서 펼쳐 도달할 수 있는 리소스만 쓴다
 ************************************************************/
@Repository
@RequiredArgsConstructor
public class ResourceTreeRepositoryImpl implements ResourceTreeRepository {

    /** 하위 조건 안에서 바깥 pod와 겹치지 않게 쓰는 별칭 */
    private static final QPod filterPod = new QPod("filterPod");

    private final JPAQueryFactory queryFactory;

    @Override
    public List<TreeResource> findClusters(IssueLevel filter) {
        return queryFactory
                .select(cluster.id, cluster.name, cluster.controlPlaneStatus, cluster.issueLevel, cluster.lastUpdatedAt)
                .from(cluster)
                .where(clusterFilter(filter))
                .orderBy(cluster.name.asc(), cluster.id.asc())
                .fetch()
                .stream()
                .map(row -> TreeResource.of(
                        row.get(cluster.id),
                        ResourceType.CLUSTER,
                        row.get(cluster.name),
                        row.get(cluster.controlPlaneStatus),
                        row.get(cluster.issueLevel),
                        row.get(cluster.lastUpdatedAt),
                        filter))
                .toList();
    }

    @Override
    public List<TreeResource> findNodes(long clusterId, IssueLevel filter) {
        return queryFactory
                .select(node.id, node.name, node.readyCondition, node.issueLevel, node.lastUpdatedAt)
                .from(node)
                .where(node.clusterId.eq(clusterId), nodeFilter(filter))
                .orderBy(node.name.asc(), node.id.asc())
                .fetch()
                .stream()
                .map(row -> TreeResource.of(
                        row.get(node.id),
                        ResourceType.NODE,
                        row.get(node.name),
                        row.get(node.readyCondition),
                        row.get(node.issueLevel),
                        row.get(node.lastUpdatedAt),
                        filter))
                .toList();
    }

    /************************************************************
     * DB에는 Node-Namespace 관계가 없으므로 이 Node에 Pod가 배치된 Namespace를 도출한다
     * EXISTS로 찾으므로 Pod가 여러 개여도 Namespace는 한 행이다
     ************************************************************/
    @Override
    public List<TreeResource> findNamespaces(long nodeId, IssueLevel filter) {
        return queryFactory
                .select(namespace.id, namespace.name, namespace.phase, namespace.issueLevel, namespace.lastUpdatedAt)
                .from(namespace)
                .where(
                        JPAExpressions.selectOne()
                                .from(pod)
                                .where(pod.namespaceId.eq(namespace.id), pod.nodeId.eq(nodeId))
                                .exists(),
                        namespaceFilter(nodeId, filter))
                .orderBy(namespace.name.asc(), namespace.id.asc())
                .fetch()
                .stream()
                .map(row -> TreeResource.of(
                        row.get(namespace.id),
                        ResourceType.NAMESPACE,
                        row.get(namespace.name),
                        row.get(namespace.phase),
                        row.get(namespace.issueLevel),
                        row.get(namespace.lastUpdatedAt),
                        filter))
                .toList();
    }

    @Override
    public List<TreeResource> findPods(long nodeId, long namespaceId, IssueLevel filter) {
        return queryFactory
                .select(pod.id, pod.name, pod.phase, pod.issueLevel, pod.lastUpdatedAt)
                .from(pod)
                .where(
                        pod.nodeId.eq(nodeId),
                        pod.namespaceId.eq(namespaceId),
                        filter == null ? null : pod.issueLevel.eq(filter))
                .orderBy(pod.name.asc(), pod.id.asc())
                .fetch()
                .stream()
                .map(row -> TreeResource.of(
                        row.get(pod.id),
                        ResourceType.POD,
                        row.get(pod.name),
                        row.get(pod.phase),
                        row.get(pod.issueLevel),
                        row.get(pod.lastUpdatedAt),
                        filter))
                .toList();
    }

    /************************************************************
     * 필터 조건 (filter가 null이면 조건 없음)
     ************************************************************/

    /**
     * Cluster : 자기 일치, 일치하는 Node, 일치하는 Pod, 또는 Pod가 있는 일치 Namespace
     * Pod가 없는 Namespace는 어떤 Node 아래에도 나타나지 않으므로 경로 근거에서 뺀다
     */
    private BooleanExpression clusterFilter(IssueLevel filter) {
        if (filter == null) {
            return null;
        }
        return cluster.issueLevel
                .eq(filter)
                .or(JPAExpressions.selectOne()
                        .from(node)
                        .where(node.clusterId.eq(cluster.id), node.issueLevel.eq(filter))
                        .exists())
                .or(JPAExpressions.selectOne()
                        .from(namespace)
                        .where(
                                namespace.clusterId.eq(cluster.id),
                                namespace.issueLevel.eq(filter),
                                JPAExpressions.selectOne()
                                        .from(filterPod)
                                        .where(filterPod.namespaceId.eq(namespace.id))
                                        .exists())
                        .exists())
                .or(JPAExpressions.selectOne()
                        .from(pod)
                        .where(pod.clusterId.eq(cluster.id), pod.issueLevel.eq(filter))
                        .exists());
    }

    /** Node : 자기 일치, 이 Node에서 실행 중인 일치 Pod, 또는 이 Node에 Pod가 있는 일치 Namespace */
    private BooleanExpression nodeFilter(IssueLevel filter) {
        if (filter == null) {
            return null;
        }
        return node.issueLevel
                .eq(filter)
                .or(JPAExpressions.selectOne()
                        .from(namespace)
                        .where(
                                namespace.clusterId.eq(node.clusterId),
                                namespace.issueLevel.eq(filter),
                                JPAExpressions.selectOne()
                                        .from(pod)
                                        .where(pod.nodeId.eq(node.id), pod.namespaceId.eq(namespace.id))
                                        .exists())
                        .exists())
                .or(JPAExpressions.selectOne()
                        .from(filterPod)
                        .where(filterPod.nodeId.eq(node.id), filterPod.issueLevel.eq(filter))
                        .exists());
    }

    /** Node 아래 Namespace : 자기 일치, 또는 이 Node에 있는 이 Namespace의 일치 Pod */
    private BooleanExpression namespaceFilter(long nodeId, IssueLevel filter) {
        if (filter == null) {
            return null;
        }
        return namespace
                .issueLevel
                .eq(filter)
                .or(JPAExpressions.selectOne()
                        .from(filterPod)
                        .where(
                                filterPod.namespaceId.eq(namespace.id),
                                filterPod.nodeId.eq(nodeId),
                                filterPod.issueLevel.eq(filter))
                        .exists());
    }
}
