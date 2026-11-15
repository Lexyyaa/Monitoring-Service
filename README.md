# Infrastructure Monitoring Service

Kubernetes의 Cluster → Node → Namespace → Pod를 탐색하고 상태를 확인하는 모니터링 서비스다. 실제 Kubernetes에 연결하지 않고, PostgreSQL에 적재한 Mock 데이터(Cluster 20, Node 200, Namespace 2,000, Pod 100,000)를 조회한다.

## 실행하기

**필요한 도구:** Docker Desktop. 로컬 개발 실행에는 Java 21, Node.js와 npm도 필요하다. 명령은 프로젝트 루트에서 시작한다.

### 컨테이너로 한 번에 실행

```sh
docker compose up -d --build --wait
docker compose exec -T db psql -X -U monitoring -d monitoring -v ON_ERROR_STOP=1 -1 -f /dev/stdin < scripts/seed.sql
docker compose exec -T db psql -X -U monitoring -d monitoring -v ON_ERROR_STOP=1 -f /dev/stdin < scripts/verify.sql
```

- 화면은 `http://localhost:3000`, API는 `http://localhost:8080/api/v1`, 상태 확인은 `http://localhost:8080/actuator/health`다.
- 백엔드가 시작할 때 Flyway가 스키마와 검색 인덱스를 만든다. 두 번째·세 번째 명령이 Mock 데이터를 적재하고 확인한다. `seed.sql`은 이미 있는 ID를 건너뛴다.
- 포트가 겹치면 `DB_PORT`, `BACKEND_PORT`, `FRONTEND_PORT`로 바꾼다.

### 로컬 개발 실행

1. DB를 띄운다. 빈 볼륨으로 처음 뜰 때 개발 DB `monitoring`과 테스트 DB `monitoring_test`가 만들어진다.

   ```sh
   docker compose up -d --wait db
   ```

2. Backend를 실행한다 (`http://localhost:8080`). 처음 실행하면 Flyway가 스키마를 만든다. 그다음 위의 시드 명령으로 Mock 데이터를 적재한다.

   ```sh
   cd backend
   ./gradlew bootRun
   ```

   Java 21이 자동 선택되지 않으면 `JAVA_HOME=$(/usr/libexec/java_home -v 21) ./gradlew bootRun`을 쓴다. 백엔드 Gradle 프로젝트는 `backend/` 폴더다.

3. Frontend를 실행한다 (`http://localhost:5173`). Vite가 `/api`를 Backend로 전달한다.

   ```sh
   cd frontend
   npm ci
   npm run dev
   ```

### 테스트

| 대상 | 명령 | 비고 |
| --- | --- | --- |
| Backend | `cd backend && ./gradlew spotlessCheck test` | 테스트 DB `monitoring_test`에 시드를 적재해야 한다 (`-d monitoring_test`로 시드 명령 실행) |
| Frontend | `cd frontend && npm run format:check && npm run build && npm test` | Vitest, Testing Library, MSW |
| E2E | `scripts/e2e/env.sh up` 후 `cd frontend && E2E_BASE_URL=http://localhost:13100 E2E_DB_CONTAINER=monitoring-e2e-db-1 npm run test:e2e` | 개발 환경과 분리된 Compose 프로젝트에서 DB 값을 바꾸는 테스트까지 실행한다 |

## 사용한 기술과 선택 이유

| 기술 | 사용한 이유 |
| --- | --- |
| Java 21 · Spring Boot 3.5 | 조회 API, 입력 검증, 공통 오류 응답을 구현한다. |
| PostgreSQL 17 · Flyway | 10만 건 이상을 DB에서 조건 조회하고, 관계 제약과 인덱스를 스키마로 관리한다. |
| JPA · QueryDSL | 트리·상세의 필터 조건을 타입 안전하게 조합하고 필요한 컬럼만 읽는다. 네 종류 통합 검색은 정렬·페이지를 DB에서 한 번에 하려고 네이티브 `UNION ALL`을 쓴다. |
| React 19 · TypeScript · Vite | 탐색·선택 상태를 컴포넌트로 나누고 API 응답 타입을 확인한다. |
| TanStack Query 5 | 조회 캐시와 요청 취소를 맡고, 늦게 온 이전 응답이 현재 검색·필터 결과를 덮지 않게 한다. |
| Docker Compose · nginx · GitHub Actions | 한 명령으로 DB·백엔드·화면을 띄우고, PR마다 테스트와 이미지 빌드를 확인한다. |

선택지와 비용을 포함한 근거는 [설계 결정 기록](docs/design/02-adr.md)에 있다.

## 프로젝트 구조

```text
backend/            Spring Boot API (presentation / application / domain / infrastructure), Flyway, Dockerfile
frontend/           React 화면 (app / pages / features / shared), 단위·컴포넌트·E2E 테스트, Dockerfile·nginx.conf
scripts/            Mock 시드·검증 SQL, 실행계획 SQL, k6·브라우저 측정 스크립트, E2E 격리 환경
docs/design/        요구사항, 설계 결정, 데이터 모델, API 명세·OpenAPI, 아키텍처, 테스트 시나리오, 작업 계획
docs/report/        기능·브라우저·API/DB 측정 결과
docs/ai-log/        브랜치별 작업 기록
docker-compose.yml  db·backend·frontend 서비스
.github/workflows/  CI (백엔드 테스트, 프론트 검증, 이미지 빌드)
```

## 구현한 기능

- **트리 탐색:** 첫 화면에는 Cluster만 가져온다. 펼친 리소스의 직접 하위만 조회하고, 접었다 다시 펼치면 받은 목록을 재사용한다.
- **상세 확인:** 리소스를 고르면 오른쪽 패널에 이름·고유 상태·심각도·마지막 갱신·조회 시각, 종류별 속성, 탐색 경로를 보여 준다.
- **전체 검색:** 펼치지 않은 분기까지 이름으로 검색한다. 20건씩 가져오며, 결과를 고르면 필요한 분기만 펼치고 그 행으로 이동한다.
- **상태 필터:** 심각도(`NONE`·`WARNING`·`ERROR`·`UNKNOWN`)로 트리와 검색을 좁힌다. 자기 일치(`MATCH`)와 아래에 일치가 있는 경로(`PATH`)를 구분하고, 화면 위에 각 코드의 뜻을 범례로 보여 준다.
- **데이터 갱신:** 30초 폴링과 수동 새로고침으로 화면에서 쓰는 조회만 다시 읽는다. 검색어·필터·펼침·선택을 유지하고, 실패하면 이전 데이터를 유지한 채 영역마다 오류와 재시도를 보여 준다.

## 구현 과정에서 고려한 사항

- **화면 계층과 실제 소속의 차이:** 화면은 Node → Namespace지만 Namespace의 실제 소속은 Cluster다. Node 아래 Namespace는 그 Node의 Pod로 찾고, 같은 Namespace가 여러 Node 아래에 나오는 경우를 시드·테스트·상세(`nodeId`)까지 같은 규칙으로 다룬다 ([ADR-001](docs/design/02-adr.md)).
- **고유 상태와 이상 심각도의 분리:** `Ready`, `Running` 같은 고유 상태와 심각도를 따로 보여 준다. 자식의 이상으로 부모의 심각도를 바꾸지 않고, 필터에서는 부모를 `PATH`로 표시한다. `PATH`는 트리에서 실제로 펼쳐 도달할 수 있는 하위만 근거로 한다.
- **실패와 늦은 응답:** 한 영역의 조회가 실패하면 그 영역에만 오류와 재시도를 보여 주고 이전 데이터를 유지한다. 캐시 키에 검색어·필터·선택을 넣어 늦게 온 이전 응답이 현재 화면을 덮지 않는다.
- **측정으로 확인한 뒤 고친 것:** 펼친 분기가 많을 때 스크롤 중 폴링이 겹치면 16fps까지 떨어져, 스크롤 중에는 폴링을 미뤘다. Lighthouse에서 SEO 항목과 배지 색 대비를 고쳤다. 검색 인덱스는 실행계획과 같은 조건의 전후 비교로만 추가했다.
- **테스트 범위:** 지키는 위험이 분명한 시나리오를 단위·통합·컴포넌트·E2E로 자동화하고, 나머지는 수동 확인으로 기록했다 ([테스트 시나리오](docs/design/06-test-scenarios.md)).

## 설계 문서 필수 항목

### 프론트엔드 렌더링 전략

- 트리는 펼친 단계만 요청하고, 고정 높이 행의 가상 스크롤로 화면 근처 행만 그린다. 행 2,220개를 펼쳐도 DOM의 행은 40개 이하다.
- 검색은 20건씩 이어 받는다. 목록 응답에는 상세 속성을 넣지 않고, 상세는 고른 한 건만 읽는다.
- 갱신은 바뀐 값만 반영한다. 행 요소를 새로 만들지 않는다.
- 자세한 구조는 [아키텍처](docs/design/05-architecture.md)와 [ADR-002·005·006](docs/design/02-adr.md)에 있다.

### 계층 데이터 모델링

- Cluster·Node·Namespace·Pod를 종류별 테이블로 두고, Node와 Namespace는 각각 Cluster에 속한다.
- Pod는 `(cluster_id, node_id)`, `(cluster_id, namespace_id)` 복합 FK로 같은 Cluster의 Node·Namespace만 참조한다. DB가 다른 Cluster 데이터가 섞이는 것을 막는다.
- 화면의 Node → Namespace 경로는 Pod 배치로 도출한다.
- 테이블과 제약은 [데이터 모델](docs/design/03-data-model.md)에 있다.

### 인덱스와 쿼리 전략

- 트리: `nodes(cluster_id, name, id)`, `namespaces(cluster_id, name, id)`, `pods(node_id, namespace_id, name, id)` B-tree. Node 아래 Namespace와 Pod 목록은 인덱스만 읽는다.
- 필터: 자기 일치 OR 하위 `EXISTS`를 DB에서 판단한다.
- 검색: Namespace·Pod의 `lower(name)`에 `pg_trgm` GIN 인덱스. 3자 이상 검색의 순차 스캔이 사라져 API p95가 20.7ms에서 5.2ms가 됐다. 1~2자 검색에는 효과가 없다.
- 실행계획과 전후 비교는 [API·DB 성능 측정](docs/report/03-server-performance.md)에 있다.

### API 설계

모든 조회 API는 `/api/v1` 아래 GET이다.

```text
/clusters
/clusters/{clusterId}/nodes
/nodes/{nodeId}/namespaces
/nodes/{nodeId}/namespaces/{namespaceId}/pods
/resources/search?q=&page=
/resources/{resourceType}/{resourceId}?nodeId=
```

- `issueLevel`로 심각도를 걸고, 전체 보기는 파라미터를 생략한다.
- 목록과 상세는 리소스 변경 시각 `lastUpdatedAt`과 조회 시각 `fetchedAt`을 따로 돌려준다.
- 오류는 `{code, message}` 형식이다 (400·404·405·500·503).
- 별도 갱신 API 없이 현재 화면에서 쓰는 GET을 다시 호출한다.
- 필드와 오류는 [API 명세](docs/design/04-api-spec.md)와 [OpenAPI](docs/design/openapi.yaml)를 따른다.

## 성능 측정 결과

Chrome, CPU 4배 감속, 캐시 비활성화 조건이다. 빌드한 이미지로 띄운 격리 환경에서 3회 측정했다.

| 항목 | 목표 | 결과 |
| --- | --- | --- |
| 첫 Cluster 표시·조작 가능 | 500ms 이내 | 164.7–352.7ms (첫 회는 백엔드 기동 직후) |
| 트리 펼침·접힘 | 100ms 이내 | 펼침 47.2–79.4ms, 접힘 33.7–34.6ms |
| 검색 결과 표시 (디바운스 제외) | 300ms 이내 | 42.6–61.2ms |
| 필터 반영 | 200ms 이내 | 50.6–99.1ms |
| 대량 목록 스크롤 | 55fps 이상 | 2,220행에서 60fps, 스크롤 중 폴링이 겹쳐도 60fps |
| 값이 바뀐 갱신의 응답 후 화면 반영 | 200ms 이내, 깜빡임 없음 | 분기 1개 25.5–31.6ms, 행 교체 없음 |
| 탭 메모리 | 참고 300MB 이하 | JS 힙 5.2MB (첫 화면 사용), 24.3MB (2,270행 펼침) |
| Lighthouse | — | 성능·접근성·권장사항·SEO 모두 100 |

- API 부하(k6, 5 VU, 20초): 1,330요청, 실패 0%, 전체 p95 8.54ms.
- 측정 방법과 한계는 [브라우저 성능](docs/report/02-browser-performance.md), [API·DB 성능](docs/report/03-server-performance.md)에 있다.
- GitHub Actions에서 백엔드 테스트(시드 10만 건 포함), 프론트 검증, 이미지 빌드가 원격으로 실행돼 통과했다 ([테스트 결과](docs/report/01-test-results.md)).

## 추가한 기능과 이유

요구사항에는 없지만 운영자가 상태를 잘못 읽지 않도록 추가했다.

- **마지막 변경 시각과 조회 시각 분리:** 방금 읽은 오래된 상태를 새 상태로 오해하지 않게 한다.
- **필터 경로 표시(`PATH`)와 범례:** 오류 리소스로 가는 부모를 오류로 오해하지 않게 하고, 각 코드의 뜻을 화면에서 바로 알 수 있게 한다.
- **필터 불일치 안내:** 갱신 후 고른 리소스가 필터에서 빠져도 상세와 탐색 맥락을 유지한다.
- **갱신 실패 시 이전 데이터 표시:** 일시 장애 동안 화면이 비지 않고, 어느 영역이 이전 데이터인지 알린다.
- **스크롤 중 폴링 연기:** 대량 트리를 스크롤하는 동안 갱신 응답 처리로 프레임이 떨어지지 않게 한다. 수동 새로고침은 미루지 않는다.
- **검색 결과 행으로 자동 스크롤:** 검색으로 연 리소스가 가상 스크롤 밖에 있어도 화면 가운데로 가져온다.
- **창 크기에 맞춘 배치:** 넓은 화면에서는 상세 패널이 본문 옆 칸으로 들어가고, 좁은 화면에서는 본문 위에 덮인다.

## 아쉬운 점과 개선하고 싶은 부분

- **대량 측정 범위:** DB에는 Pod 10만 건이 있지만 화면은 펼친 부모의 하위만 조회한다. 스크롤은 Cluster·Node를 모두 펼친 2,220행 기준으로 측정했다.
- **펼친 분기가 많을 때의 갱신:** 분기마다 요청을 따로 보낸다. 분기 220개를 펼친 갱신은 응답 후 반영이 약 450ms로 목표를 넘는다. 여러 분기를 한 번에 받는 API가 있으면 줄일 수 있지만 API 계약이 바뀌어 이번 범위에 넣지 않았다.
- **트리 하위 목록의 페이지 없음:** 한 부모의 직접 하위는 한 번에 받는다. 현재 데이터는 Namespace당 Pod 50개라 문제가 없지만, 한 곳에 수천 개가 몰리면 응답이 커진다.
- **넓은 검색:** `ns-`처럼 2,000건이 일치하는 검색은 대표 Node를 찾는 비용 때문에 약 110ms다. OFFSET 페이지라 깊은 페이지일수록 느려진다.
- **탭 메모리:** Chrome 작업관리자 값을 자동으로 읽지 못해 JS 힙으로 대신 기록했다.
- **운영 관측:** `/actuator/health`만 노출한다. 요청 로깅·메트릭·추적과 Kubernetes 배포 구성은 없다.

실제 Kubernetes 수집, 이상 판정 엔진, 이력·차트·알림·권한 관리는 현재 범위에 포함하지 않았다.
