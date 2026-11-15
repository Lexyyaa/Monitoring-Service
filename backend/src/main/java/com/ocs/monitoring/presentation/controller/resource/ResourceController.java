package com.ocs.monitoring.presentation.controller.resource;

import com.ocs.monitoring.application.resource.ResourceApplicationService;
import com.ocs.monitoring.application.resource.ResourceCommand;
import jakarta.validation.constraints.Positive;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(value = "/api/v1", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
public class ResourceController {

    private final ResourceApplicationService resourceApplicationService;

    /************************************************************
     * 트리 탐색 (Cluster → Node → Namespace → Pod). 경로 ID는 1 이상
     ************************************************************/
    @GetMapping("/clusters")
    public ResourceResponse.TreeList listClusters() {
        return ResourceResponse.TreeList.from(resourceApplicationService.listClusters());
    }

    @GetMapping("/clusters/{clusterId}/nodes")
    public ResourceResponse.TreeList listNodes(@PathVariable @Positive long clusterId) {
        ResourceCommand.Nodes command = new ResourceCommand.Nodes(clusterId);
        return ResourceResponse.TreeList.from(resourceApplicationService.listNodes(command));
    }

    @GetMapping("/nodes/{nodeId}/namespaces")
    public ResourceResponse.TreeList listNamespaces(@PathVariable @Positive long nodeId) {
        ResourceCommand.Namespaces command = new ResourceCommand.Namespaces(nodeId);
        return ResourceResponse.TreeList.from(resourceApplicationService.listNamespaces(command));
    }

    @GetMapping("/nodes/{nodeId}/namespaces/{namespaceId}/pods")
    public ResourceResponse.TreeList listPods(
            @PathVariable @Positive long nodeId, @PathVariable @Positive long namespaceId) {
        ResourceCommand.Pods command = new ResourceCommand.Pods(nodeId, namespaceId);
        return ResourceResponse.TreeList.from(resourceApplicationService.listPods(command));
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
