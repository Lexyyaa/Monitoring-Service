package com.ocs.monitoring.infrastructure.persistence.resource;

import static com.ocs.monitoring.domain.resource.QCluster.cluster;
import static com.ocs.monitoring.domain.resource.QNamespace.namespace;
import static com.ocs.monitoring.domain.resource.QNode.node;
import static com.ocs.monitoring.domain.resource.QPod.pod;

import com.ocs.monitoring.domain.resource.Cluster;
import com.ocs.monitoring.domain.resource.Namespace;
import com.ocs.monitoring.domain.resource.Node;
import com.ocs.monitoring.domain.resource.PodLocation;
import com.ocs.monitoring.domain.resource.ResourceRepository;
import com.querydsl.core.Tuple;
import com.querydsl.jpa.JPAExpressions;
import com.querydsl.jpa.impl.JPAQueryFactory;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

/************************************************************
 * 단건 조회 저장소 구현
 * 서비스가 ID로 리소스를 찾거나 Namespace의 Node 경로를 확인할 때 쓴다
 * 단건은 Spring Data JPA, 조인과 서브쿼리는 QueryDSL을 씀으로써 단순한 조회에 쿼리를 직접 쓰지 않는다
 ************************************************************/
@Repository
@RequiredArgsConstructor
public class ResourceRepositoryImpl implements ResourceRepository {

    private final JPAQueryFactory queryFactory;
    private final ClusterJpaRepository clusterJpaRepository;
    private final NodeJpaRepository nodeJpaRepository;
    private final NamespaceJpaRepository namespaceJpaRepository;

    @Override
    public Optional<Cluster> findCluster(long id) {
        return clusterJpaRepository.findById(id);
    }

    @Override
    public Optional<Node> findNode(long id) {
        return nodeJpaRepository.findById(id);
    }

    @Override
    public Optional<Namespace> findNamespace(long id) {
        return namespaceJpaRepository.findById(id);
    }

    @Override
    public Optional<PodLocation> findPodLocation(long id) {
        Tuple row = queryFactory
                .select(pod, cluster, node, namespace)
                .from(pod, cluster, node, namespace)
                .where(
                        pod.id.eq(id),
                        cluster.id.eq(pod.clusterId),
                        node.id.eq(pod.nodeId),
                        namespace.id.eq(pod.namespaceId))
                .fetchOne();
        return Optional.ofNullable(row)
                .map(found ->
                        new PodLocation(found.get(pod), found.get(cluster), found.get(node), found.get(namespace)));
    }

    /************************************************************
     * Namespace의 Node 경로 후보 (DB에는 Node-Namespace 관계가 없어 Pod 배치로 찾는다)
     ************************************************************/
    @Override
    public Optional<Node> findRepresentativeHostNode(Namespace namespace) {
        Long nodeId = queryFactory
                .select(pod.nodeId.min())
                .from(pod)
                .where(pod.namespaceId.eq(namespace.getId()))
                .fetchOne();
        return nodeId == null ? Optional.empty() : nodeJpaRepository.findById(nodeId);
    }

    @Override
    public Optional<Node> findHostNode(Namespace namespace, long nodeId) {
        return Optional.ofNullable(queryFactory
                .selectFrom(node)
                .where(
                        node.id.eq(nodeId),
                        JPAExpressions.selectOne()
                                .from(pod)
                                .where(pod.namespaceId.eq(namespace.getId()), pod.nodeId.eq(nodeId))
                                .exists())
                .fetchOne());
    }
}
