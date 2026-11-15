package com.ocs.monitoring.application.resource;

import com.ocs.monitoring.domain.resource.IssueLevel;
import com.ocs.monitoring.domain.resource.ResourceService;
import com.ocs.monitoring.domain.resource.ResourceType;
import com.ocs.monitoring.domain.resource.SearchPageRequest;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/************************************************************
 * 읽기 전용 트랜잭션과 조회 시각(fetchedAt)을 맡는다
 * fetchedAt은 lastUpdatedAt과 같은 UTC 형식(Z)으로 응답한다
 ************************************************************/
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ResourceApplicationService {

    private final ResourceService resourceService;

    public ResourceInfo.TreeList listClusters(ResourceCommand.Clusters command) {
        IssueLevel filter = IssueLevel.from(command.issueLevel());
        return ResourceInfo.TreeList.of(resourceService.listClusters(filter), Instant.now());
    }

    public ResourceInfo.TreeList listNodes(ResourceCommand.Nodes command) {
        IssueLevel filter = IssueLevel.from(command.issueLevel());
        return ResourceInfo.TreeList.of(resourceService.listNodes(command.clusterId(), filter), Instant.now());
    }

    public ResourceInfo.TreeList listNamespaces(ResourceCommand.Namespaces command) {
        IssueLevel filter = IssueLevel.from(command.issueLevel());
        return ResourceInfo.TreeList.of(resourceService.listNamespaces(command.nodeId(), filter), Instant.now());
    }

    public ResourceInfo.TreeList listPods(ResourceCommand.Pods command) {
        IssueLevel filter = IssueLevel.from(command.issueLevel());
        return ResourceInfo.TreeList.of(
                resourceService.listPods(command.nodeId(), command.namespaceId(), filter), Instant.now());
    }

    public ResourceInfo.SearchPage search(ResourceCommand.Search command) {
        IssueLevel filter = IssueLevel.from(command.issueLevel());
        return ResourceInfo.SearchPage.of(
                resourceService.search(command.query(), filter, command.page()),
                command.page(),
                SearchPageRequest.PAGE_SIZE,
                Instant.now());
    }

    public ResourceInfo.Detail getDetail(ResourceCommand.Detail command) {
        ResourceType resourceType = ResourceType.from(command.resourceType());
        return ResourceInfo.Detail.of(
                resourceService.getDetail(resourceType, command.resourceId(), command.nodeId()), Instant.now());
    }
}
