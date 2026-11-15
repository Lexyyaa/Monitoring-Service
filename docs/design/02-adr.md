# 설계 결정과 이유

[요구사항](01-requirements.md)의 선택 근거다.
관계, 구성 그림은 [데이터 모델](03-data-model.md)과
[시스템 구조](05-architecture.md)에 있다.

---

## ADR-001: 리소스별 테이블과 복합 FK

- **상태:** Accepted
- **문제**
  - 화면은 Cluster → Node → Namespace → Pod 순서다.
  - 실제 Namespace는 Cluster 소속이다.
  - Pod 100,000건의 Cluster 관계를 DB에서 검증해야 한다.
- **검토한 방식**
  - 화면 순서대로 테이블 연결:
    조회는 단순하지만 Namespace가 Node마다 중복된다.
  - 모든 종류를 `resources` 테이블에 저장:
    종류 추가는 쉬우나 타입별 제약이 복잡하다.
  - 종류별 독립 테이블.
- **결정**
  - Cluster, Node, Namespace, Pod를 별도 테이블로 둔다.
  - Node와 Namespace 사이에는 직접 FK를 두지 않는다.
    Pod 관계로 화면 경로를 조회한다.
  - Pod에 `(cluster_id, node_id)`와
    `(cluster_id, namespace_id)` 복합 FK를 둔다.
  - 초기 Pod의 Node는 필수다.
- **이유:** 타입별 제약과 Cluster 소속을 DB에서 확인할 수 있다.
- **비용**
  - Pod에 Cluster ID 중복
  - 새 종류 추가 시 테이블, 조회 로직 추가
- **화면 영향**
  - Node 아래 Namespace는 Pod로 찾고 중복을 제거한다.
  - 전역 검색에서는 최소 ID Node를 대표 경로로 사용한다.
  - 트리에서 고른 Namespace는 클릭한 Node 경로를 유지한다.

---

## ADR-002: 지연 조회와 30초 갱신

- **상태:** Accepted
- **문제:** Pod 100,000건을 한꺼번에 보내고 그리면
  첫 화면과 메모리 비용이 커진다.
  갱신해도 사용자의 탐색 위치가 유지되어야 한다.
- **검토한 방식**
  - 전체 목록, 트리 일괄 조회
  - 브라우저에서 전체 검색, 필터
  - 수동 갱신만 제공
  - WebSocket 또는 SSE
- **결정**
  - 첫 화면에는 Cluster만 조회한다.
  - 펼칠 때 직접 하위 한 단계만 읽고 받은 자식을 재사용한다.
  - 화면 근처의 행만 렌더링한다.
  - 전체 검색은 DB에서 수행하고 20건씩 반환한다.
  - 표시 중인 조회를 30초마다, 또는 수동 갱신 시 다시 호출한다.
  - 사용자가 스크롤하는 동안에는 폴링을 미루고, 스크롤이 멈추고 1초 뒤에 갱신한다. 탭이 보이지 않으면 폴링을 건너뛴다.
- **이유:** 실제 수집, 변경 이벤트가 없는 Mock 데이터 환경에서
  조회량을 줄이면서 탐색 위치를 유지할 수 있다.
- **비용**
  - 캐시와 선택 경로를 함께 관리
- **API, 화면 영향**
  - 별도 `POST /refresh`는 없다.
  - 조회 실패 시 이전 성공 데이터를 유지하고, 그 영역에 이전 데이터라는 안내와 재시도를 보여 준다.
  - 캐시는 TanStack Query `staleTime` 30초다([ADR-005](#adr-005-프론트-서버-상태는-tanstack-query)).
    접은 분기를 30초 뒤 다시 펼치면 캐시를 먼저 보여 주고 뒤에서 다시 조회한다.
  - 가상 스크롤은 38px 고정 행과 앞뒤 여유 6행으로 계산한다. 영역 높이는 창 높이를 따라가고 실제 높이를 재서 쓴다.
- **측정 근거:** 분기 220개를 펼친 채 스크롤 중 폴링이 겹치면 16fps까지 떨어졌고, 폴링을 미룬 뒤 60fps를 유지했다 ([브라우저 성능 측정](../report/02-browser-performance.md)).

---

## ADR-003: 3자 이상 검색용 GIN 인덱스

- **상태:** Accepted
- **문제:** 기본 B-tree는 `%api%` 부분 검색을 좁히지 못했다.
  Pod 100,000건에서 순차 스캔이 발생했다.
- **검토한 방식**
  - 순차 스캔 유지
  - `pg_trgm` GIN 인덱스 적용
- **결정:** Namespace, Pod의 `lower(name)`에 GIN을 적용한다.
- **이유:** 같은 데이터에서 3자 검색의 SQL, k6 지연이 줄었다.
  수치는 [API/DB 성능 측정](../report/03-server-performance.md)에 있다.
- **비용**
  - 저장 공간, 쓰기 비용 증가
  - 1~2자 검색은 개선되지 않음
- **구현:** [Flyway V2](../../backend/src/main/resources/db/migration/V2__add_trigram_search_indexes.sql)

---

## ADR-004: 백엔드 조회는 JPA, QueryDSL, 전체 검색만 네이티브 쿼리

- **상태:** Accepted (2026-11-15, JDBC 구현에서 전환)
- **문제**
  - JdbcTemplate과 SQL 문자열로 조회해 계층, 오류 처리 방식이 Controller마다 달랐다.
  - 필터 조건(`issueLevel`)이 붙을 때만 조건을 바꾸는 동적 쿼리가 문자열로 흩어져 있었다.
- **검토한 방식**
  - JdbcTemplate 유지
  - JPA + Spring Data 메서드 이름 쿼리
  - JPA + QueryDSL
- **결정**
  - 엔티티 4개(Cluster, Node, Namespace, Pod)는 조회 전용(`@Immutable`)으로 두고 서로 ID로 참조한다.
    스키마는 Flyway가 관리하고 JPA는 `ddl-auto=validate`로 매핑만 검증한다.
  - 트리, 상세는 QueryDSL로 필요한 컬럼만 프로젝션하고, 필터는 `EXISTS` 서브쿼리 조합으로 만든다.
  - 전체 검색은 JPQL/QueryDSL이 `UNION`을 지원하지 않아
    기존 4종 `UNION ALL` SQL을 JPA 네이티브 쿼리로 실행한다.
  - 패키지는 `presentation / application / domain / infrastructure / support` 4계층으로 두고,
    오류는 `ErrorCode` + `BusinessException` + `GlobalExceptionHandler`로 모은다.
- **이유**
  - 동적 조건을 타입 안전한 코드로 조합할 수 있고, 계층마다 책임이 한 곳에 모인다.
  - 검색은 정렬, 페이징을 DB에서 한 번에 해야 하므로 UNION을 버리지 않았다.
- **비용**
  - QueryDSL Q클래스 생성(빌드 시 annotation processing) 설정이 필요하다.
  - 검색 SQL은 문자열로 남는다.
- **검증:** API 응답 비교와 k6 측정 결과는 [테스트 결과](../report/01-test-results.md)와 [API 성능 결과](../report/03-server-performance.md)에 있다.

---

## ADR-005: 프론트 서버 상태는 TanStack Query

- **상태:** Accepted (2026-11-15)
- **문제**
  - 컴포넌트마다 `useState` + `useEffect` + `AbortController`로 요청, 취소, 재시도, 폴링을 직접 구현했다.
  - 그 결과 늦게 온 이전 응답이 새 결과를 덮거나(R-06), 실패 시 버튼이 잠기는(R-05) 결함이 생겼다.
- **검토한 방식**
  - 지금 코드를 커스텀 훅으로만 옮기기
  - TanStack Query 도입
- **결정**
  - 트리, 검색, 상세 조회를 TanStack Query로 관리한다.
  - 캐시 키에 결과를 바꾸는 값(부모, 필터, 검색어, 선택 리소스)을 모두 넣는다.
  - `staleTime` 30초, 자동 재시도 끔, 창 포커스 재조회 끔.
  - 30초 폴링과 수동 새로고침은 `refetchQueries({ type: 'active' })`로
    화면에서 쓰는 조회만 다시 부른다.
  - 검색은 `useInfiniteQuery`로 20건씩 페이지를 쌓는다.
- **이유**
  - 키가 다르면 다른 캐시라서 늦은 응답이 현재 화면을 덮지 않는다.
  - 실패해도 마지막 성공 데이터가 남고, 요청 취소, 중복 제거를 라이브러리가 처리한다.
- **비용**
  - 번들 크기 증가
  - 키 설계를 잘못하면 캐시가 섞일 수 있어 `queryKeys.ts` 한 곳에서만 만든다.
    키와 요청 함수는 `queryOptions`로 묶어(`resourceQueries.ts`) 조회 정의가 여러 곳에 생기지 않게 한다.

---

## ADR-006: 프론트 폴더 구조는 기능 단위 + FSD 일부 층

- **상태:** Accepted (2026-11-15)
- **문제:** 화면 배치, 조회, 상태, 그리기가 `App.tsx`와 큰 컴포넌트에 섞여 있었다.
- **검토한 방식**
  - 종류별 폴더(`components/`, `hooks/`, `api/`)를 앱 전체에 하나씩
  - FSD(Feature-Sliced Design) 6층(`app / pages / widgets / features / entities / shared`) 전체
  - FSD의 의존 방향과 기능 단위만 적용
- **결정**
  - `app → pages → features → shared` 4층만 쓰고, 위층만 아래층을 import한다.
  - 기능 폴더(`features/resource-explorer`) 안은 `api / hooks / components / utils`로 나눈다.
    (FSD의 `api / model / ui / lib`에 해당)
  - 컴포넌트는 그리기와 이벤트 전달만, 훅은 조회와 상태, `api`는 HTTP만 맡는다.
- **이유:** 기능이 하나뿐인 화면이라 `widgets`, `entities` 층은 빈 폴더만 늘린다.
  기능이 늘어 공통 데이터 모델이 생기면 그때 `entities`로 내린다.

---

## ADR-007: 화면 배치, 심각도 필터와 범례, 색 토큰

- **상태:** Accepted (2026-11-15, 같은 날 배치와 필터를 고침)
- **결정**
  - 평소에는 검색과 트리가 창 너비를 쓰고, 리소스를 선택하면 오른쪽에 상세 패널이 열린다. ✕와 Esc로 닫는다.
  - 1100px보다 넓은 화면에서는 상세 패널이 본문 오른쪽 칸으로 들어와 본문과 폭을 나눈다. 그보다 좁으면 본문 위에 덮이고, 850px 이하에서는 화면 전체를 덮는다.
  - 트리 행은 열 고정 그리드다. 이름 칸 최대 폭을 정해 심각도와 상태가 이름 가까이, 모든 깊이에서 같은 세로선에 온다.
  - 심각도 필터는 셀렉트 박스 대신 트리 위의 버튼 줄로 둔다. 버튼마다 코드의 뜻(이상 없음, 주의, 장애, 판단 불가)을 붙이고, MATCH, PATH와 고유 상태의 뜻을 범례로 함께 보여 준다.
  - 색은 CSS 변수(토큰)로만 쓰고, 심각도는 의미 기반 토큰(`--none`, `--warning`, `--error`, `--unknown`)에 매핑한다. 배지 글자는 WCAG AA 대비(4.5:1) 이상이다.
- **이유**
  - 선택 전 빈 상자를 없애고 탐색 영역을 넓힌다. 요구사항의 "오른쪽 상세 패널"은 그대로 만족한다.
  - 처음 구현은 본문 폭이 1400px로 고정이고 패널이 본문 위에 떠 있어, 창 크기를 바꿔도 배치가 따라오지 않았다.
  - 셀렉트 박스만으로는 NONE, WARNING 같은 코드의 뜻을 화면에서 알 수 없었다.

---

## ADR-008: 업무 규칙은 엔티티, enum, 값 객체 메서드에 둔다

- **상태:** Accepted (2026-11-15)
- **결정**
  - 서비스의 `if`로 판단하던 규칙을 그 규칙을 아는 객체의 메서드로 옮긴다.
    - 다른 Cluster 조합 거절 `Node.requireSameCluster`, Namespace 외 `nodeId` 거절 `ResourceType.requireNodeContextAllowed`
    - 검색 페이지 계산 `SearchPageRequest`, `ResourceSearchPage.of`, 종류별 상세 조립 `엔티티.toDetail`
  - 저장소는 엔티티를 `Optional`로 돌려주고 판단하지 않는다. 서비스는 읽고 메서드를 차례로 부른다.
  - 상세 저장소(`ResourceDetailRepository`)와 존재 확인 메서드는 `ResourceRepository`(ID 조회, Node 경로 후보)로 합쳤다.
- **이유:** 서비스 코드가 규칙의 순서만 보여 읽기 쉽고, 규칙을 한곳에서 바꿀 수 있다.
- **검증:** API 응답과 성능 비교는 [테스트 결과](../report/01-test-results.md)와 [API 성능 결과](../report/03-server-performance.md)에 있다.

---

## 운영 기준으로 정한 것

- **오래된 데이터의 시간 임계치는 두지 않는다.**
  Mock 데이터에는 수집 주기가 없어 어떤 숫자도 근거가 없다.
  대신 상세 패널에 "마지막 갱신"(리소스 변경 시각)과 "조회 시각"(응답 시각)을 나란히 보여 줘
  사용자가 직접 판단하게 한다. `UNKNOWN` 심각도와 데이터 신선도는 별개로 다룬다.
- **넓은 Namespace 검색용 추가 인덱스(`pods(namespace_id, node_id)`)는 두지 않는다.**
  가장 넓은 `ns-` 검색이 API p95 약 113ms로 목표(300ms) 안이다.
  데이터가 늘어 API가 200ms를 넘으면 다시 측정하고 검토한다.
  근거: [API/DB 성능 측정](../report/03-server-performance.md).

---

## 이번 범위에서 제외

- 실제 Kubernetes 수집, 상태 판정 엔진, 하위 리소스 상태별 집계
- WebSocket/SSE 실시간 전달, RBAC, 알림
