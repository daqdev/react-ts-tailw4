# syntax=docker/dockerfile:1
# Builds one Spring Boot module of the reactor:
#   docker build --build-arg MODULE=gateway -t dualbot-gateway .
FROM maven:3.9-eclipse-temurin-21 AS build
ARG MODULE
WORKDIR /src
COPY . .
RUN --mount=type=cache,target=/root/.m2 \
    mvn -B -q -pl "${MODULE}" -am package -DskipTests \
    && cp "${MODULE}"/target/"${MODULE}"-*.jar /app.jar

FROM eclipse-temurin:21-jre
RUN useradd --system --uid 10001 app
COPY --from=build /app.jar /app/app.jar
USER app
ENV TZ=UTC
ENTRYPOINT ["java", "-Duser.timezone=UTC", "-jar", "/app/app.jar"]
