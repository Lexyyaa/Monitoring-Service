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

## 필터 화면

- FILTER-T01, T03, T04, T05, T07, T08과 필터 불일치 안내: 컴포넌트 테스트 통과 (`filter.test.tsx`)
- FILTER-T05: E2E 통과. 실제 데이터에서 `api` + ERROR는 `pod-payment-api-error` 1건이다.
- 필터 불일치 안내는 선택 당시가 아니라 현재 트리 행의 MATCH·PATH로 판단한다. 전체에서 고른 Cluster가 ERROR 필터에서 PATH이면 안내를 띄우지 않는다.
- DB-08(검색·필터): 검색은 DB에서 정렬하고 `LIMIT 21`로 읽는다. 필터는 `EXISTS` 조건으로 DB에서 판단한다. Java에서 Pod 전체를 순회하지 않는다.

## 갱신과 신선도

- 변경 시각과 조회 시각: 통합 테스트 통과. Pod 3의 `lastUpdatedAt`은 2026-10-01, `fetchedAt`은 요청 시각이며 둘 다 UTC(`Z`) 형식이다.
- REFRESH-T01, T02, T05와 새로고침 버튼 상태: 컴포넌트 테스트 통과 (`refresh.test.tsx`)
- REFRESH-T01, T02: E2E 통과. 개발 DB와 분리한 임시 DB 컨테이너(`monitoring-e2e-db`, 포트 55432)에 시드를 적재하고, 그 DB를 쓰는 백엔드(18080)와 화면(5174)에서 실행했다. 테스트가 바꾼 값은 끝에 되돌렸다.
  - 수동 갱신: 상세와 트리 행이 NONE과 새 갱신 시각으로 바뀌었다.
  - 30초 폴링: 버튼 없이 30.6초 만에 Node 심각도가 바뀌었고 펼친 분기는 그대로였다.
- REFRESH-T03, T04, T06, T07, T09: 컴포넌트 테스트 통과 (`refresh.test.tsx`)
- REFRESH-T04: 임시 DB E2E 통과. ERROR 필터에서 연 Pod를 DB에서 NONE으로 바꾸고 새로고침하면 트리에서 빠지고 상세는 남아 불일치를 알렸다.
- 갱신 실패: 백엔드를 실제로 내리고 새로고침했을 때 트리·검색·상세가 이전 데이터를 유지하고, 세 영역에 "이전에 조회한 데이터를 보여 줍니다"와 재시도가 나왔다. 백엔드를 다시 올리고 새로고침하면 오류가 사라졌다.
- SEARCH-T07, REFRESH-T08과 필터 전환 중 느린 갱신: 컴포넌트 테스트 통과. 폴링 중에는 버튼이 잠기고, 필터를 바꾸기 전에 보낸 느린 응답은 새 필터 목록을 덮지 않았다.
- 스크롤 중 폴링 연기: 컴포넌트 테스트 통과. 스크롤 직후에는 폴링을 미루고, 스크롤이 멈추고 1초 뒤에 갱신한다.

## 컨테이너

- 빈 볼륨 기동: 다른 Compose 프로젝트(`monitoring-check`)와 새 볼륨으로 `docker compose up -d --build --wait`를 실행했다.
  - db, backend, frontend 모두 healthy
  - 백엔드 이미지가 Flyway V1, V2를 적용했고 2.1초 만에 기동했다.
  - 첫 기동 때 `monitoring_test` DB도 만들어졌다.
  - 시드 적재 후 `verify.sql` 통과 (Cluster 20, Node 200, Namespace 2,000, Pod 100,000)
  - db, backend, frontend 로그에 오류 없음
- 헬스체크: DB를 멈추면 `/actuator/health`가 503 `DOWN`, 다시 켜면 200 `UP`이었다. `/actuator/env`는 노출하지 않는다(404).
- 이미지 크기: backend 392MB, frontend 76MB
- nginx 경유 API: 트리 4종, 검색, 필터(트리·검색), Namespace·Pod 상세가 모두 200이었다.
- nginx 경유 화면: 브라우저에서 탐색 → 상세 → 검색 → ERROR 필터 → 새로고침을 실행했다. API 요청은 모두 화면과 같은 출처(`localhost:13001/api/v1/...`)로 나갔고 오류 표시는 없었다. 새로고침은 Cluster 목록, 펼친 분기 2개, 현재 검색, 열린 상세 5건만 다시 요청했다.
