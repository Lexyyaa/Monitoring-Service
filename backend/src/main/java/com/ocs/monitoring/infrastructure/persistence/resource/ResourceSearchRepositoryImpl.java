package com.ocs.monitoring.infrastructure.persistence.resource;

import com.ocs.monitoring.domain.resource.IssueLevel;
import com.ocs.monitoring.domain.resource.PathSegment;
import com.ocs.monitoring.domain.resource.ResourceSearchItem;
import com.ocs.monitoring.domain.resource.ResourceSearchRepository;
import com.ocs.monitoring.domain.resource.ResourceType;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.hibernate.Session;
import org.hibernate.type.StandardBasicTypes;
import org.springframework.stereotype.Repository;

@Repository
@RequiredArgsConstructor
public class ResourceSearchRepositoryImpl implements ResourceSearchRepository {

    /************************************************************
     * Cluster·Node·Namespace·Pod 통합 검색 SQL
     * JPQL은 UNION을 지원하지 않아 네이티브 쿼리로 실행한다. 정렬·페이지를 DB에서 한 번에 처리한다
     * Namespace의 Node 경로는 Pod가 있는 최소 ID Node (LATERAL). Pod 없는 Namespace는 경로가 없어 빠진다
     ************************************************************/
    private static final String SEARCH_SQL = """
            WITH resources AS (
                SELECT c.id, 'CLUSTER' resource_type, c.name, c.control_plane_status status_code,
                       c.issue_level, c.last_updated_at,
                       c.id cluster_id, c.name cluster_name, NULL::bigint node_id, NULL::varchar node_name,
                       NULL::bigint namespace_id, NULL::varchar namespace_name
                FROM clusters c
                UNION ALL
                SELECT n.id, 'NODE', n.name, n.ready_condition, n.issue_level, n.last_updated_at,
                       c.id, c.name, n.id, n.name, NULL::bigint, NULL::varchar
                FROM nodes n JOIN clusters c ON c.id=n.cluster_id
                UNION ALL
                SELECT ns.id, 'NAMESPACE', ns.name, ns.phase, ns.issue_level, ns.last_updated_at,
                       c.id, c.name, chosen.node_id, chosen.node_name, ns.id, ns.name
                FROM namespaces ns JOIN clusters c ON c.id=ns.cluster_id
                JOIN LATERAL (
                    SELECT n.id node_id, n.name node_name FROM nodes n JOIN pods p ON p.node_id=n.id
                    WHERE p.namespace_id=ns.id ORDER BY n.id LIMIT 1
                ) chosen ON true
                UNION ALL
                SELECT p.id, 'POD', p.name, p.phase, p.issue_level, p.last_updated_at,
                       c.id, c.name, n.id, n.name, ns.id, ns.name
                FROM pods p JOIN clusters c ON c.id=p.cluster_id JOIN nodes n ON n.id=p.node_id
                JOIN namespaces ns ON ns.id=p.namespace_id
            )
            SELECT r.* FROM resources r
            WHERE lower(r.name) LIKE :pattern ESCAPE '!'
            ORDER BY lower(r.name) ASC, r.resource_type ASC, r.id ASC
            LIMIT :limit OFFSET :offset
            """;

    private final EntityManager entityManager;

    @Override
    public List<ResourceSearchItem> search(String keyword, long offset, int limit) {
        List<Object[]> rows = entityManager
                .unwrap(Session.class)
                .createNativeQuery(SEARCH_SQL, Object[].class)
                .addScalar("id", StandardBasicTypes.LONG)
                .addScalar("resource_type", StandardBasicTypes.STRING)
                .addScalar("name", StandardBasicTypes.STRING)
                .addScalar("status_code", StandardBasicTypes.STRING)
                .addScalar("issue_level", StandardBasicTypes.STRING)
                .addScalar("last_updated_at", StandardBasicTypes.INSTANT)
                .addScalar("cluster_id", StandardBasicTypes.LONG)
                .addScalar("cluster_name", StandardBasicTypes.STRING)
                .addScalar("node_id", StandardBasicTypes.LONG)
                .addScalar("node_name", StandardBasicTypes.STRING)
                .addScalar("namespace_id", StandardBasicTypes.LONG)
                .addScalar("namespace_name", StandardBasicTypes.STRING)
                .setParameter("pattern", "%" + escapeLike(keyword.toLowerCase(Locale.ROOT)) + "%")
                .setParameter("limit", limit)
                .setParameter("offset", offset)
                .getResultList();
        return rows.stream().map(ResourceSearchRepositoryImpl::toItem).toList();
    }

    /************************************************************
     * %·_·! 를 이스케이프해 검색어를 글자 그대로 부분 일치시킨다
     ************************************************************/
    private static String escapeLike(String keyword) {
        return keyword.replace("!", "!!").replace("%", "!%").replace("_", "!_");
    }

    private static ResourceSearchItem toItem(Object[] row) {
        ResourceType type = ResourceType.valueOf((String) row[1]);
        long id = (Long) row[0];
        String name = (String) row[2];
        List<PathSegment> path = new ArrayList<>();
        path.add(new PathSegment(ResourceType.CLUSTER, (Long) row[6], (String) row[7]));
        if (type != ResourceType.CLUSTER) {
            path.add(new PathSegment(ResourceType.NODE, (Long) row[8], (String) row[9]));
        }
        if (type == ResourceType.NAMESPACE || type == ResourceType.POD) {
            path.add(new PathSegment(ResourceType.NAMESPACE, (Long) row[10], (String) row[11]));
        }
        if (type == ResourceType.POD) {
            path.add(new PathSegment(ResourceType.POD, id, name));
        }
        return new ResourceSearchItem(
                id, type, name, (String) row[3], IssueLevel.valueOf((String) row[4]), (Instant) row[5], path);
    }
}
