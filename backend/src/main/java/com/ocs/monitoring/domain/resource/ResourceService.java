package com.ocs.monitoring.domain.resource;

import com.ocs.monitoring.domain.resource.exception.ResourceException;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ResourceService {

    private final ResourceRepository resourceRepository;
    private final ResourceTreeRepository treeRepository;

    /************************************************************
     * 트리 : 부모를 확인한 뒤 직접 하위 한 단계만 조회한다
     * 없는 부모는 빈 목록이 아니라 404다 (하위 없음으로 오해하지 않게)
     ************************************************************/
    public List<TreeResource> listClusters() {
        return treeRepository.findClusters();
    }

    public List<TreeResource> listNodes(long clusterId) {
        Cluster cluster = getCluster(clusterId);
        return treeRepository.findNodes(cluster.getId());
    }

    public List<TreeResource> listNamespaces(long nodeId) {
        Node node = getNode(nodeId);
        return treeRepository.findNamespaces(node.getId());
    }

    public List<TreeResource> listPods(long nodeId, long namespaceId) {
        Node node = getNode(nodeId);
        Namespace namespace = getNamespace(namespaceId);
        node.requireSameCluster(namespace);
        return treeRepository.findPods(node.getId(), namespace.getId());
    }

    /************************************************************
     * 엔티티 조회 : 없으면 404
     ************************************************************/
    private Cluster getCluster(long id) {
        return resourceRepository.findCluster(id).orElseThrow(ResourceException::notFound);
    }

    private Node getNode(long id) {
        return resourceRepository.findNode(id).orElseThrow(ResourceException::notFound);
    }

    private Namespace getNamespace(long id) {
        return resourceRepository.findNamespace(id).orElseThrow(ResourceException::notFound);
    }
}
