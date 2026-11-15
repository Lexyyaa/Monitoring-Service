/************************************************************************
 * Mock 데이터 규모·정합성 검증 SQL
 * 건수(20/200/2,000/100,000+), 교차 Cluster 관계 없음, 경로 수, 심각도 분포, 검색 경계 fixture를 확인한다
 * 교차 Cluster INSERT를 시도해 복합 FK가 거절하는지도 확인한다 (성공하면 예외로 전체 롤백)
 ************************************************************************/

/************************************************************
 * 건수 출력
 ************************************************************/
SELECT 'clusters' AS resource, count(*) AS rows FROM clusters
UNION ALL SELECT 'nodes', count(*) FROM nodes
UNION ALL SELECT 'namespaces', count(*) FROM namespaces
UNION ALL SELECT 'pods', count(*) FROM pods;

/************************************************************
 * 규모·정합성 검증 (하나라도 어긋나면 예외)
 * 건수, 교차 Cluster 관계, 경로 수, 지연 조회 fixture, Node 미배정 Pod, Pod 없는 Namespace, 심각도 4종, 검색 경계, 필터·오래된 시각 fixture
 ************************************************************/
DO $$
BEGIN
    IF (SELECT count(*) FROM clusters) <> 20 OR
       (SELECT count(*) FROM nodes) <> 200 OR
       (SELECT count(*) FROM namespaces) <> 2000 OR
       (SELECT count(*) FROM pods) < 100000 THEN
        RAISE EXCEPTION 'Mock row counts do not meet requirements';
    END IF;
    IF EXISTS (SELECT 1 FROM pods p JOIN nodes n ON n.id = p.node_id
               JOIN namespaces ns ON ns.id = p.namespace_id
               WHERE p.cluster_id <> n.cluster_id OR p.cluster_id <> ns.cluster_id) THEN
        RAISE EXCEPTION 'Cross-cluster Pod relationship found';
    END IF;
    IF (SELECT count(*) FROM (SELECT DISTINCT node_id, namespace_id FROM pods) AS paths) < 2000 THEN
        RAISE EXCEPTION 'Node/Namespace path count too small';
    END IF;
    IF (SELECT count(DISTINCT namespace_id) FROM pods WHERE node_id = 1) <> 10 OR
       (SELECT count(*) FROM pods WHERE node_id = 1 AND namespace_id = 1) <> 50 THEN
        RAISE EXCEPTION 'Lazy tree lookup fixture mismatch';
    END IF;
    IF EXISTS (SELECT 1 FROM pods WHERE node_id IS NULL) THEN
        RAISE EXCEPTION 'Unassigned Pod found';
    END IF;
    IF EXISTS (SELECT 1 FROM namespaces ns
               WHERE NOT EXISTS (SELECT 1 FROM pods p WHERE p.namespace_id = ns.id)) THEN
        RAISE EXCEPTION 'Namespace without Pod found (no tree path)';
    END IF;
    IF (SELECT count(DISTINCT issue_level) FROM pods) <> 4 THEN
        RAISE EXCEPTION 'Missing issue level';
    END IF;
    IF (SELECT count(*) FROM pods WHERE name LIKE '%case20only%') <> 20 OR
       (SELECT count(*) FROM pods WHERE name LIKE '%case21only%') <> 21 THEN
        RAISE EXCEPTION 'Search boundary fixture count mismatch';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pods WHERE id = 1 AND issue_level = 'ERROR') OR
       NOT EXISTS (SELECT 1 FROM clusters WHERE id = 1 AND issue_level = 'NONE') OR
       NOT EXISTS (SELECT 1 FROM pods WHERE last_updated_at < '2026-11-01'::timestamptz) THEN
        RAISE EXCEPTION 'Filter path or stale fixture missing';
    END IF;
    /************************************************************
     * 복합 FK 거절 확인
     * 다른 Cluster의 Namespace / Node를 참조하는 Pod INSERT가 foreign_key_violation으로 막혀야 통과
     * 막히지 않으면 예외를 던져 DO 블록 전체가 롤백된다
     ************************************************************/
    BEGIN
        INSERT INTO pods (id, cluster_id, namespace_id, node_id, name, phase, ready, restart_count,
                          issue_level, last_updated_at)
        VALUES (100001, 1, 101, 1, 'invalid-cross-cluster', 'Running', true, 0,
                'NONE', now());
        RAISE EXCEPTION 'Cross-cluster Pod was accepted';
    EXCEPTION WHEN foreign_key_violation THEN
        NULL;
    END;
    BEGIN
        INSERT INTO pods (id, cluster_id, namespace_id, node_id, name, phase, ready, restart_count,
                          issue_level, last_updated_at)
        VALUES (100001, 1, 1, 11, 'invalid-cross-cluster-node', 'Running', true, 0,
                'NONE', now());
        RAISE EXCEPTION 'Cross-cluster Node was accepted';
    EXCEPTION WHEN foreign_key_violation THEN
        NULL;
    END;
END $$;

/************************************************************
 * 참고 출력
 * (Node, Namespace) 탐색 경로 수와 Pod 심각도 분포
 ************************************************************/
SELECT count(*) AS node_namespace_paths FROM (SELECT DISTINCT node_id, namespace_id FROM pods) AS paths;
SELECT issue_level, count(*) FROM pods GROUP BY issue_level ORDER BY issue_level;
