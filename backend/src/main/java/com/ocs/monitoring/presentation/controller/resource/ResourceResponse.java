package com.ocs.monitoring.presentation.controller.resource;

import com.ocs.monitoring.application.resource.ResourceInfo;
import java.time.Instant;
import java.util.List;
import java.util.Map;
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

    public record PathSegment(String resourceType, long id, String name) {

        public static PathSegment from(ResourceInfo.PathSegment info) {
            return new PathSegment(info.resourceType(), info.id(), info.name());
        }

        static List<PathSegment> fromAll(List<ResourceInfo.PathSegment> infos) {
            return infos.stream().map(PathSegment::from).toList();
        }
    }

    /************************************************************
     * 상세 : GET /resources/{resourceType}/{resourceId}
     ************************************************************/
    public record Detail(DetailResource resource, Instant fetchedAt) {

        public static Detail from(ResourceInfo.Detail info) {
            return new Detail(DetailResource.from(info.resource()), info.fetchedAt());
        }
    }

    public record DetailResource(
            long id,
            String resourceType,
            String name,
            String statusCode,
            String issueLevel,
            String issueReason,
            Instant lastUpdatedAt,
            List<PathSegment> path,
            Map<String, Object> attributes) {

        public static DetailResource from(ResourceInfo.DetailResource info) {
            return new DetailResource(
                    info.id(),
                    info.resourceType(),
                    info.name(),
                    info.statusCode(),
                    info.issueLevel(),
                    info.issueReason(),
                    info.lastUpdatedAt(),
                    PathSegment.fromAll(info.path()),
                    info.attributes());
        }
    }
}
