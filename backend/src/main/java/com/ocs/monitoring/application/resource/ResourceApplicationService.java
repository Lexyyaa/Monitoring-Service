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
 * 리소스 조회 유스케이스
 * Controller가 요청을 넘길 때 문자열 입력을 도메인 enum으로 바꾸고, 도메인 조회 결과에 조회 시각(fetchedAt)을 붙여 돌려준다
 * enum 변환을 여기서 함으로써 잘못된 값을 Domain에 들어가기 전에 400으로 걸러 낸다
 * 업무 판단은 Domain에 맡김으로써 이 클래스는 흐름(변환, 트랜잭션, 조회 시각)만 가진다
 ************************************************************/
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ResourceApplicationService {

    private final ResourceService resourceService;

    /************************************************************
     * 트리 목록 : 펼친 부모의 직접 하위 한 단계만 돌려준다
     ************************************************************/
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

    /************************************************************
     * 전체 이름 검색 : 펼치지 않은 분기도 DB에서 찾는다
     ************************************************************/
    public ResourceInfo.SearchPage search(ResourceCommand.Search command) {
        IssueLevel filter = IssueLevel.from(command.issueLevel());
        return ResourceInfo.SearchPage.of(
                resourceService.search(command.query(), filter, command.page()),
                command.page(),
                SearchPageRequest.PAGE_SIZE,
                Instant.now());
    }

    /************************************************************
     * 상세 : 종류별 속성과 Cluster부터의 탐색 경로
     ************************************************************/
    public ResourceInfo.Detail getDetail(ResourceCommand.Detail command) {
        ResourceType resourceType = ResourceType.from(command.resourceType());
        return ResourceInfo.Detail.of(
                resourceService.getDetail(resourceType, command.resourceId(), command.nodeId()), Instant.now());
    }
}
