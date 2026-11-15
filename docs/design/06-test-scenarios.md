# 테스트 시나리오

각 시나리오에 입력과 기대 결과를 적는다. 코드 값은 [요구사항의 코드 정의](01-requirements.md#코드-정의)를 따른다. 실행 결과는 [테스트 결과](../report/01-test-results.md)에 기록한다.

## 시나리오 선정 기준

- **자동 테스트 29건:** 테스트가 없으면 실제 사고로 이어질 위험이 분명한 것만 고른다.
  각 시나리오에 `지키는 위험`을 적는다.
  - 다른 Cluster 데이터가 섞이거나 잘못된 경로가 열림
  - 필터·공유 Namespace에서 잘못된 리소스가 보이거나 빠짐
  - 검색 페이지 경계, 와일드카드 문자, 잘못된 입력 처리
  - 실패한 영역 밖의 화면이 깨지거나 이전 데이터가 사라짐
  - 늦은 응답이 최신 결과를 덮음, 대량 데이터를 한 번에 그림
- **수동 확인 시나리오 38건:** 단순하거나 다른 시나리오와 겹치는 것은 코드로 만들지 않는다.
  브라우저·API·SQL로 직접 확인하고 결과를 남긴다.
- **핵심 26건:** 서비스 필수 기능과 데이터 무결성을 대표하는 시나리오다. `핵심`으로 표시한다.
  자동 테스트 15건과 수동 확인 11건으로 나뉜다.

## 테스트 종류와 실행

| 종류 | 확인하는 것 | 도구 | 위치 |
| --- | --- | --- | --- |
| 단위 | 한 클래스·함수의 규칙 | JUnit 5·Mockito, Vitest | `backend/src/test/.../domain`, `support`, `frontend/tests/unit` |
| 통합 | Controller부터 SQL·DB 제약까지 | `@SpringBootTest`, 실제 PostgreSQL | `backend/src/test/.../integration` |
| 컴포넌트 | 화면을 그리고 클릭·입력한 결과 | Vitest, React Testing Library, MSW(가짜 API) | `frontend/tests/component` |
| E2E | 실제 Chrome·서버·DB로 사용자 흐름 | Playwright | `frontend/tests/e2e` |
| 성능 | 목표 시간·FPS·메모리 | Chrome DevTools, Lighthouse, k6 | `scripts/perf`, `scripts/k6` |

- 백엔드: `cd backend && ./gradlew test`
  - 통합 테스트는 시드를 적재한 개발 DB(`localhost:5432`)가 떠 있어야 한다.
  - 데이터를 바꾸는 검사는 테스트 트랜잭션 안에서 하고 롤백한다.
- 프론트 단위·컴포넌트: `cd frontend && npm test`
- 프론트 E2E: 백엔드·프론트 서버를 띄운 뒤 `npm run test:e2e`
  - `E2E_BASE_URL`: 프론트 주소 (기본 `http://localhost:5173`)
  - `E2E_DB_CONTAINER`: DB 값을 바꾸는 테스트용 임시 DB 컨테이너.
    없으면 그 테스트는 건너뛰고, 개발 DB 컨테이너 이름이면 실행을 거부한다.

## 사전 조건

- 기본 Mock 데이터: Cluster 20, Node 200, Namespace 2,000, Pod 100,000건 이상
- 공유 Namespace는 [전용 시드](../../scripts/seed-shared-namespace.sql)를 별도 테스트 DB에만 적용한다.
  백엔드 통합 테스트는 같은 변경을 테스트 트랜잭션 안에서 적용하고 롤백한다.
- 아래 이름은 논리적 테스트 별칭이다.
  - `C-A`, `C-B`: 서로 다른 Cluster
  - `N-A1`, `N-A2`: `C-A`의 Node. `N-B1`: `C-B`의 Node
  - `NS-SHARED`: `N-A1`·`N-A2` 양쪽에 Pod가 있는 `C-A`의 Namespace
  - `P-ERROR`: `NS-SHARED`에 있는 ERROR Pod. 부모들의 자체 심각도는 NONE
- 시드 기준 실제 값: `C-A` = `cluster-01`(ID 1), `N-A1` = `node-01-01`(ID 1), `N-A2` = `node-01-02`(ID 2),
  `NS-SHARED` = `ns-01-001`(ID 1), `P-ERROR` = `pod-payment-api-error`(ID 1), `C-B`의 첫 Node·Namespace는 ID 11·101

## 단위 테스트

### 실패 케이스

- **UNIT-01** 없는 Cluster의 Node 목록을 요청하면 404 예외이고 하위 조회를 하지 않는다
  - 지키는 위험: 없는 부모에 빈 목록을 돌려줘 사용자가 "하위 없음"으로 오해함
  - Given: `findCluster(999)`가 빈 `Optional`
  - When: `listNodes(999, null)`
  - Then: `RESOURCE_NOT_FOUND`, `findNodes` 호출 없음
  - 테스트: `ResourceServiceTest`
- **UNIT-02** Node와 다른 Cluster의 Namespace로 Pod 목록을 요청하면 404 예외다
  - 지키는 위험: 다른 Cluster의 Pod가 섞여 보임
  - Given: Node 10은 Cluster 1, Namespace 200은 Cluster 2 (`Node.requireSameCluster`가 판단)
  - When: `listPods(10, 200, null)`
  - Then: `RESOURCE_NOT_FOUND`, `findPods` 호출 없음
  - 테스트: `ResourceServiceTest`
- **UNIT-03** Namespace가 아닌 상세에 nodeId를 주면 400 예외다
  - 지키는 위험: 의미 없는 파라미터를 조용히 무시해 잘못된 요청을 놓침
  - Given: 리소스 종류 `POD`, `nodeId = 1`
  - When: `getDetail(POD, 1, 1L)`
  - Then: `INVALID_PARAMETER`, 상세 Repository 호출 없음
  - 테스트: `ResourceServiceTest`
- **UNIT-05** 조회 중이나 트랜잭션 시작 때 DB 연결이 실패하면 503
  - 지키는 위험: DB 장애를 404·500으로 보내 화면이 "없음"이나 "버그"로 안내함
  - Given: 서비스가 `DataAccessResourceFailureException`, 다음에 `CannotCreateTransactionException`을 던짐
  - When: `GET /api/v1/clusters` 두 번
  - Then: 둘 다 503 `SERVICE_UNAVAILABLE`
  - 테스트: `GlobalExceptionHandlerTest`
- **UNIT-06** 예상하지 못한 오류는 내부 메시지 없이 500
  - 지키는 위험: 예외 메시지로 내부 정보가 응답에 노출됨
  - Given: 서비스가 `IllegalStateException("secret bug")`를 던짐
  - When: `GET /api/v1/clusters`
  - Then: 500 `INTERNAL_ERROR`, 응답 본문에 `secret bug` 없음
  - 테스트: `GlobalExceptionHandlerTest`

### 엣지 케이스

- **UNIT-04** 검색은 21건을 읽어 20건만 돌려주고 hasNext로 다음 페이지를 알린다
  - 지키는 위험: 다음 페이지가 있는데 "더 보기"가 안 나오거나, 총건수를 세느라 느려짐
  - Given: Repository가 21건을 돌려줌
  - When: `search("  api  ", null, 2)`
  - Then: Repository는 `("api", null, 40, 21)`로 호출, 결과 20건, `hasNext = true`
  - 테스트: `ResourceServiceTest`
- **UNIT-07** 같은 Namespace도 Node 경로가 다르면 행 key와 하위 요청 경로가 다르다
  - 지키는 위험: 공유 Namespace의 두 행이 하나로 섞여 펼침·선택이 엉뚱한 Node로 감
  - Given: Namespace ID 1
  - When: Node 1과 Node 2 아래의 행 key, 하위 요청 정보를 만듦
  - Then: key가 서로 다름, Node 2 아래 하위 요청에는 `nodeId: 2`
  - 테스트: `frontend/tests/unit/treeRows.test.ts`

## 통합 테스트

### 성공 케이스

- **애플리케이션 기동** 실제 DB 스키마로 애플리케이션이 뜬다
  - 지키는 위험: 엔티티와 Flyway 스키마가 어긋난 채 배포됨
  - Given: Flyway가 적용된 PostgreSQL, `ddl-auto=validate`
  - When: 컨텍스트 기동
  - Then: 기동 성공
  - 테스트: `MonitoringApplicationTests`
- **FILTER-T02** · 핵심 ERROR 필터에서 정상 부모는 PATH, 오류 Pod는 MATCH다
  - 지키는 위험: 하위 오류 때문에 부모가 오류로 보이거나, 경로가 끊겨 오류 Pod에 갈 수 없음
  - Given: `C-A`·`N-A1`·`NS-SHARED`는 NONE, `P-ERROR`는 ERROR
  - When: `issueLevel=ERROR`로 Cluster → Node → Namespace → Pod 목록 차례로 조회
  - Then: 부모 셋은 `issueLevel=NONE`·`matchRole=PATH`, Pod는 `P-ERROR` 하나만 `MATCH`
  - 테스트: `ResourceApiIntegrationTest`

### 실패 케이스

- **DB-03** · 핵심 Pod가 다른 Cluster의 Node를 참조하면 INSERT가 거절된다
  - 지키는 위험: 잘못된 데이터가 들어와 다른 Cluster의 Pod가 트리에 섞임
  - Given: Cluster 1 소속 Pod
  - When: Cluster 2의 Node(ID 11)로 INSERT
  - Then: `pods_cluster_node_fk` 위반 (롤백)
  - 테스트: `DatabaseConstraintIntegrationTest`
- **DB-04** · 핵심 Pod가 다른 Cluster의 Namespace를 참조하면 INSERT가 거절된다
  - 지키는 위험: 잘못된 데이터가 들어와 다른 Cluster의 Namespace에 Pod가 붙음
  - Given: Cluster 2 소속 Pod
  - When: Cluster 1의 Namespace(ID 1)로 INSERT
  - Then: `pods_cluster_namespace_fk` 위반 (롤백)
  - 테스트: `DatabaseConstraintIntegrationTest`
- **TREE-T07** Node와 다른 Cluster의 Namespace로 Pod 목록을 요청하면 404
  - 지키는 위험: 주소를 조합하면 다른 Cluster 데이터가 응답됨
  - Given: Node 1(Cluster 1), Namespace 101(Cluster 2)
  - When: `GET /nodes/1/namespaces/101/pods`
  - Then: 404 `RESOURCE_NOT_FOUND`
  - 테스트: `ResourceApiIntegrationTest`
- **DETAIL-T05** 없는 리소스나 이 Namespace의 Pod가 없는 Node로 상세를 요청하면 404
  - 지키는 위험: 존재하지 않는 경로의 상세가 그럴듯하게 보임
  - Given: 없는 Pod ID 999999, Namespace 1과 다른 Cluster의 Node 11
  - When: `GET /resources/POD/999999`, `GET /resources/NAMESPACE/1?nodeId=11`
  - Then: 둘 다 404 `RESOURCE_NOT_FOUND`
  - 테스트: `ResourceApiIntegrationTest`
- **SEARCH-T09** · 핵심 공백 검색어·음수 페이지·200자 초과 검색어·0 이하 경로 ID는 400
  - 지키는 위험: 잘못된 입력이 전체 조회나 서버 오류로 이어짐
  - Given: 검색·트리 API
  - When: `q=" "`, `q=api&page=-1`, 201자 `q`, 200자 `q`, `/clusters/0/nodes`
  - Then: 200자만 200, 나머지는 400 `INVALID_PARAMETER`
  - 테스트: `ResourceApiIntegrationTest`

### 엣지 케이스

- **SEARCH-T03** · 핵심 검색 결과 0·20·21건에서 페이지와 hasNext가 맞다
  - 지키는 위험: 경계에서 한 건이 빠지거나 빈 다음 페이지가 생김
  - Given: 결과가 0건, 20건(`case20only`), 21건(`case21only`)인 검색어
  - When: 각각 첫 페이지, 21건은 두 번째 페이지도 조회
  - Then: 0건 `hasNext=false` / 20건 `hasNext=false` / 21건 20건 + `hasNext=true`, 다음 페이지 1건
  - 테스트: `ResourceApiIntegrationTest`
- **SEARCH-T11** 검색어의 %와 _는 와일드카드가 아니라 글자로 찾는다
  - 지키는 위험: `%`나 `_` 한 글자 검색이 전체 리소스를 돌려줌
  - Given: 이름에 `%`·`_`가 없는 시드
  - When: `q=%`, `q=_`
  - Then: 둘 다 빈 결과
  - 테스트: `ResourceApiIntegrationTest`
- **FILTER-T06** · 핵심 다른 Node의 오류 Pod 때문에 공유 Namespace가 잘못 노출되지 않는다
  - 지키는 위험: 오류 Pod가 없는 Node 아래에도 공유 Namespace가 경로로 나타남
  - Given: 공유 시드 적용 (`NS-SHARED`가 `N-A1`·`N-A2`에 걸치고 `P-ERROR`는 `N-A2`에만 있음)
  - When: `issueLevel=ERROR`로 `N-A1`, `N-A2`의 Namespace 목록 조회
  - Then: `N-A2`에는 `NS-SHARED`가 `PATH`로 있고, `N-A1`에는 없음
  - 테스트: `ResourceApiIntegrationTest`

## 컴포넌트 테스트

가짜 API(MSW)의 작은 데이터로 실제 화면(`App`)을 그린다.
데이터: `cluster-01`(Node 2개, 공유 Namespace 포함), `cluster-02`, Pod 7개 (`frontend/tests/mocks/data.ts`)

### 성공 케이스

- **REFRESH-T03** 갱신해도 필터·검색어·펼침·선택이 그대로다
  - 지키는 위험: 새로고침할 때마다 사용자가 보던 위치를 잃음
  - Given: 필터 WARNING, `cluster-01` 펼침·상세 열림, 검색어 `pod`
  - When: 새로고침 클릭, 완료까지 기다림
  - Then: 필터·검색어·펼침·상세가 모두 그대로
  - 테스트: `success.test.tsx`

### 실패 케이스

- **TREE-T08** · 핵심 하위 조회가 실패하면 그 분기에만 오류와 재시도를 보여 준다
  - 지키는 위험: 한 분기 실패로 트리 전체가 사라짐
  - Given: `cluster-01`의 Node 목록 API가 503
  - When: `cluster-01` 펼침 → API 정상화 → 재시도 클릭
  - Then: 그 분기에만 "오류 · 재시도", `cluster-02`는 그대로. 재시도 후 Node 표시
  - 테스트: `failure.test.tsx`
- **SEARCH-T08** · 핵심 검색이 실패하면 검색 영역에만 오류를 보여 주고 트리·상세는 지킨다
  - 지키는 위험: 검색 실패가 트리와 상세까지 비움
  - Given: 검색 API가 503, 트리 펼침과 상세가 있음
  - When: 검색어 입력 → API 정상화 → 다시 시도
  - Then: 검색 영역에 오류 문구와 재시도, 트리·상세 유지. 재시도 후 결과 표시
  - 테스트: `failure.test.tsx`
- **FILTER-T08** 바꾼 필터의 조회가 실패하면 트리 영역에 오류와 재시도를 보여 준다
  - 지키는 위험: 다른 필터의 목록이 새 필터 결과처럼 보이거나, 입력·선택이 초기화됨
  - Given: ERROR 필터의 Cluster 목록 API가 503, 상세와 검색어가 있음
  - When: 필터를 ERROR로 변경 → API 정상화 → 다시 시도
  - Then: 트리 영역에 오류와 재시도, 트리 행은 비어 있음, 검색어·필터 선택·상세 유지. 재시도 후 `PATH` 행 표시
  - 테스트: `failure.test.tsx`
- **REFRESH-T07** · 핵심 갱신이 실패해도 마지막 성공 데이터를 유지한다
  - 지키는 위험: 일시 장애 동안 화면이 비거나, 새로고침 버튼이 잠겨 복구할 수 없음
  - Given: 트리·검색·상세가 보이는 상태에서 모든 API가 503으로 바뀜
  - When: 새로고침 클릭, 그리고 30초 폴링 1회
  - Then: 기존 행·상세·검색 결과 유지, 오류 3곳 이상 표시, 버튼 사용 가능, 마지막 성공 조회 시각 그대로
  - 테스트: `failure.test.tsx`

### 엣지 케이스

- **SEARCH-T06** 300ms 안에 연달아 입력하면 마지막 검색어만 요청한다
  - 지키는 위험: 글자마다 검색 요청이 나가 서버와 화면이 부담을 받음
  - Given: 검색창
  - When: `pod`를 빠르게 입력
  - Then: 검색 요청은 `q=pod` 1건
  - 테스트: `edge.test.tsx`
- **SEARCH-T07** · 핵심 늦게 온 예전 검색 응답이 최신 결과를 덮지 않는다
  - 지키는 위험: 검색어를 바꿨는데 예전 결과가 보임
  - Given: `payment` 검색 응답만 1초 늦춤
  - When: `payment` 입력 → 응답 전에 `pod-ok`로 변경 → 1.2초 더 기다림
  - Then: `pod-ok` 결과만 보이고 `payment-svc`는 없음
  - 테스트: `edge.test.tsx`
- **UX-T02** · 핵심 결과가 없으면 오류와 구별되는 빈 상태를 보여 준다
  - 지키는 위험: 0건을 오류로 안내하거나, 오류를 0건으로 안내함
  - Given: 일치하는 이름이 없는 검색어, NONE Pod만 맞는 검색어
  - When: 검색, 그리고 두 번째 검색어에 ERROR 필터
  - Then: 두 경우 모두 "검색 결과가 없습니다.", 오류 문구 없음
  - 테스트: `edge.test.tsx`

## E2E 테스트

### 성공 케이스

- **TREE-T02** · 핵심 펼친 부모의 직접 하위만 요청한다
  - 지키는 위험: 펼칠 때 하위 전체(Pod 10만 건)를 한 번에 받음
  - Given: 첫 화면 로딩이 끝남
  - When: `cluster-01` → `node-01-01` → `ns-01-001` 펼침
  - Then: 요청은 `/clusters/1/nodes`, `/nodes/1/namespaces`, `/nodes/1/namespaces/1/pods` 세 건뿐
  - 테스트: `explorer.spec.ts`
- **SEARCH-T05** · 핵심 검색 결과를 고르면 경로를 열고 상세를 표시한다
  - 지키는 위험: 검색으로 찾아도 트리에서 위치를 찾을 수 없음
  - Given: 첫 화면
  - When: `pod-payment-api-error` 검색 → 결과 클릭
  - Then: 그 Pod 행이 선택된 채 화면 안에 보이고, 상세 탐색 경로가 Cluster → Node → `ns-01-001` → Pod
  - 테스트: `explorer.spec.ts`
- **REFRESH-T01** · 핵심 수동 갱신하면 바뀐 심각도와 갱신 시각을 보여 준다
  - 지키는 위험: DB 값이 바뀌어도 화면이 예전 값을 계속 보여 줌
  - Given: 임시 DB, `P-ERROR` 상세가 열림
  - When: DB에서 심각도 NONE·갱신 시각 변경 → 새로고침 클릭
  - Then: 트리 행과 상세에 NONE과 새 갱신 시각. 테스트 끝에 DB 값을 되돌림
  - 테스트: `explorer.spec.ts` (`E2E_DB_CONTAINER` 필요)

### 엣지 케이스

- **TREE-T09** · 핵심 행이 수천 개여도 화면 근처 행만 그린다
  - 지키는 위험: 펼친 행이 많아지면 DOM이 커져 화면이 멈춤
  - Given: 첫 화면
  - When: Cluster 20개와 Node 200개를 모두 펼치며 끝까지 스크롤
  - Then: 표시 행 2,000개 이상, 그려진 행은 계속 40개 이하
  - 테스트: `explorer.spec.ts`

## 수동 확인 시나리오

자동 테스트로 만들지 않은 시나리오다. 직접 실행하고 관찰 결과를 [테스트 결과](../report/01-test-results.md)에 적는다.
항목마다 `확인`(무엇을), `방법`(어떻게), `예상`(기대 결과)으로 나눈다.

### DB·Mock

- **DB-01** · 핵심 데이터 건수
  - 확인: 시드가 요구 규모를 채우는가
  - 방법: 빈 DB에 시드를 적재하고 네 테이블 건수 조회 ([verify.sql](../../scripts/verify.sql))
  - 예상: Cluster 20, Node 200, Namespace 2,000, Pod 100,000건 이상
- **DB-02** · 핵심 공유 Namespace의 Node별 Pod
  - 확인: 한 Namespace가 여러 Node에 걸칠 수 있는가
  - 방법: 공유 시드를 적용하고 `NS-SHARED`의 Namespace 행 수와 Node별 Pod 수 조회
  - 예상: Namespace 행 1건, Pod는 `N-A1`·`N-A2`로 나뉨
- **DB-05** Node 없는 Pod
  - 확인: Node가 비어 있는 Pod를 막는가
  - 방법: `node_id = NULL`로 INSERT (`BEGIN … ROLLBACK`)
  - 예상: NOT NULL 제약으로 거절
- **DB-06** 허용 외 심각도
  - 확인: 정의되지 않은 심각도를 막는가
  - 방법: `issue_level`을 `CRITICAL`, `WARNING`으로 각각 INSERT (`BEGIN … ROLLBACK`)
  - 예상: `CRITICAL`은 CHECK 제약으로 거절, `WARNING`은 저장
- **DB-07** 시드 재실행
  - 확인: 시드를 두 번 실행해도 데이터가 그대로인가
  - 방법: 적재된 DB에 시드를 한 번 더 실행 (`BEGIN … ROLLBACK`)
  - 예상: Pod 건수, ID 합계, 최근 갱신 시각이 같음
- **DB-08** · 핵심 전체 Pod를 메모리에 올리지 않음
  - 확인: 어떤 화면 조작도 Pod 전체를 읽지 않는가
  - 방법: Hibernate SQL 로그를 켜고 트리·검색·상세·필터·갱신을 조작
  - 예상: `pods` 조회마다 부모 조건(`node_id`·`namespace_id`), `id` 조건, 또는 `LIMIT`이 있음

### 트리

- **TREE-T01** · 핵심 첫 화면
  - 확인: 첫 화면이 Cluster만 읽는가
  - 방법: 빈 캐시로 화면에 들어가 네트워크 요청 확인
  - 예상: Cluster 행만 표시, 요청은 `/clusters` 1건
- **TREE-T03** 접었다 다시 펼치기
  - 확인: 다시 펼칠 때 캐시를 쓰는가
  - 방법: `C-A`와 `N-A1`을 펼친 뒤 `C-A`를 접었다가 30초 안에 다시 펼침
  - 예상: 새 요청 없음, `N-A1`도 펼친 상태로 돌아옴
- **TREE-T04** 선택 후 다른 분기 펼치기
  - 확인: 펼침이 선택을 바꾸지 않는가
  - 방법: `P-ERROR` 상세를 연 채 `C-B`를 펼침
  - 예상: 상세 패널은 `P-ERROR` 그대로
- **TREE-T05** · 핵심 공유 Namespace를 양쪽 Node에서 표시
  - 확인: 공유 Namespace가 각 Node 아래에 따로 나오는가
  - 방법: 공유 시드 DB에서 `N-A1`, `N-A2`를 각각 펼침
  - 예상: 양쪽에 `NS-SHARED`가 한 행씩, 펼치면 그 Node의 Pod만 보임
- **TREE-T06** Node별 Namespace 중복 없음
  - 확인: 한 Node 아래 같은 Namespace가 두 번 나오지 않는가
  - 방법: Pod가 여러 개인 Namespace가 있는 Node를 펼침
  - 예상: Namespace마다 한 행
- **TREE-T10** 같은 Cluster지만 Pod가 없는 조합
  - 확인: 경로는 맞지만 Pod가 없는 경우를 오류로 보지 않는가
  - 방법: `GET /nodes/{N-A1}/namespaces/{N-A1에 Pod가 없는 C-A의 Namespace}/pods`
  - 예상: 200, 빈 목록

### 상세

- **DETAIL-T01** · 핵심 네 종류 상세
  - 확인: 종류마다 상세가 제대로 나오는가
  - 방법: Cluster·Node·Namespace·Pod 이름을 차례로 클릭
  - 예상: 상태·심각도·마지막 갱신·조회 시각, 종류별 속성, 탐색 경로가 오른쪽 패널에 보임
- **DETAIL-T02** 상태와 심각도를 따로 표시
  - 확인: 고유 상태와 심각도를 섞지 않는가
  - 방법: 상태 `Running`, 심각도 WARNING인 Pod 상세를 엶
  - 예상: `Running`과 `WARNING`이 각각 보임
- **DETAIL-T03** 공유 Namespace를 다른 Node 경로에서 선택
  - 확인: 클릭한 Node 경로가 상세에 유지되는가
  - 방법: `N-A2` 아래의 `NS-SHARED`를 클릭
  - 예상: 상세 경로의 Node가 `N-A2`, 요청에 `nodeId={N-A2}`
- **DETAIL-T04** nodeId 없는 공유 Namespace 상세
  - 확인: 경로를 주지 않으면 어떤 Node 경로를 쓰는가
  - 방법: 공유 시드 DB에서 `GET /resources/NAMESPACE/{NS-SHARED}`
  - 예상: Pod가 있는 Node 중 ID가 가장 작은 `N-A1` 경로 (검색 결과 경로와 같은 규칙)
- **DETAIL-T06** · 핵심 Namespace 외 상세에 nodeId
  - 확인: 의미 없는 `nodeId`를 거절하는가
  - 방법: `GET /resources/POD/{id}?nodeId=1`
  - 예상: 400 `INVALID_PARAMETER`
- **DETAIL-T07** 상세 로딩 상태
  - 확인: 상세를 받는 동안 로딩을 보여 주는가
  - 방법: 상세 응답을 늦추고 리소스를 클릭
  - 예상: 패널이 바로 열려 "상세 정보를 불러오는 중…" 표시 후 상세로 바뀜

### 검색

- **SEARCH-T01** 펼치지 않은 상태의 검색
  - 확인: 열지 않은 분기도 검색되는가
  - 방법: 첫 화면에서 아무것도 펼치지 않고 `api` 입력
  - 예상: Cluster·Node·Namespace·Pod가 모두 결과에 나옴
- **SEARCH-T02** 대소문자 무시와 부분 일치
  - 확인: 대소문자와 상관없이 이름 일부로 찾는가
  - 방법: `api`, `API`, `aPi`로 각각 검색
  - 예상: 세 결과가 같음
- **SEARCH-T04** 페이지 사이 정렬
  - 확인: 페이지를 넘겨도 순서가 안정적인가
  - 방법: 결과 21건인 검색어로 1·2페이지 조회
  - 예상: 합친 21건이 이름순, 중복·누락 없음
- **SEARCH-T10** 1~2자 검색
  - 확인: 아주 짧은 검색어도 정상 응답하는가
  - 방법: `q=a`, `q=ap` 검색
  - 예상: 200, 한 페이지 20건 이하와 알맞은 `hasNext`

### 필터

- **FILTER-T01** 심각도 4종 필터
  - 확인: 네 심각도 모두로 필터가 동작하는가
  - 방법: `/clusters?issueLevel=` NONE·WARNING·ERROR·UNKNOWN 각각 조회
  - 예상: 모두 200, 항목마다 `MATCH` 또는 `PATH`
- **FILTER-T03** 자체 일치·하위 불일치
  - 확인: 자기만 맞는 부모를 `MATCH`로 표시하는가
  - 방법: UNKNOWN 필터로 자기만 UNKNOWN인 Namespace와 그 Pod 목록 조회
  - 예상: Namespace는 `MATCH`, Pod 목록은 비어 있음
- **FILTER-T04** 필터 후 자동 확장 없음
  - 확인: 필터를 바꿔도 트리를 마음대로 펼치지 않는가
  - 방법: 펼친 행 수를 세고 필터를 ERROR로 변경
  - 예상: 펼친 행 수가 그대로
- **FILTER-T05** · 핵심 검색과 필터 AND
  - 확인: 검색어와 필터를 함께 적용하는가
  - 방법: `api` 검색 + ERROR 필터
  - 예상: 이름에 `api`가 있고 심각도가 ERROR인 리소스만 나옴
- **FILTER-T07** 필터 연속 전환
  - 확인: 필터를 연달아 바꿔도 마지막 결과만 보이는가
  - 방법: ERROR → WARNING → 전체 순서로 빠르게 전환
  - 예상: 단계마다 그 필터의 목록, 마지막에 전체 목록
- **FILTER-T09** 하위 일치가 없는 경로
  - 확인: 자기만 맞는 부모를 펼치면 빈 상태를 보여 주는가
  - 방법: FILTER-T03의 Namespace를 화면에서 펼침
  - 예상: "하위 리소스가 없습니다." 표시

### 갱신

- **REFRESH-T02** · 핵심 30초 폴링
  - 확인: 버튼을 누르지 않아도 바뀐 값이 반영되는가
  - 방법: 임시 DB에서 값을 바꾸고 30초 넘게 기다림
  - 예상: 화면 값이 바뀌고 펼친 분기는 그대로
- **REFRESH-T04** · 핵심 필터에서 빠진 리소스의 상세
  - 확인: 갱신으로 필터에서 빠져도 상세를 닫지 않는가
  - 방법: ERROR 필터에서 `P-ERROR` 상세를 연 채 DB 값을 NONE으로 바꾸고 새로고침
  - 예상: 트리·검색에서 빠지고, 상세는 열린 채 "ERROR 필터에 일치하지 않습니다" 안내
- **REFRESH-T05** 폴링 대상 범위
  - 확인: 폴링이 지금 화면에 쓰는 조회만 부르는가
  - 방법: 접은 분기와 펼친 분기를 만든 뒤 폴링 1회의 요청 확인
  - 예상: Cluster 목록, 펼친 분기, 현재 검색, 열린 상세만 요청
- **REFRESH-T06** 오래된 갱신 시각
  - 확인: 변경 시각과 조회 시각을 구분하는가
  - 방법: 몇 주 전에 바뀐 리소스 상세를 엶
  - 예상: "마지막 갱신"과 "조회 시각"이 다른 값으로 보임
- **REFRESH-T08** 폴링 중 수동 갱신
  - 확인: 폴링과 수동 갱신이 겹치지 않는가
  - 방법: 폴링 응답을 늦추고 그 사이 새로고침 버튼을 봄
  - 예상: 폴링 중에는 버튼이 "갱신 중…"으로 잠김, 끝나면 다시 사용 가능, 오류 없음
- **REFRESH-T09** UNKNOWN과 신선도
  - 확인: `UNKNOWN`을 "데이터가 오래됨"으로 쓰지 않는가
  - 방법: 심각도 UNKNOWN인 리소스 상세를 엶
  - 예상: 심각도와 두 시각이 따로 보이고 "오래됨" 같은 표시가 없음

### 오류·빈 상태

- **UX-T01** 영역별 로딩
  - 확인: 영역마다 자기 로딩을 보여 주는가
  - 방법: API 응답을 늦추고 펼치기·검색·상세 열기
  - 예상: 트리 "불러오는 중…", 검색 "검색 중…", 상세 "상세 정보를 불러오는 중…"
- **UX-T03** 실패 분기와 정상 상세 동시
  - 확인: 한 분기의 실패가 상세에 번지지 않는가
  - 방법: 한 분기의 하위 API만 503으로 만들고, 그 분기를 펼친 뒤 다른 리소스 상세를 엶
  - 예상: 실패 분기에만 오류, 상세는 정상
- **UX-T04** · 핵심 공통 오류 본문
  - 확인: 모든 오류가 같은 모양으로 오는가
  - 방법: 400·404·405·503이 나는 요청을 각각 보냄
  - 예상: 본문이 `{code, message}`, 화면은 실패한 영역에만 메시지와 재시도
- **UX-T05** 패널이 열린 채 스크롤
  - 확인: 스크롤해도 입력과 상세가 유지되는가
  - 방법: 검색어를 넣고 상세를 연 채 트리를 길게 스크롤
  - 예상: 검색어와 상세 패널이 그대로

## 성능 테스트

목표를 실제 측정으로 확인한다. 결과는 [브라우저](../report/02-browser-performance.md)와 [API·DB](../report/03-server-performance.md)에 따로 적는다.

- 브라우저 공통 조건: Chrome, CPU 4배 느리게, 캐시 끔, 3회 이상 측정
- 브라우저 측정 스크립트: [browser-perf.mjs](../../scripts/perf/browser-perf.mjs)

### 화면 (브라우저)

- **PERF-T01** 최초 화면
  - 확인: 첫 화면이 빨리 쓸 수 있게 되는가
  - 방법: 빈 캐시로 화면에 들어가 Cluster 목록이 조작 가능해질 때까지 측정
  - 예상: 500ms 이내
- **PERF-T02** 트리 펼침·접힘
  - 확인: 펼침·접힘이 바로 반응하는가
  - 방법: Cluster를 펼치고 접으며 클릭부터 화면 반영까지 측정
  - 예상: 100ms 이내
- **PERF-T03** 검색
  - 확인: 검색 결과가 빨리 나오는가
  - 방법: 검색어를 넣고 결과 표시까지 측정 (입력 대기 300ms는 빼고 계산)
  - 예상: 300ms 이내
- **PERF-T04** 필터
  - 확인: 필터 변경이 빨리 반영되는가
  - 방법: 필터를 바꾸고 트리의 `aria-busy`가 풀릴 때까지 측정
  - 예상: 200ms 이내
- **PERF-T05** 스크롤
  - 확인: 행이 많아도 스크롤이 부드러운가
  - 방법: 여러 분기를 펼치고 끝까지 스크롤하며 Performance 트레이스로 FPS 측정.
    스크롤 중 30초 폴링이 겹치는 경우도 따로 측정
  - 예상: 55fps 이상, 스크롤 중에는 폴링 요청 0건
- **PERF-T06** 갱신
  - 확인: DB 값이 바뀐 뒤 바뀐 부분만 빨리 반영되는가
  - 방법: 몇 개 분기를 펼친 상태에서 DB 값을 바꾸고 새로고침, 응답부터 화면 반영까지 측정.
    분기 100개 이상을 펼친 경우는 응답 대기와 화면 반영을 따로 기록
  - 예상: 전체 깜빡임 없이 200ms 이내
- **PERF-T07** 탭 메모리
  - 확인: 오래 써도 메모리가 과하지 않은가
  - 방법: 분기를 펼치고 검색·상세를 쓴 뒤 탭 메모리 측정
  - 예상: 300MB 이하 (참고 목표). 넘으면 원인과 개선 방향을 기록

### 서버

- **PERF-T08** API 부하
  - 확인: 여러 사용자가 동시에 써도 API가 안정적인가
  - 방법: `k6 run scripts/k6/api-load.js` (5 VU, 20초, 주요 GET 7종)
  - 예상: 실패율 1% 미만, API별 p50·p95 기록
- **PERF-T09** SQL 실행계획
  - 확인: 주요 조회가 인덱스로 필요한 행만 읽는가
  - 방법: [explain.sql](../../scripts/explain.sql)을 `EXPLAIN (ANALYZE, BUFFERS)`로 실행
  - 예상: 트리·상세는 인덱스 사용, 검색은 `pg_trgm` GIN 인덱스 사용
