########################################################################
# 백엔드 컨테이너 이미지 (2단계 빌드)
# 1단계: Gradle Wrapper로 실행 가능한 JAR 생성 (테스트는 DB가 필요해 CI에서 따로 실행)
# 2단계: JRE만 있는 작은 이미지에서 비루트 사용자로 실행. DB 연결은 DB_URL·DB_USER·DB_PASSWORD 환경 변수로 받는다
########################################################################

FROM eclipse-temurin:21-jdk AS build
WORKDIR /workspace
COPY gradlew settings.gradle build.gradle ./
COPY gradle ./gradle
# 소스보다 먼저 의존성을 받아 두어 소스만 바뀌면 이 층을 재사용한다
RUN ./gradlew --no-daemon dependencies > /dev/null
COPY src ./src
RUN ./gradlew --no-daemon bootJar -x test

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /workspace/build/libs/*.jar /app/app.jar
USER app
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
