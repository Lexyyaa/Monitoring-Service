# P04 chore/container-runtime 컨테이너와 CI

- 한 일
  - 백엔드·프론트엔드 이미지, nginx 프록시, 세 서비스 Compose, 헬스체크를 구성했다.
  - GitHub Actions에 백엔드 테스트, 프론트 검증, 이미지 빌드 작업을 추가했다.
- 확인
  - 새 볼륨에서 세 서비스가 healthy, Flyway V1·V2 적용, 시드 검증 통과
  - nginx 경유로 화면과 API가 같은 출처에서 동작했다.
- 결정
  - CI의 PostgreSQL은 테스트 DB 이름(`monitoring_test`)으로 띄운다.
  - 백엔드 이미지는 의존성 다운로드 실패를 숨기지 않는다.
  - nginx는 `index.html`을 캐시하지 않고 `/assets/`만 오래 캐시한다.
