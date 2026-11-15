/************************************************************************
 * 주요 트리·필터·검색 SQL 실행계획 측정
 * SQL-01~05를 EXPLAIN (ANALYZE, BUFFERS)로 각 3회 실행해 warm-cache 편차를 본다 (읽기 전용)
 ************************************************************************/

\timing on

\echo 'SQL-01 Cluster to Node list'
EXPLAIN (ANALYZE, BUFFERS) SELECT n.id, n.name FROM nodes n
WHERE n.cluster_id = 1 ORDER BY n.name, n.id;
EXPLAIN (ANALYZE, BUFFERS) SELECT n.id, n.name FROM nodes n
WHERE n.cluster_id = 1 ORDER BY n.name, n.id;
EXPLAIN (ANALYZE, BUFFERS) SELECT n.id, n.name FROM nodes n
WHERE n.cluster_id = 1 ORDER BY n.name, n.id;

\echo 'SQL-02 Node to Namespace lookup'
EXPLAIN (ANALYZE, BUFFERS) SELECT ns.id, ns.name FROM namespaces ns
WHERE EXISTS (SELECT 1 FROM pods p WHERE p.namespace_id = ns.id AND p.node_id = 1)
ORDER BY ns.name, ns.id;
EXPLAIN (ANALYZE, BUFFERS) SELECT ns.id, ns.name FROM namespaces ns
WHERE EXISTS (SELECT 1 FROM pods p WHERE p.namespace_id = ns.id AND p.node_id = 1)
ORDER BY ns.name, ns.id;
EXPLAIN (ANALYZE, BUFFERS) SELECT ns.id, ns.name FROM namespaces ns
WHERE EXISTS (SELECT 1 FROM pods p WHERE p.namespace_id = ns.id AND p.node_id = 1)
ORDER BY ns.name, ns.id;

\echo 'SQL-03 Node and Namespace to Pod list'
EXPLAIN (ANALYZE, BUFFERS) SELECT p.id, p.name FROM pods p
WHERE p.node_id = 1 AND p.namespace_id = 1 ORDER BY p.name, p.id;
EXPLAIN (ANALYZE, BUFFERS) SELECT p.id, p.name FROM pods p
WHERE p.node_id = 1 AND p.namespace_id = 1 ORDER BY p.name, p.id;
EXPLAIN (ANALYZE, BUFFERS) SELECT p.id, p.name FROM pods p
WHERE p.node_id = 1 AND p.namespace_id = 1 ORDER BY p.name, p.id;

\echo 'SQL-04 Pod name contains api'
EXPLAIN (ANALYZE, BUFFERS) SELECT p.id, p.name FROM pods p
WHERE lower(p.name) LIKE '%api%' ORDER BY lower(p.name), p.id LIMIT 21;
EXPLAIN (ANALYZE, BUFFERS) SELECT p.id, p.name FROM pods p
WHERE lower(p.name) LIKE '%api%' ORDER BY lower(p.name), p.id LIMIT 21;
EXPLAIN (ANALYZE, BUFFERS) SELECT p.id, p.name FROM pods p
WHERE lower(p.name) LIKE '%api%' ORDER BY lower(p.name), p.id LIMIT 21;

\echo 'SQL-05 Cluster ERROR path filter'
EXPLAIN (ANALYZE, BUFFERS)
SELECT c.id FROM clusters c
WHERE c.issue_level = 'ERROR'
   OR EXISTS (SELECT 1 FROM nodes n WHERE n.cluster_id = c.id AND n.issue_level = 'ERROR')
   OR EXISTS (SELECT 1 FROM namespaces ns WHERE ns.cluster_id = c.id AND ns.issue_level = 'ERROR'
              AND EXISTS (SELECT 1 FROM pods fp WHERE fp.namespace_id = ns.id))
   OR EXISTS (SELECT 1 FROM pods p WHERE p.cluster_id = c.id AND p.issue_level = 'ERROR')
ORDER BY c.name, c.id;
EXPLAIN (ANALYZE, BUFFERS)
SELECT c.id FROM clusters c
WHERE c.issue_level = 'ERROR'
   OR EXISTS (SELECT 1 FROM nodes n WHERE n.cluster_id = c.id AND n.issue_level = 'ERROR')
   OR EXISTS (SELECT 1 FROM namespaces ns WHERE ns.cluster_id = c.id AND ns.issue_level = 'ERROR'
              AND EXISTS (SELECT 1 FROM pods fp WHERE fp.namespace_id = ns.id))
   OR EXISTS (SELECT 1 FROM pods p WHERE p.cluster_id = c.id AND p.issue_level = 'ERROR')
ORDER BY c.name, c.id;
EXPLAIN (ANALYZE, BUFFERS)
SELECT c.id FROM clusters c
WHERE c.issue_level = 'ERROR'
   OR EXISTS (SELECT 1 FROM nodes n WHERE n.cluster_id = c.id AND n.issue_level = 'ERROR')
   OR EXISTS (SELECT 1 FROM namespaces ns WHERE ns.cluster_id = c.id AND ns.issue_level = 'ERROR'
              AND EXISTS (SELECT 1 FROM pods fp WHERE fp.namespace_id = ns.id))
   OR EXISTS (SELECT 1 FROM pods p WHERE p.cluster_id = c.id AND p.issue_level = 'ERROR')
ORDER BY c.name, c.id;
