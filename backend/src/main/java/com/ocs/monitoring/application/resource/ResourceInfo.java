package com.ocs.monitoring.application.resource;

import com.ocs.monitoring.domain.resource.TreeResource;
import java.time.Instant;
import java.util.List;
import lombok.AccessLevel;
import lombok.NoArgsConstructor;

@NoArgsConstructor(access = AccessLevel.PRIVATE)
public final class ResourceInfo {

    /************************************************************
     * 트리 목록
     ************************************************************/
    public record TreeList(List<TreeItem> items, Instant fetchedAt) {

        public static TreeList of(List<TreeResource> resources, Instant fetchedAt) {
            return new TreeList(resources.stream().map(TreeItem::from).toList(), fetchedAt);
        }
    }

    public record TreeItem(
            long id, String resourceType, String name, String statusCode, String issueLevel, Instant lastUpdatedAt) {

        public static TreeItem from(TreeResource resource) {
            return new TreeItem(
                    resource.id(),
                    resource.resourceType().name(),
                    resource.name(),
                    resource.statusCode(),
                    resource.issueLevel().name(),
                    resource.lastUpdatedAt());
        }
    }
}
