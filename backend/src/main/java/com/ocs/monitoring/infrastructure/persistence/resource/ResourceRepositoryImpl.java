package com.ocs.monitoring.infrastructure.persistence.resource;

import com.ocs.monitoring.domain.resource.Cluster;
import com.ocs.monitoring.domain.resource.Namespace;
import com.ocs.monitoring.domain.resource.Node;
import com.ocs.monitoring.domain.resource.ResourceRepository;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

@Repository
@RequiredArgsConstructor
public class ResourceRepositoryImpl implements ResourceRepository {

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
}
