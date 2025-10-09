# syntax=docker/dockerfile:1

# --- Build stage ---
FROM maven:3.9.9-eclipse-temurin-17 AS build
WORKDIR /app

# Only copy pom first to leverage Docker layer caching
COPY pom.xml ./
RUN mvn -q -e -DskipTests dependency:go-offline

# Now copy the rest of the source and build
COPY src ./src
RUN mvn -q -DskipTests clean package

# --- Runtime stage ---
FROM eclipse-temurin:17-jre
WORKDIR /app

# JVM tuning sensible defaults
ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0"

# App port
ENV SERVER_PORT=8081
EXPOSE 8081

# Copy built jar
COPY --from=build /app/target/wealtharena-0.0.1-SNAPSHOT.jar /app/app.jar

# Healthcheck (simple TCP connect)
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=5 \
  CMD wget -qO- http://localhost:${SERVER_PORT}/api/health || exit 1

# Default envs with safe local defaults (can be overridden by compose)
ENV SPRING_DATASOURCE_URL=jdbc:postgresql://db:5432/wealtharena \
    SPRING_DATASOURCE_USERNAME=admin \
    SPRING_DATASOURCE_PASSWORD=password123 \
    APP_DATA_LOADER_ENABLED=true \
    SCHEDULED_DATA_ENABLED=true

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar /app/app.jar"]


