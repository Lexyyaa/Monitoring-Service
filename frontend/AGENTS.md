# Frontend 작업 규칙

루트 [AGENTS.md](../AGENTS.md)와 함께 적용한다.
화면은 [요구사항](../docs/design/01-requirements.md),
HTTP는 [OpenAPI](../docs/design/openapi.yaml)를 따른다.
현재 구조와 결정은 [아키텍처](../docs/design/05-architecture.md),
[ADR-005·006](../docs/design/02-adr.md)에 있다.

## 코드 위치와 책임

- `src/app`: QueryClient 설정과 화면 진입
- `src/pages`: 화면 배치, 필터·선택 상태
- `src/features/resource-explorer/api`: HTTP 요청, 캐시 키, 조회 정의(`resourceQueries`)
- 같은 feature의 `hooks`: 조회·화면 상태·갱신
- 같은 feature의 `components`: 그리기와 이벤트 전달
- 같은 feature의 `utils`: 트리 행 계산, 필터 일치 판단 같은 화면 규칙
- `src/shared`: 여러 기능에서 쓰는 범용 도구

의존 방향은 `app → pages → features → shared`다.
위층만 아래층을 import한다.
기능 전용 코드를 `shared`에 두지 않는다.
필요 없는 층이나 추상화를 추가하지 않는다.

## 상태와 요청

- 서버 응답은 TanStack Query, 펼침·선택·검색 입력·필터는 화면 상태로 다룬다.
  갱신으로 사용자의 선택을 초기화하지 않는다.
  선택 상태는 페이지 한 곳에만 둔다. 컴포넌트 안에 판단 규칙을 쓰지 않고 `utils` 함수로 뺀다.
- 캐시 키는 `queryKeys.ts`에서 만들고, 조회 정의는 `resourceQueries.ts`의 `queryOptions`로 한 번만 둔다.
  훅에서 키·요청 함수를 다시 쓰지 않는다.
  결과를 바꾸는 부모 종류·ID, 필터, 검색어, 선택 리소스와 Node 경로를 구분한다.
- 현재 QueryClient는 `staleTime` 30초, 자동 재시도와 창 포커스 재조회는 끈다.
- 펼친 부모의 하위 쿼리만 활성화한다.
  다시 펼칠 때 캐시를 먼저 보여 준다.
- API 함수에는 Query의 취소 신호를 전달한다.
  오래된 검색·상세 응답이 새 선택을 덮지 않게 한다.
- Namespace 화면 행과 상세 요청에는 클릭한 Node 경로를 유지한다.
- 표시할 트리 행은 조회 데이터에서 계산한다.

## 탐색·검색·필터

- 첫 화면에는 Cluster만 요청하고, 펼친 부모의 직접 자식만 가져온다.
  펼침과 이름 선택은 다른 동작이다.
- 검색은 네 리소스 전체를 대상으로 한다.
  입력이 300ms 멈춘 뒤 요청하고 `useInfiniteQuery`로 20건씩 더 본다.
- 검색 결과를 고르면 필요한 경로를 열고 상세를 표시한다.
- `ALL`은 필터를 보내지 않는다.
  나머지 값은 `NONE`, `WARNING`, `ERROR`, `UNKNOWN`이다.
- 이름과 심각도는 AND로 적용한다.
  `MATCH`는 자체 일치, `PATH`는 하위 경로다.
  `PATH` 부모의 자체 상태를 바꾸지 않는다.

## 갱신·표시·검증

- 30초 폴링과 수동 갱신은 활성 GET 쿼리만 다시 호출한다.
  갱신은 `refetchQueries({ type: 'active' })`를 사용한다.
- 이전 성공 데이터를 먼저 비우지 않는다.
  실패한 영역에는 오류·재시도를 제공한다.
- `lastUpdatedAt`은 리소스 변경 시각, `fetchedAt`은 조회 시각이다.
  `UNKNOWN`을 데이터 신선도 표시로 사용하지 않는다.
- Pod 100,000건을 한꺼번에 받거나 DOM에 그리지 않는다.
  현재 트리는 38px 행과 앞뒤 여유 6행을 쓴다.
- 행 key는 배열 순서 대신 리소스 종류·ID·필요한 부모 경로로 만든다.
- 로딩, 빈 결과, 실패와 재시도를 영역별로 확인한다.
- 변경 후 `npm run build`와 관련 API 동작을 확인한다.
  사용자 흐름은 브라우저에서 별도로 확인한다.
