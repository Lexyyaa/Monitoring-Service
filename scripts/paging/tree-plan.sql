/************************************************************************
 * 트리 분기 조회 SQL 실행계획 (백엔드 로그에서 확인한 Hibernate SQL과 같은 형태)
 * 사용 : scripts/paging/env.sh psql -f /dev/stdin < scripts/paging/tree-plan.sql
 * 각 SQL을 3회 실행한다. 첫 회는 캐시 워밍업으로 본다
 ************************************************************************/
\o /dev/null
SELECT 1;
\o

\echo '== TREE-PLAN-01 Node 1 + Namespace 1 Pod 목록'
EXPLAIN (ANALYZE, BUFFERS) select p1_0.id,p1_0.name,p1_0.phase,p1_0.issue_level,p1_0.last_updated_at from pods p1_0 where p1_0.node_id=1 and p1_0.namespace_id=1 order by p1_0.name,p1_0.id;
EXPLAIN (ANALYZE, BUFFERS) select p1_0.id,p1_0.name,p1_0.phase,p1_0.issue_level,p1_0.last_updated_at from pods p1_0 where p1_0.node_id=1 and p1_0.namespace_id=1 order by p1_0.name,p1_0.id;
EXPLAIN (ANALYZE, BUFFERS) select p1_0.id,p1_0.name,p1_0.phase,p1_0.issue_level,p1_0.last_updated_at from pods p1_0 where p1_0.node_id=1 and p1_0.namespace_id=1 order by p1_0.name,p1_0.id;

\echo '== TREE-PLAN-02 같은 분기 ERROR 필터'
EXPLAIN (ANALYZE, BUFFERS) select p1_0.id,p1_0.name,p1_0.phase,p1_0.issue_level,p1_0.last_updated_at from pods p1_0 where p1_0.node_id=1 and p1_0.namespace_id=1 and p1_0.issue_level='ERROR' order by p1_0.name,p1_0.id;
EXPLAIN (ANALYZE, BUFFERS) select p1_0.id,p1_0.name,p1_0.phase,p1_0.issue_level,p1_0.last_updated_at from pods p1_0 where p1_0.node_id=1 and p1_0.namespace_id=1 and p1_0.issue_level='ERROR' order by p1_0.name,p1_0.id;
EXPLAIN (ANALYZE, BUFFERS) select p1_0.id,p1_0.name,p1_0.phase,p1_0.issue_level,p1_0.last_updated_at from pods p1_0 where p1_0.node_id=1 and p1_0.namespace_id=1 and p1_0.issue_level='ERROR' order by p1_0.name,p1_0.id;

\echo '== TREE-PLAN-03 Node 1 아래 Namespace'
EXPLAIN (ANALYZE, BUFFERS) select n1_0.id,n1_0.name,n1_0.phase,n1_0.issue_level,n1_0.last_updated_at from namespaces n1_0 where exists(select 1 from pods p1_0 where p1_0.namespace_id=n1_0.id and p1_0.node_id=1) order by n1_0.name,n1_0.id;
EXPLAIN (ANALYZE, BUFFERS) select n1_0.id,n1_0.name,n1_0.phase,n1_0.issue_level,n1_0.last_updated_at from namespaces n1_0 where exists(select 1 from pods p1_0 where p1_0.namespace_id=n1_0.id and p1_0.node_id=1) order by n1_0.name,n1_0.id;
EXPLAIN (ANALYZE, BUFFERS) select n1_0.id,n1_0.name,n1_0.phase,n1_0.issue_level,n1_0.last_updated_at from namespaces n1_0 where exists(select 1 from pods p1_0 where p1_0.namespace_id=n1_0.id and p1_0.node_id=1) order by n1_0.name,n1_0.id;
