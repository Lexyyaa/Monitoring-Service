# 기능 및 통합 테스트 결과

[테스트 시나리오](../design/06-test-scenarios.md)를 실제로 실행한 결과다. 자동 테스트는 각 브랜치의 PR에서 다시 실행한다.

## DB·Mock

- 환경: 로컬 Docker PostgreSQL 17.11, 2026-11-15
- 방법: 임시 DB `monitoring_seedcheck`를 만들어 Flyway V1 SQL과 `seed.sql`을 적용하고, 확인 뒤 DB를 지웠다.

### DB-01 데이터 건수 · 확인

- `verify.sql` 통과
- Cluster 20, Node 200, Namespace 2,000, Pod 100,000
- (Node, Namespace) 경로 2,000개, Pod 없는 Namespace 0개

### DB-02 공유 Namespace의 Node별 Pod · 확인

- `seed-shared-namespace.sql`을 트랜잭션 안에서 적용하고 롤백했다.
- Namespace 1의 행은 1건이다.
- Pod는 Node 1에 49건, Node 2에 1건으로 나뉜다.

### DB-03 ~ DB-06 제약 · 자동 테스트

- `DatabaseConstraintIntegrationTest` 5건 통과
- 복합 FK 두 개, Node 없는 Pod의 NOT NULL, 심각도 CHECK를 확인했다.

### DB-07 시드 재실행 · 확인

- 적재된 DB에 `seed.sql`을 트랜잭션 안에서 한 번 더 실행하고 롤백했다.
- 실행 전후 Pod 건수 100,000, ID 합계 5,000,050,000, 최근 갱신 시각 `2026-11-14 00:00:00+00`이 같다.

### DB-08 전체 Pod를 메모리에 올리지 않음 · 확인 (트리)

- Hibernate SQL 로그를 켜고 Cluster → Node → Namespace → Pod를 펼쳤다.
- `pods`를 읽는 쿼리는 두 개다.
  - Node 아래 Namespace: `EXISTS (... p.namespace_id = n.id AND p.node_id = ?)`
  - Pod 목록: `WHERE node_id = ? AND namespace_id = ?`
- 상세·검색 경로는 해당 기능을 구현할 때 다시 확인한다.

## 트리

- TREE-T01 ~ T05, T08: 컴포넌트 테스트 통과 (`tree.test.tsx`)
- TREE-T02: E2E 통과. 펼칠 때마다 직접 하위 요청 1건씩만 보냈다.
- TREE-T06: 저장소 통합 테스트 통과. 공유 Namespace를 만든 뒤에도 Node 아래 Namespace가 중복되지 않는다.
- TREE-T09: E2E 통과. 2,220행을 펼치고 스크롤하는 동안 DOM의 행은 40개 이하였다.

## 상세 API

- UNIT-03: 단위 테스트 통과 (`ResourceServiceTest`)
- DETAIL-T05, T06과 네 종류 정상 응답: 통합 테스트 통과 (`ResourceApiIntegrationTest`)
- DETAIL-T03, T04의 API 규칙: 통합 테스트 통과. 공유 Namespace에서 `nodeId=2`는 Node 2 경로, `nodeId`가 없으면 Node 1 경로였다.
- DB-08(상세): `pods` 조회는 `id`, `namespace_id`, `node_id` 조건이 붙는다. 대표 Node 조회는 인덱스만 읽었다(0.02ms).

## 상세 패널

- DETAIL-T01 ~ T03, T07과 닫기 동작: 컴포넌트 테스트 통과 (`detail.test.tsx`)
- DETAIL-T01: E2E 통과. 실제 데이터로 네 종류 상세와 경로를 확인했다.
- DETAIL-T04: API 통합 테스트로 확인했다. 트리에서 고르면 항상 클릭한 Node를 함께 보낸다.

## 검색 API

- UNIT-04: 단위 테스트 통과. 21건을 읽어 20건만 돌려주고 `hasNext`를 판단한다.
- SEARCH-T03, T09, T11: 통합 테스트 통과 (`ResourceApiIntegrationTest`)
  - 검색어는 앞뒤 공백을 지운 뒤 길이를 본다. 공백을 붙인 200자 검색어도 200이다.

## 검색 화면

- SEARCH-T01, T05 ~ T08, UX-T02: 컴포넌트 테스트 통과 (`search.test.tsx`)
- SEARCH-T05: E2E 통과. 실제 데이터에서 결과를 고르면 경로가 열리고 선택한 행이 화면 안에 보인다.

## 필터 API

- FILTER-T02, T05, T06, T09: 통합 테스트 통과 (`ResourceApiIntegrationTest`)
- PATH 근거: Pod가 없는 ERROR Namespace만 있는 Cluster는 ERROR 필터 결과에 나오지 않는다 (`ResourceTreeRepositoryIntegrationTest`)
- 필터를 건 트리 조회는 로컬에서 4~31ms였다.
