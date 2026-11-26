package com.ocs.monitoring.presentation.controller.resource;

import com.ocs.monitoring.application.resource.ResourceApplicationService;
import com.ocs.monitoring.application.resource.ResourceCommand;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/************************************************************
 * 리소스 조회 API (GET만 있다. 상태를 바꾸는 API는 없다)
 * HTTP 요청이 들어올 때 경로와 파라미터를 검사해 Command로 넘기고, 결과 Info를 응답 JSON으로 바꾼다
 * 저장소나 SQL을 직접 부르지 않음으로써 HTTP 처리와 조회 규칙을 나눈다
 ************************************************************/
@RestController
@RequestMapping(value = "/api/v1", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
public class ResourceController {

    private final ResourceApplicationService resourceApplicationService;

    /************************************************************
     * 트리 탐색 (Cluster → Node → Namespace → Pod). 경로 ID는 1 이상
     * issueLevel이 없으면 전체, 있으면 MATCH·PATH 항목만
     ************************************************************/
    @GetMapping("/clusters")
    public ResourceResponse.TreeList listClusters(@RequestParam(required = false) String issueLevel) {
        ResourceCommand.Clusters command = new ResourceCommand.Clusters(issueLevel);
        return ResourceResponse.TreeList.from(resourceApplicationService.listClusters(command));
    }

    @GetMapping("/clusters/{clusterId}/nodes")
    public ResourceResponse.TreeList listNodes(
            @PathVariable @Positive long clusterId, @RequestParam(required = false) String issueLevel) {
        ResourceCommand.Nodes command = new ResourceCommand.Nodes(clusterId, issueLevel);
        return ResourceResponse.TreeList.from(resourceApplicationService.listNodes(command));
    }

    @GetMapping("/nodes/{nodeId}/namespaces")
    public ResourceResponse.TreeList listNamespaces(
            @PathVariable @Positive long nodeId, @RequestParam(required = false) String issueLevel) {
        ResourceCommand.Namespaces command = new ResourceCommand.Namespaces(nodeId, issueLevel);
        return ResourceResponse.TreeList.from(resourceApplicationService.listNamespaces(command));
    }

    @GetMapping("/nodes/{nodeId}/namespaces/{namespaceId}/pods")
    public ResourceResponse.TreeList listPods(
            @PathVariable @Positive long nodeId,
            @PathVariable @Positive long namespaceId,
            @RequestParam(required = false) String issueLevel) {
        ResourceCommand.Pods command = new ResourceCommand.Pods(nodeId, namespaceId, issueLevel);
        return ResourceResponse.TreeList.from(resourceApplicationService.listPods(command));
    }

    /************************************************************
     * 전체 이름 검색 (q는 앞뒤 공백을 지우고 1~200자, page는 0부터, issueLevel과 AND)
     ************************************************************/
    @GetMapping("/resources/search")
    public ResourceResponse.SearchPage search(
            @RequestParam String q,
            @RequestParam(required = false) String issueLevel,
            @RequestParam(defaultValue = "0") @PositiveOrZero int page) {
        ResourceCommand.Search command = new ResourceCommand.Search(q, issueLevel, page);
        return ResourceResponse.SearchPage.from(resourceApplicationService.search(command));
    }

    /************************************************************
     * 상세 (nodeId는 Namespace 상세에서만 허용)
     ************************************************************/
    @GetMapping("/resources/{resourceType}/{resourceId}")
    public ResourceResponse.Detail getDetail(
            @PathVariable String resourceType,
            @PathVariable @Positive long resourceId,
            @RequestParam(required = false) @Positive Long nodeId) {
        ResourceCommand.Detail command = new ResourceCommand.Detail(resourceType, resourceId, nodeId);
        return ResourceResponse.Detail.from(resourceApplicationService.getDetail(command));
    }
}
