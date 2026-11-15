/************************************************************************
 * 검색 SQL의 결과 집합 (LIMIT/OFFSET 없이). 백엔드 ResourceSearchRepositoryImpl.SEARCH_SQL과 같은 CTE다
 * 기대 순서(정렬 기준 lower(name), resource_type, id)와 건수를 페이지 순회 결과와 비교하는 데 쓴다
 * 변수 : pattern (예 '%ns-%'), issue (빈 문자열이면 필터 없음), tail (예 'ORDER BY ...' 또는 'LIMIT 21 OFFSET 0')
 ************************************************************************/
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
SELECT r.resource_type || ':' || r.id FROM resources r
WHERE lower(r.name) LIKE :'pattern' ESCAPE '!'
  AND (:'issue' = '' OR r.issue_level = :'issue')
ORDER BY lower(r.name) ASC, r.resource_type ASC, r.id ASC;
