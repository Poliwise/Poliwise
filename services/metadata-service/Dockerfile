# Build stage
FROM eclipse-temurin:17-jdk-alpine AS builder

WORKDIR /app

COPY pom.xml ./
COPY src ./src

RUN apk add --no-cache maven && \
    touch .env && \
    export MAVEN_OPTS="--add-opens java.base/java.lang=ALL-UNNAMED --add-opens java.base/java.util=ALL-UNNAMED" && \
    mvn dependency:go-offline -B && \
    mvn package -DskipTests -B && \
    mv target/*.jar app.jar

# Production stage
FROM eclipse-temurin:17-jre-alpine

RUN apk add --no-cache curl

WORKDIR /app

COPY --from=builder /app/app.jar app.jar

ENV JAVA_OPTS="-Xms256m -Xmx512m"
ENV SPRING_PROFILES_ACTIVE=prod

EXPOSE 8084

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8084/actuator/health || exit 1

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
