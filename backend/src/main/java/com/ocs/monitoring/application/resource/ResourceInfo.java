package com.ocs.monitoring.application.resource;

import com.ocs.monitoring.domain.resource.ResourceDetail;
import com.ocs.monitoring.domain.resource.TreeResource;
import java.time.Instant;
import java.util.List;
import java.util.Map;
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

    /************************************************************
     * 탐색 경로 한 단계
     ************************************************************/
    public record PathSegment(String resourceType, long id, String name) {

        public static PathSegment from(com.ocs.monitoring.domain.resource.PathSegment segment) {
            return new PathSegment(segment.resourceType().name(), segment.id(), segment.name());
        }

        static List<PathSegment> fromAll(List<com.ocs.monitoring.domain.resource.PathSegment> segments) {
            return segments.stream().map(PathSegment::from).toList();
        }
    }

    /************************************************************
     * 상세
     ************************************************************/
    public record Detail(DetailResource resource, Instant fetchedAt) {

        public static Detail of(ResourceDetail detail, Instant fetchedAt) {
            return new Detail(DetailResource.from(detail), fetchedAt);
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

        public static DetailResource from(ResourceDetail detail) {
            return new DetailResource(
                    detail.id(),
                    detail.resourceType().name(),
                    detail.name(),
                    detail.statusCode(),
                    detail.issueLevel().name(),
                    detail.issueReason(),
                    detail.lastUpdatedAt(),
                    PathSegment.fromAll(detail.path()),
                    detail.attributes());
        }
    }
}
