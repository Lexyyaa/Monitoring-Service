package com.ocs.monitoring.application.resource;

import com.ocs.monitoring.domain.resource.ResourceDetail;
import com.ocs.monitoring.domain.resource.ResourceSearchItem;
import com.ocs.monitoring.domain.resource.ResourceSearchPage;
import com.ocs.monitoring.domain.resource.TreeResource;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import lombok.AccessLevel;
import lombok.NoArgsConstructor;

/************************************************************
 * Application 결과
 * 도메인 조회가 끝날 때 결과와 조회 시각을 담아 Controller에 돌려준다
 * Domain 타입을 문자열과 기본 타입으로 바꿔 내보냄으로써 Controller가 Domain에 의존하지 않게 한다
 ************************************************************/
@NoArgsConstructor(access = AccessLevel.PRIVATE)
public final class ResourceInfo {

    /************************************************************
     * 트리 목록 : 행 목록과 이번 조회 시각
     ************************************************************/
    public record TreeList(List<TreeItem> items, Instant fetchedAt) {

        public static TreeList of(List<TreeResource> resources, Instant fetchedAt) {
            return new TreeList(resources.stream().map(TreeItem::from).toList(), fetchedAt);
        }
    }

    public record TreeItem(
            long id,
            String resourceType,
            String name,
            String statusCode,
            String issueLevel,
            Instant lastUpdatedAt,
            String matchRole) {

        public static TreeItem from(TreeResource resource) {
            return new TreeItem(
                    resource.id(),
                    resource.resourceType().name(),
                    resource.name(),
                    resource.statusCode(),
                    resource.issueLevel().name(),
                    resource.lastUpdatedAt(),
                    resource.matchRole() == null ? null : resource.matchRole().name());
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
     * 상세 : 공통 필드, 종류별 속성, 탐색 경로
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

    /************************************************************
     * 검색 페이지
     ************************************************************/
    public record SearchPage(List<SearchItem> items, int page, int pageSize, boolean hasNext, Instant fetchedAt) {

        public static SearchPage of(ResourceSearchPage result, int page, int pageSize, Instant fetchedAt) {
            return new SearchPage(
                    result.items().stream().map(SearchItem::from).toList(),
                    page,
                    pageSize,
                    result.hasNext(),
                    fetchedAt);
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

        public static SearchItem from(ResourceSearchItem item) {
            return new SearchItem(
                    item.id(),
                    item.resourceType().name(),
                    item.name(),
                    item.statusCode(),
                    item.issueLevel().name(),
                    item.lastUpdatedAt(),
                    PathSegment.fromAll(item.path()));
        }
    }
}
