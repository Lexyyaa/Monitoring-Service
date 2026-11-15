/************************************************************************
 * 검색 API SQL 실행계획 측정
 * ResourceSearchRepositoryImpl과 같은 SQL을 EXPLAIN (ANALYZE, BUFFERS)로 3회 실행한다 (읽기 전용)
 * 사용 : psql -v q=api -f scripts/search-plan.sql   (q 기본값 api)
 ************************************************************************/

\if :{?q}
\else
  \set q api
\endif
\set pattern '%' :q '%'
SET jit = off;
\timing on

PREPARE search(text) AS
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
WHERE lower(r.name) LIKE $1 ESCAPE '!'
ORDER BY lower(r.name) ASC, r.resource_type ASC, r.id ASC
LIMIT 21 OFFSET 0;

\echo 'search' :pattern
EXPLAIN (ANALYZE, BUFFERS) EXECUTE search(:'pattern');
EXPLAIN (ANALYZE, BUFFERS) EXECUTE search(:'pattern');
EXPLAIN (ANALYZE, BUFFERS) EXECUTE search(:'pattern');
DEALLOCATE search;
