# 기능 및 통합 테스트 결과

---

## 이 문서는

- **목적:** 과제가 요구한 기능(탐색, 상세, 검색, 필터, 갱신)이 실제로 맞게 동작하는지 확인한 기록이다.
- **맥락:** 기능마다 "이게 깨지면 어떤 사고가 나는가"를 기준으로 [테스트 시나리오](../design/06-test-scenarios.md)를 정했다. 다른 Cluster 데이터가 섞이거나, 실패 한 번에 화면이 비거나, 늦은 응답이 최신 결과를 덮는 경우 같은 것들이다.
- **확인 방법:** 각 시나리오를 자동 테스트(단위, 통합, 컴포넌트, E2E)로 돌리거나, 브라우저, API, SQL로 직접 확인했다. 항목마다 어느 방법으로 확인했는지 적는다.
- **읽는 법:** 맨 위가 최종 결과이고, 아래는 영역별 결과다.

---

## 최종 결과 (2026-11-15)

- 백엔드: `./gradlew spotlessCheck test` 59건 통과 (실제 PostgreSQL 테스트 DB)
- 프론트: `npm run format:check`, `npm run build`, `npm test` 41건 통과
- E2E: [격리 환경](../../scripts/e2e/env.sh)에서 10건 통과 (DB 값을 바꾸는 4건 포함, 바꾼 값은 끝에 되돌림)
- GitHub Actions: 백엔드 테스트(시드 10만 건 적재 포함), 프론트 검증, 이미지 빌드 세 작업이 원격에서 통과
  - [PR #8 실행](https://github.com/Lexyyaa/monitoring/actions/runs/43706296678), [머지 뒤 main 실행](https://github.com/Lexyyaa/monitoring/actions/runs/43706422555)
  - 이전 실행: [PR #7](https://github.com/Lexyyaa/monitoring/actions/runs/43702314026), [main](https://github.com/Lexyyaa/monitoring/actions/runs/43703975059)

### 최종 재검증에서 찾아 고친 것

- 필터를 버튼으로 바꾼 뒤 필터 E2E 2건이 실패했다.
- 원인: 화면에서 숨긴 라디오 입력을 E2E가 직접 누르려 했다.
- 사람처럼 버튼 라벨을 누르도록 고친 뒤 10건 모두 통과했다.

---

## DB와 Mock

- 환경: 로컬 Docker PostgreSQL 17.11
- 방법: 임시 DB를 만들어 Flyway V1 SQL과 `seed.sql`을 적용하고, 확인 뒤 지웠다.

- DB-01 데이터 건수 (확인)
  - `verify.sql` 통과: Cluster 20, Node 200, Namespace 2,000, Pod 100,000
  - (Node, Namespace) 경로 2,000개, Pod 없는 Namespace 0개
- DB-02 공유 Namespace의 Node별 Pod (확인)
  - `seed-shared-namespace.sql`을 트랜잭션 안에서 적용하고 롤백했다.
  - Namespace 1의 행은 1건, Pod는 Node 1에 49건, Node 2에 1건으로 나뉜다.
- DB-03 ~ DB-06 제약 (자동 테스트)
  - `DatabaseConstraintIntegrationTest` 5건 통과
  - 복합 FK 두 개, Node 없는 Pod의 NOT NULL, 심각도 CHECK
- DB-07 시드 재실행 (확인)
  - 적재된 DB에 `seed.sql`을 트랜잭션 안에서 한 번 더 실행하고 롤백했다.
  - 실행 전후 Pod 건수 100,000, ID 합계 5,000,050,000, 최근 갱신 시각이 같다.
- DB-08 전체 Pod를 메모리에 올리지 않음 (확인)
  - Hibernate SQL 로그를 켜고 트리, 상세, 검색, 필터를 조작했다.
  - 트리: Node 아래 Namespace는 `EXISTS (... node_id = ?)`, Pod 목록은 `WHERE node_id = ? AND namespace_id = ?`
  - 상세: `pods` 조회에 `id`, `namespace_id`, `node_id` 조건이 붙는다.
  - 검색: DB에서 정렬하고 `LIMIT 21`로 읽는다. 필터는 `EXISTS` 조건으로 DB에서 판단한다.

---

## 트리

- TREE-T01 ~ T05, T08: 컴포넌트 테스트 통과 (`tree.test.tsx`)
- TREE-T02: E2E 통과. 펼칠 때마다 직접 하위 요청 1건씩만 보냈다.
- TREE-T06: 저장소 통합 테스트 통과. 공유 Namespace를 만든 뒤에도 Node 아래 Namespace가 중복되지 않는다.
- TREE-T07: 통합 테스트 통과. 다른 Cluster의 Namespace로 Pod를 요청하면 404다.
- TREE-T09: E2E 통과. 2,220행을 펼치고 스크롤하는 동안 DOM의 행은 40개 이하였다.

---

## 상세

- UNIT-03: 단위 테스트 통과 (`ResourceServiceTest`)
- DETAIL-T05, T06과 Cluster, Node, Namespace, Pod 정상 응답: 통합 테스트 통과 (`ResourceApiIntegrationTest`)
- DETAIL-T03, T04의 API 규칙: 통합 테스트 통과. 공유 Namespace에서 `nodeId=2`는 Node 2 경로, `nodeId`가 없으면 Node 1 경로였다.
- DETAIL-T01 ~ T03, T07과 닫기 동작: 컴포넌트 테스트 통과 (`detail.test.tsx`)
- DETAIL-T01: E2E 통과. 실제 데이터로 상세와 경로를 확인했다.

---

## 검색

- UNIT-04: 단위 테스트 통과. 21건을 읽어 20건만 돌려주고 `hasNext`를 판단한다.
- SEARCH-T03, T09, T11: 통합 테스트 통과. 검색어는 앞뒤 공백을 지운 뒤 길이를 본다.
- SEARCH-T01, T05 ~ T08, UX-T02: 컴포넌트 테스트 통과 (`search.test.tsx`)
- SEARCH-T05: E2E 통과. 결과를 고르면 경로가 열리고 선택한 행이 화면 안에 보인다.

---

## 필터

- FILTER-T02, T05, T06, T09: 통합 테스트 통과 (`ResourceApiIntegrationTest`)
- PATH 근거: Pod가 없는 ERROR Namespace만 있는 Cluster는 ERROR 필터 결과에 나오지 않는다 (`ResourceTreeRepositoryIntegrationTest`)
- FILTER-T01, T03, T04, T05, T07, T08과 필터 불일치 안내: 컴포넌트 테스트 통과 (`filter.test.tsx`)
- FILTER-T05: E2E 통과. 실제 데이터에서 `api` + ERROR는 `pod-payment-api-error` 1건이다.
- 필터 불일치 안내는 현재 트리 행의 MATCH, PATH로 판단한다. 전체에서 고른 Cluster가 ERROR 필터에서 PATH이면 안내를 띄우지 않는다.

---

## 갱신과 신선도

- 변경 시각과 조회 시각: 통합 테스트 통과. Pod 3의 `lastUpdatedAt`은 2026-10-01, `fetchedAt`은 요청 시각이며 둘 다 UTC(`Z`) 형식이다.
- REFRESH-T01 ~ T09, SEARCH-T07: 컴포넌트 테스트 통과 (`refresh.test.tsx`, `search.test.tsx`)
- 스크롤 중 폴링 연기: 컴포넌트 테스트 통과. 스크롤 직후에는 폴링을 미루고, 스크롤이 멈추고 1초 뒤에 갱신한다.
- REFRESH-T01, T02, T04: 격리 환경 E2E 통과
  - 수동 갱신: 상세와 트리 행이 NONE과 새 갱신 시각으로 바뀌었다.
  - 30초 폴링: 버튼 없이 30.6초 만에 Node 심각도가 바뀌었고 펼친 분기는 그대로였다.
  - 필터에서 빠진 리소스: 트리에서 빠지고 상세는 남아 불일치를 알렸다.
- 갱신 실패 (확인): 백엔드를 실제로 내리고 새로고침하면 트리, 검색, 상세가 이전 데이터를 유지하고 세 영역에 "이전에 조회한 데이터를 보여 줍니다"와 재시도가 나왔다. 백엔드를 다시 올리고 새로고침하면 오류가 사라졌다.

---

## 컨테이너

- 빈 볼륨 기동 (확인): 새 Compose 프로젝트와 볼륨으로 `docker compose up -d --build --wait`
  - db, backend, frontend 모두 healthy
  - 백엔드 이미지가 Flyway V1, V2를 적용하고 2.1초 만에 기동했다.
  - 첫 기동 때 `monitoring_test` DB도 만들어졌다.
  - 시드 적재 후 `verify.sql` 통과, 세 서비스 로그에 오류 없음
- 헬스체크 (확인): DB를 멈추면 `/actuator/health`가 503 `DOWN`, 다시 켜면 200 `UP`. `/actuator/env`는 노출하지 않는다(404).
- 이미지 크기: backend 392MB, frontend 76MB
- nginx 경유 (확인)
  - API: 트리, 검색, 필터, 상세가 모두 200
  - 화면: 탐색, 상세, 검색, 필터, 새로고침 요청이 모두 화면과 같은 출처(`/api/v1/...`)로 나갔다.
  - 새로고침은 Cluster 목록, 펼친 분기 2개, 현재 검색, 열린 상세 5건만 다시 요청했다.
