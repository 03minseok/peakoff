# 백엔드 이미지. 프론트는 Vercel이 맡으므로 여기는 API 서버 하나뿐이다.
#
# ■ 두 단계로 나눈 이유
# 빌드에는 JDK와 gradle 캐시가 필요하지만, 돌릴 때는 JRE와 jar 하나면 된다.
# 한 단계로 두면 이미지에 소스와 gradle 캐시가 통째로 들어가 수백 MB가 된다.
# EC2가 매번 그걸 받아야 하니 배포가 그만큼 느려진다.

# ── 1단계: 빌드 ──────────────────────────────────────────────────────
FROM eclipse-temurin:21-jdk AS build
WORKDIR /src

# 래퍼와 의존성 선언을 먼저 복사한다.
#
# 도커는 파일이 바뀐 단계부터 다시 만든다. 소스와 함께 복사하면 코드를 한 줄만 고쳐도
# 의존성을 처음부터 다시 받는다. 이 둘만 먼저 넣으면 build.gradle이 그대로인 한
# 아래 다운로드 단계가 캐시에 남는다.
COPY gradle gradle
COPY gradlew build.gradle settings.gradle ./

# 의존성만 미리 받아 둔다. 실패해도 넘어가는 이유는, 이 단계는 어디까지나
# 캐시를 데우는 것이라 여기서 멈출 이유가 없기 때문이다.
RUN ./gradlew dependencies --no-daemon > /dev/null 2>&1 || true

COPY src src

# ⚠️ 테스트는 여기서 돌리지 않는다. CI(.github/workflows/ci.yml)가 이미 돌렸고,
# 이미지를 만들 때마다 또 돌리면 배포가 그만큼 늦어진다.
# 같은 것을 두 번 확인하는 대신, 확인된 커밋만 이미지가 된다.
RUN ./gradlew bootJar --no-daemon -x test

# ── 2단계: 실행 ──────────────────────────────────────────────────────
FROM eclipse-temurin:21-jre
WORKDIR /app

# root로 돌리지 않는다. 컨테이너가 뚫렸을 때 할 수 있는 일을 줄인다.
RUN useradd --system --create-home --shell /usr/sbin/nologin peakoff
USER peakoff

COPY --from=build --chown=peakoff:peakoff /src/build/libs/*.jar app.jar

EXPOSE 8080

# 컨테이너 안의 시계도 한국으로 맞춘다.
#
# LocalDate.now()가 "오늘"을 뽑는 자리가 있는데, UTC로 돌면 자정부터 오전 9시까지
# 어제 날짜가 나온다. 코드에서 Asia/Seoul을 못박아 두었지만(TimeConfig),
# 로그 시각까지 한국으로 읽히는 편이 사고를 쫓을 때 편하다.
ENV TZ=Asia/Seoul

# 컨테이너에 메모리 한도가 걸려 있으면 JVM이 그 한도를 기준으로 힙을 잡게 한다.
# 이걸 안 주면 t3.micro(1GB)에서 호스트 전체 메모리를 보고 힙을 크게 잡았다가
# OOM으로 죽는다.
ENV JAVA_OPTS="-XX:MaxRAMPercentage=70"

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
