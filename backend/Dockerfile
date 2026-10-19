# VirtualBiz API (Spring Boot). Build from backend/: docker build -t vbiz-api backend
# Runtime settings come from environment variables (backend/.env.example, docs/ops/deploy.md).

FROM eclipse-temurin:17-jdk AS build
WORKDIR /src
COPY gradlew settings.gradle build.gradle ./
COPY gradle gradle
COPY vbiz-common/build.gradle vbiz-common/
COPY vbiz-api/build.gradle vbiz-api/
RUN ./gradlew --no-daemon -q help
COPY vbiz-common vbiz-common
COPY vbiz-api vbiz-api
RUN ./gradlew --no-daemon :vbiz-api:bootJar -x test \
 && cp vbiz-api/build/libs/vbiz-api-*.jar /src/app.jar

FROM eclipse-temurin:17-jre
RUN useradd --system --uid 10001 vbiz && mkdir -p /app/logs /app/data/uploads \
 && chown -R vbiz /app/logs /app/data
WORKDIR /app
COPY --from=build /src/app.jar app.jar
USER vbiz
ENV SERVER_PORT=8180 LOG_DIR=/app/logs VBIZ_STORAGE_DIR=/app/data/uploads JAVA_OPTS="-XX:MaxRAMPercentage=75"
EXPOSE 8180
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]
