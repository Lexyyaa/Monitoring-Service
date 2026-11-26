package com.ocs.monitoring.presentation.controller.resource;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.ocs.monitoring.application.resource.ResourceInfo;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import lombok.AccessLevel;
import lombok.NoArgsConstructor;

/************************************************************
 * HTTP 응답 JSON (OpenAPI 계약과 같은 모양)
 * Controller가 응답할 때 Info를 이 모양으로 바꾼다
 * Info와 필드가 거의 같지만 따로 둠으로써 JSON 표현(@JsonInclude 등)을 Presentation에만 둔다
 ************************************************************/
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

    /** 필터가 없으면 matchRole을 응답에서 뺀다 */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record TreeItem(
            long id,
            String resourceType,
            String name,
            String statusCode,
            String issueLevel,
            Instant lastUpdatedAt,
            String matchRole) {

        public static TreeItem from(ResourceInfo.TreeItem info) {
            return new TreeItem(
                    info.id(),
                    info.resourceType(),
                    info.name(),
                    info.statusCode(),
                    info.issueLevel(),
                    info.lastUpdatedAt(),
                    info.matchRole());
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
     * 전체 검색 : GET /resources/search
     ************************************************************/
    public record SearchPage(List<SearchItem> items, int page, int pageSize, boolean hasNext, Instant fetchedAt) {

        public static SearchPage from(ResourceInfo.SearchPage info) {
            return new SearchPage(
                    info.items().stream().map(SearchItem::from).toList(),
                    info.page(),
                    info.pageSize(),
                    info.hasNext(),
                    info.fetchedAt());
        }
    }

    public record SearchItem(
            long id,
            String resourceType,
            String name,
            String statusCode,
            String issueLevel,
            Instant lastUpdatedAt,
            List<PathSegment> path) {

        public static SearchItem from(ResourceInfo.SearchItem info) {
            return new SearchItem(
                    info.id(),
                    info.resourceType(),
                    info.name(),
                    info.statusCode(),
                    info.issueLevel(),
                    info.lastUpdatedAt(),
                    PathSegment.fromAll(info.path()));
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
