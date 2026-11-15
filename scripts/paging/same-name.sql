/************************************************************************
 * 이름이 같은 리소스, 대소문자만 다른 리소스, 종류가 다른 리소스를 섞은 정렬 검증 데이터
 * 기본 시드 위에 추가한다 (격리 DB에서만). 되돌릴 때는 scripts/paging/env.sh seed
 * lower(name)이 'dup-name'인 행 35개(Cluster 1, Namespace 2, Node 2, Pod 30)와 'dup-name-0' Pod 3개
 * → q=dup-name 결과 38건, 페이지 경계(20번째)가 같은 이름 묶음 안에 온다
 * 기대 순서 : lower(name) → resource_type(CLUSTER, NAMESPACE, NODE, POD) → id
 ************************************************************************/
BEGIN;
INSERT INTO clusters (id, name, control_plane_status, kubernetes_version, issue_level, last_updated_at)
VALUES (9001, 'Dup-Name', 'Ready', '1.31', 'NONE', now());

INSERT INTO nodes (id, cluster_id, name, ready_condition, issue_level, last_updated_at)
VALUES (9002, 9001, 'DUP-NAME', 'True', 'NONE', now()),
       (9001, 9001, 'dup-name', 'True', 'WARNING', now());

INSERT INTO namespaces (id, cluster_id, name, phase, issue_level, last_updated_at)
VALUES (90002, 9001, 'dup-name', 'Active', 'NONE', now()),
       (90001, 9001, 'Dup-name', 'Active', 'NONE', now());

/* ID 순서와 입력 순서, 대소문자를 일부러 엇갈리게 넣는다 */
INSERT INTO pods (id, cluster_id, namespace_id, node_id, name, phase, ready, restart_count, issue_level, last_updated_at)
SELECT 900230 - g, 9001, 90001 + g % 2, 9001 + (g / 2) % 2,
       (ARRAY['dup-name', 'DUP-NAME', 'Dup-Name'])[g % 3 + 1],
       'Running', true, 0, CASE WHEN g % 4 = 0 THEN 'ERROR' ELSE 'NONE' END, now()
FROM generate_series(0, 29) g;

INSERT INTO pods (id, cluster_id, namespace_id, node_id, name, phase, ready, restart_count, issue_level, last_updated_at)
SELECT 900300 + g, 9001, 90001, 9001, 'dup-name-0', 'Running', true, 0, 'NONE', now()
FROM generate_series(1, 3) g;
COMMIT;
ANALYZE;
