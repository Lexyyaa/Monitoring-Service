package com.ocs.monitoring.presentation.controller.resource;

import com.ocs.monitoring.application.resource.ResourceInfo;
import java.time.Instant;
import java.util.List;
import lombok.AccessLevel;
import lombok.NoArgsConstructor;

@NoArgsConstructor(access = AccessLevel.PRIVATE)
public final class ResourceResponse {

    /************************************************************
     * 트리 목록 : GET /clusters, /clusters/{id}/nodes, /nodes/{id}/namespaces, /nodes/{id}/namespaces/{id}/pods
     ************************************************************/
    public record TreeList(List<TreeItem> items, Instant fetchedAt) {

        public static TreeList from(ResourceInfo.TreeList info) {
            return new TreeList(info.items().stream().map(TreeItem::from).toList(), info.fetchedAt());
        }
    }

    public record TreeItem(
            long id, String resourceType, String name, String statusCode, String issueLevel, Instant lastUpdatedAt) {

        public static TreeItem from(ResourceInfo.TreeItem info) {
            return new TreeItem(
                    info.id(),
                    info.resourceType(),
                    info.name(),
                    info.statusCode(),
                    info.issueLevel(),
                    info.lastUpdatedAt());
        }
    }
}
