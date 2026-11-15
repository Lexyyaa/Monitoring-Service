# Infrastructure Monitoring Service

Kubernetes 리소스(Cluster → Node → Namespace → Pod)를 탐색하는 모니터링 서비스다. Java 21, Spring Boot 3.5, PostgreSQL, React, TypeScript로 만든다.

---

## 기본 원칙

- 확정된 요구사항과 설계를 따른다.
- ERD와 API 계약은 사용자 확인 없이 바꾸지 않는다. 바꾸면 [ADR](docs/design/02-adr.md)에 근거를 남긴다.
- 요청 범위만 수정한다. 다음 작업을 임의로 시작하지 않는다.
- 실행하지 않은 테스트, 측정하지 않은 수치는 완료로 쓰지 않는다.
- 문서와 코드가 다르면 차이를 먼저 보고한다.
- 성능 개선은 같은 조건의 전후 측정을 근거로 한다.

---

## 문서

- 작업 상태: [작업 계획](docs/design/07-work-plan.md) (체크박스가 기준)
- 설계
  - [요구사항](docs/design/01-requirements.md), [설계 결정](docs/design/02-adr.md), [데이터 모델](docs/design/03-data-model.md)
  - [API 명세](docs/design/04-api-spec.md), [OpenAPI](docs/design/openapi.yaml), [아키텍처](docs/design/05-architecture.md)
  - [테스트 시나리오](docs/design/06-test-scenarios.md)
- 구현 규칙: [Backend](backend/AGENTS.md), [Frontend](frontend/AGENTS.md)
- 결과: [docs/report](docs/report/), 작업 기록: [docs/ai-log](docs/ai-log/)
- 같은 사실은 한 문서에만 쓰고 나머지는 링크한다.
- 문장은 짧게 쓴다. 한 불릿에 한 가지만 쓴다. 나열은 가운뎃점보다 쉼표나 슬래시를 쓴다.

---

## 작업 흐름

1. 작업 계획에서 범위와 완료 조건을 확인한다.
2. 설계와 현재 코드를 비교한다.
3. 수정하고 관련 테스트를 직접 실행한다.
4. 완료 조건을 채우면 체크박스를 `[x]`로 바꾼다.

---

## 커밋과 PR

- 커밋 메시지는 작업 계획의 한국어 문구를 그대로 쓴다. 서명 줄은 붙이지 않는다.
- 사용자 요청 없이 커밋, 푸시하지 않는다.
- 브랜치마다 PR 하나를 올리고, 머지는 사용자가 한다.
- PR은 템플릿 구성(작업 개요 / 작업 상세 / 관련 문서 / 테스트 범위)을 따른다.
- 로컬 IDE 설정은 커밋하지 않는다.

---

## 작업 기록

- 의미 있는 작업 뒤 [docs/ai-log](docs/ai-log/)에 한 일, 확인, 결정, 남은 일을 불릿으로 짧게 쓴다.
- 명령 출력, 버전 나열, 파일 목록, 민감한 정보는 쓰지 않는다.
