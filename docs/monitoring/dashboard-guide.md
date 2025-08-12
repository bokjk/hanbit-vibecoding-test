# CloudWatch Dashboard 운영 가이드

> **참조**: [모니터링 설계](../design/09-deployment.md#모니터링-및-로깅) - 종합적인 모니터링 전략

## 📊 대시보드 개요

TODO 앱의 CloudWatch Dashboard는 시스템 전체 상태를 실시간으로 모니터링하고 운영 의사결정을 지원하기 위해 설계되었습니다.

### 구성된 대시보드 목록

| 대시보드 이름             | 용도                   | 대상 사용자      |
| ------------------------- | ---------------------- | ---------------- |
| `TodoApp-PROD-Operations` | 프로덕션 운영 모니터링 | 운영팀, DevOps   |
| `TodoApp-DEV-Operations`  | 개발환경 모니터링      | 개발팀, QA팀     |
| `TodoApp-PROD-Detailed`   | 상세 성능 분석         | 개발팀, 아키텍트 |
| `TodoApp-DEV-Detailed`    | 개발환경 상세 분석     | 개발팀           |

## 🚀 대시보드 설정

### 자동 설정 (권장)

```bash
# 프로덕션 환경 대시보드 생성
cd apps/server
pnpm setup:dashboard:prod

# 개발 환경 대시보드 생성
pnpm setup:dashboard:dev

# 기존 대시보드 업데이트
pnpm update:dashboard -- --env prod

# 상세 옵션으로 설정
pnpm setup:dashboard -- --env prod --verbose --no-alarms
```

### 수동 설정

```typescript
import { DashboardGenerator } from "../../infrastructure/monitoring/dashboard-config";

// 프로덕션 대시보드 생성
const generator = new DashboardGenerator("prod");
await generator.createDashboard();

// 커스텀 설정으로 생성
const customGenerator = new DashboardGenerator("prod", {
  thresholds: {
    responseTime: 2000,
    errorRate: 0.5,
    throttleThreshold: 3,
  },
});
```

## 📈 위젯 해석 가이드

### 1. Lambda 성능 메트릭

#### 응답 시간 (Duration)

- **정상**: < 1초 (대부분 작업)
- **주의**: 1-3초 (DB 조회 작업)
- **경고**: > 3초 (최적화 필요)
- **조치**: 코드 최적화, 메모리 증설, 콜드 스타트 최소화

#### 에러 발생률

- **정상**: < 0.1%
- **주의**: 0.1-1%
- **경고**: > 1%
- **조치**: 로그 분석, 코드 수정, 롤백 고려

#### 동시 실행 수 (Concurrent Executions)

- **정상**: < 100개
- **주의**: 100-500개 (트래픽 증가)
- **경고**: > 500개 (리소스 부족 위험)
- **조치**: 함수별 동시 실행 제한 설정

### 2. API Gateway 메트릭

#### 지연 시간 (Latency)

- **Latency**: 전체 요청 처리 시간
- **IntegrationLatency**: 백엔드 처리 시간
- **차이가 클 경우**: API Gateway 오버헤드 증가

#### 에러율 (4XX/5XX)

- **4XX 에러**: 클라이언트 요청 문제
  - 인증 실패, 잘못된 요청 형식
- **5XX 에러**: 서버 내부 문제
  - Lambda 함수 오류, 타임아웃

### 3. DynamoDB 메트릭

#### 용량 사용량

- **읽기 용량**: 예상 사용량과 비교
- **쓰기 용량**: 버스트 패턴 확인
- **스로틀링**: 용량 부족 시 발생

#### 지연 시간

- **정상**: < 10ms (단일 항목)
- **주의**: 10-50ms (복합 쿼리)
- **경고**: > 50ms (인덱스 최적화 필요)

### 4. X-Ray 추적

#### 서비스 맵

- 요청 흐름과 의존성 시각화
- 병목 지점과 에러 발생 위치 식별

#### 응답 시간 분석

- 구간별 처리 시간 분석
- 외부 서비스 호출 성능 모니터링

## 🚨 알람 및 임계값

### 프로덕션 환경 임계값

| 메트릭            | 경고 | 심각 | 조치        |
| ----------------- | ---- | ---- | ----------- |
| Lambda 응답시간   | 3초  | 5초  | 성능 최적화 |
| 에러율            | 1%   | 5%   | 즉시 조사   |
| API 지연시간      | 2초  | 4초  | 인프라 점검 |
| DynamoDB 스로틀링 | 5회  | 20회 | 용량 증설   |
| 메모리 사용률     | 80%  | 90%  | 함수 최적화 |

### 개발 환경 임계값

개발 환경은 프로덕션 대비 2배 관대한 임계값을 적용합니다.

### 자동 알람 설정

```bash
# 알람 포함하여 대시보드 설정
pnpm setup:dashboard -- --env prod

# 알람 없이 대시보드만 설정
pnpm setup:dashboard -- --env prod --no-alarms
```

## 🔍 트러블슈팅 워크플로우

### 1. 성능 이슈 분석

#### 응답 시간 증가 시

1. **X-Ray 추적 확인**: 병목 구간 식별
2. **로그 분석**: 에러 로그 및 느린 쿼리 확인
3. **리소스 사용률**: 메모리, CPU 사용량 점검
4. **외부 의존성**: DynamoDB, 외부 API 응답 시간

#### 에러율 증가 시

1. **에러 로그 위젯**: 최근 에러 패턴 분석
2. **함수별 분석**: 특정 함수의 에러 집중도 확인
3. **사용자 요청**: 4XX vs 5XX 에러 비율
4. **배포 타이밍**: 최근 배포와의 연관성 확인

### 2. 용량 및 확장성 이슈

#### DynamoDB 스로틀링

1. **읽기/쓰기 용량 확인**: 현재 사용량 vs 프로비저닝 용량
2. **핫 파티션 분석**: 특정 파티션키의 과도한 사용
3. **쿼리 패턴**: 비효율적인 스캔 작업 확인
4. **온디맨드 전환 고려**: 예측 불가능한 트래픽 패턴

#### Lambda 동시 실행 제한

1. **함수별 동시 실행 수 모니터링**
2. **예약 동시 실행 설정**: 중요 함수 우선 처리
3. **비동기 처리**: SQS 큐 활용 고려
4. **함수 최적화**: 실행 시간 단축

### 3. 비용 최적화

#### 리소스 사용률 분석

1. **Lambda 메모리 사용률**: 과다/과소 할당 확인
2. **DynamoDB 용량**: 실제 사용 대비 프로비저닝 용량
3. **로그 보관 정책**: 불필요한 로그 데이터 정리
4. **콜드 스타트**: 실행 빈도가 낮은 함수 식별

## 📊 대시보드 커스터마이징

### 위젯 추가

```typescript
import { DashboardUtils } from "../../infrastructure/monitoring/dashboard-config";

// 커스텀 메트릭 위젯 생성
const customWidget = DashboardUtils.createCustomMetricWidget(
  "사용자 활동 메트릭",
  [
    ["TodoApp/BusinessMetrics", "UserActions", "Operation", "Create"],
    [".", ".", ".", "Update"],
    [".", ".", ".", "Delete"],
  ],
  { x: 0, y: 0, width: 12, height: 6 },
);
```

### 환경별 설정 조정

```typescript
// 개발환경 전용 설정
const devConfig = {
  environment: "dev" as const,
  thresholds: {
    responseTime: 10000, // 개발환경은 더 관대한 임계값
    errorRate: 10,
    throttleThreshold: 50,
  },
};
```

## 🎯 모니터링 베스트 프랙티스

### 1. 일일 점검 항목

- [ ] 전체 시스템 에러율 < 1%
- [ ] 평균 응답 시간 < 2초
- [ ] DynamoDB 스로틀링 발생 여부
- [ ] 비정상적인 트래픽 패턴 확인

### 2. 주간 리뷰

- [ ] 성능 트렌드 분석
- [ ] 리소스 사용률 최적화
- [ ] 비용 효율성 검토
- [ ] 알람 정확도 평가

### 3. 월간 최적화

- [ ] 대시보드 위젯 유용성 평가
- [ ] 새로운 메트릭 요구사항 수집
- [ ] 임계값 조정
- [ ] 자동화 스크립트 개선

## 🔗 유용한 링크

### AWS 콘솔 바로가기

- [CloudWatch 대시보드](https://console.aws.amazon.com/cloudwatch/home#dashboards:)
- [Lambda 함수 목록](https://console.aws.amazon.com/lambda/home#/functions)
- [DynamoDB 테이블](https://console.aws.amazon.com/dynamodb/home#tables:)
- [X-Ray 서비스 맵](https://console.aws.amazon.com/xray/home#/service-map)

### 문서 및 가이드

- [AWS CloudWatch 사용자 가이드](https://docs.aws.amazon.com/cloudwatch/)
- [Lambda 모니터링 가이드](https://docs.aws.amazon.com/lambda/latest/dg/monitoring-metrics.html)
- [DynamoDB 모니터링](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/monitoring-cloudwatch.html)

## 📞 문제 발생 시 연락처

### 운영팀 에스컬레이션

1. **P1 (심각)**: 시스템 전체 장애 - 즉시 연락
2. **P2 (높음)**: 성능 저하 - 1시간 내 대응
3. **P3 (보통)**: 부분 기능 이상 - 업무시간 내 대응
4. **P4 (낮음)**: 개선사항 - 계획된 작업

### 개발팀 지원

- **기술 문의**: 개발팀 Slack 채널
- **버그 리포트**: GitHub Issues
- **긴급 지원**: 온콜 개발자 연락처

---

이 가이드를 통해 TODO 앱의 안정적인 운영과 지속적인 성능 개선을 달성하시기 바랍니다.
