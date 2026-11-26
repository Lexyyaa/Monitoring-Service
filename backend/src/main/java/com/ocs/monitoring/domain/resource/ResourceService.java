package com.ocs.monitoring.domain.resource;

import com.ocs.monitoring.domain.resource.exception.ResourceException;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/************************************************************
 * 리소스 조회의 도메인 서비스
 * 트리, 상세를 요청받을 때 부모와 경로가 실제로 있는지 확인한 뒤 필요한 한 단계만 저장소에서 읽는다
 * 없는 부모를 빈 목록이 아니라 404로 돌려줌으로써 "하위 없음"과 "잘못된 경로"를 구분하게 한다
 ************************************************************/
@Service
@RequiredArgsConstructor
public class ResourceService {

    private final ResourceRepository resourceRepository;
    private final ResourceTreeRepository treeRepository;
    private final ResourceSearchRepository searchRepository;

    /************************************************************
     * 트리 : 부모를 확인한 뒤 직접 하위 한 단계만 조회한다
     * 없는 부모는 빈 목록이 아니라 404다 (하위 없음으로 오해하지 않게)
     ************************************************************/
    public List<TreeResource> listClusters(IssueLevel filter) {
        return treeRepository.findClusters(filter);
    }

    public List<TreeResource> listNodes(long clusterId, IssueLevel filter) {
        Cluster cluster = getCluster(clusterId);
        return treeRepository.findNodes(cluster.getId(), filter);
    }

    public List<TreeResource> listNamespaces(long nodeId, IssueLevel filter) {
        Node node = getNode(nodeId);
        return treeRepository.findNamespaces(node.getId(), filter);
    }

    public List<TreeResource> listPods(long nodeId, long namespaceId, IssueLevel filter) {
        Node node = getNode(nodeId);
        Namespace namespace = getNamespace(namespaceId);
        node.requireSameCluster(namespace);
        return treeRepository.findPods(node.getId(), namespace.getId(), filter);
    }

    /************************************************************
     * 상세 : nodeId는 Namespace 상세에서만 쓴다 (트리에서 클릭한 Node 경로 유지)
     ************************************************************/
    public ResourceDetail getDetail(ResourceType resourceType, long id, Long nodeId) {
        resourceType.requireNodeContextAllowed(nodeId);
        return switch (resourceType) {
            case CLUSTER -> getCluster(id).toDetail();
            case NODE -> nodeDetail(id);
            case NAMESPACE -> namespaceDetail(id, nodeId);
            case POD -> podDetail(id);
        };
    }

    private ResourceDetail nodeDetail(long id) {
        Node node = getNode(id);
        return node.toDetail(getCluster(node.getClusterId()));
    }

    /** 경로를 지정하지 않으면 대표 Node, 지정하면 그 Node에 이 Namespace의 Pod가 있어야 한다 */
    private ResourceDetail namespaceDetail(long id, Long nodeId) {
        Namespace namespace = getNamespace(id);
        Node pathNode = (nodeId == null
                        ? resourceRepository.findRepresentativeHostNode(namespace)
                        : resourceRepository.findHostNode(namespace, nodeId))
                .orElseThrow(ResourceException::notFound);
        return namespace.toDetail(getCluster(namespace.getClusterId()), pathNode);
    }

    private ResourceDetail podDetail(long id) {
        return resourceRepository
                .findPodLocation(id)
                .orElseThrow(ResourceException::notFound)
                .toDetail();
    }

    /************************************************************
     * 검색 : 한 건 더 읽어 다음 페이지 여부를 판단한다 (총건수 집계 없음)
     ************************************************************/
    public ResourceSearchPage search(String query, IssueLevel filter, int page) {
        SearchKeyword keyword = SearchKeyword.of(query);
        SearchPageRequest request = new SearchPageRequest(page);
        List<ResourceSearchItem> rows =
                searchRepository.search(keyword.value(), filter, request.offset(), request.fetchSize());
        return ResourceSearchPage.of(rows);
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
