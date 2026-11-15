# Frontend 작업 규칙

루트 [AGENTS.md](../AGENTS.md)와 함께 적용한다. 화면은 [요구사항](../docs/design/01-requirements.md), HTTP는 [OpenAPI](../docs/design/openapi.yaml)를 따른다.

---

## 폴더와 책임

의존 방향은 `app → pages → features → shared`다. 위층만 아래층을 import한다 ([ADR-006](../docs/design/02-adr.md)).

- `src/app`: QueryClient 설정, 화면 진입
- `src/pages`: 화면 배치, 필터와 선택 상태
- `features/resource-explorer/api`: HTTP 요청, 캐시 키, 조회 정의
- `features/resource-explorer/hooks`: 조회, 화면 상태, 갱신
- `features/resource-explorer/components`: 그리기와 이벤트 전달
- `features/resource-explorer/utils`: 트리 행 계산, 필터 일치 판단
- `src/shared`: 여러 기능이 쓰는 범용 도구

---

## 상태와 요청

- 서버 응답은 TanStack Query, 펼침과 선택과 검색어와 필터는 화면 상태로 다룬다 ([ADR-005](../docs/design/02-adr.md)).
- 선택 상태는 페이지 한 곳에만 둔다. 갱신으로 선택을 초기화하지 않는다.
- 캐시 키는 `queryKeys.ts`, 조회 정의는 `resourceQueries.ts`에서만 만든다.
- 캐시 키에는 결과를 바꾸는 값(부모, Node 경로, 필터, 검색어, 선택)을 모두 넣는다.
- 펼친 부모의 하위 조회만 켠다. 다시 펼치면 캐시를 먼저 보여 준다.
- Namespace 행과 상세 요청에는 클릭한 Node 경로를 함께 보낸다.

---

## 화면 규칙

- 첫 화면은 Cluster만 요청한다. 펼침과 이름 선택은 다른 동작이다.
- 검색은 입력이 300ms 멈춘 뒤 요청하고 20건씩 더 받는다. 결과를 고르면 필요한 경로만 연다.
- 필터 `전체`는 `issueLevel`을 보내지 않는다. 이름과 심각도는 AND로 적용한다.
- 30초 폴링과 수동 갱신은 화면에서 쓰는 조회만 다시 부른다. 스크롤 중에는 폴링을 미룬다.
- 실패해도 이전 데이터를 비우지 않는다. 실패한 영역에 오류와 재시도를 보여 준다.
- `UNKNOWN`을 "데이터가 오래됨"의 뜻으로 쓰지 않는다.
- Pod를 한꺼번에 받거나 그리지 않는다. 트리는 38px 고정 행의 가상 스크롤이다.
- 행 key는 배열 순서가 아니라 리소스 종류, ID, 필요한 부모 경로로 만든다.

---

## 검증

- 변경 후 `npm run format:check`, `npm run build`, `npm test`를 실행한다.
- 사용자 흐름은 브라우저에서 확인하고, 필요하면 E2E를 격리 환경에서 실행한다.
