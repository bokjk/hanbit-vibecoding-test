# 환경별 인프라 관리 가이드

## 📋 목차

1. [개요](#개요)
2. [환경별 리소스 명명 규칙](#환경별-리소스-명명-규칙)
3. [태깅 전략](#태깅-전략)
4. [DynamoDB 환경별 격리](#dynamodb-환경별-격리)
5. [Lambda 함수 최적화](#lambda-함수-최적화)
6. [API Gateway 스테이지 관리](#api-gateway-스테이지-관리)
7. [보안 및 권한 관리](#보안-및-권한-관리)
8. [배포 절차](#배포-절차)
9. [모니터링 및 알람](#모니터링-및-알람)
10. [비용 최적화](#비용-최적화)

## 개요

이 문서는 AWS 서버리스 아키텍처의 환경별 리소스 격리 및 최적화 전략을 설명합니다.

### 지원 환경

- **Development**: 개발 환경
- **Test**: 테스트 환경
- **Staging**: 스테이징 환경
- **Production**: 프로덕션 환경

## 환경별 리소스 명명 규칙

### 명명 규칙 패턴

```
{project-name}-{environment}-{region}-{resource-type}-{resource-name}
```

### 예시

```
# DynamoDB 테이블
hanbit-todo-dev-apne2-dynamodb-todos
hanbit-todo-prod-apne2-dynamodb-todos

# Lambda 함수
hanbit-todo-dev-apne2-lambda-create-todo
hanbit-todo-prod-apne2-lambda-create-todo

# API Gateway
hanbit-todo-dev-apne2-api-gateway
hanbit-todo-prod-apne2-api-gateway
```

### 리소스 타입 약어

- `dynamodb`: DynamoDB 테이블
- `lambda`: Lambda 함수
- `api`: API Gateway
- `s3`: S3 버킷
- `sns`: SNS 토픽
- `sqs`: SQS 큐
- `cognito`: Cognito 리소스
- `kms`: KMS 키
- `iam`: IAM 역할/정책

## 태깅 전략

### 필수 태그

모든 리소스에 반드시 적용되어야 하는 태그:

| 태그 키       | 설명          | 예시 값                                        |
| ------------- | ------------- | ---------------------------------------------- |
| `Environment` | 배포 환경     | `development`, `test`, `staging`, `production` |
| `Project`     | 프로젝트 이름 | `hanbit-todo`                                  |
| `ManagedBy`   | 관리 도구     | `CDK`                                          |
| `CreatedDate` | 생성 날짜     | `2024-01-20`                                   |

### 비용 할당 태그

비용 추적 및 분석을 위한 태그:

| 태그 키      | 설명      | 예시 값                         |
| ------------ | --------- | ------------------------------- |
| `CostCenter` | 비용 센터 | `DEV-BUDGET`, `PROD-BUDGET`     |
| `Owner`      | 소유 팀   | `DevTeam`, `OpsTeam`            |
| `Team`       | 담당 팀   | `Backend`, `Frontend`, `DevOps` |
| `Budget`     | 예산 코드 | `HANBIT-TODO-DEV`               |

### 보안 태그

보안 및 컴플라이언스를 위한 태그:

| 태그 키              | 설명              | 예시 값                              |
| -------------------- | ----------------- | ------------------------------------ |
| `DataClassification` | 데이터 분류       | `Confidential`, `Internal`, `Public` |
| `Compliance`         | 컴플라이언스 레벨 | `HIGH`, `STANDARD`                   |
| `Encryption`         | 암호화 요구사항   | `Required`, `Optional`               |
| `BackupRequired`     | 백업 필요 여부    | `true`, `false`                      |

### 운영 태그

운영 관리를 위한 태그:

| 태그 키             | 설명          | 예시 값                                     |
| ------------------- | ------------- | ------------------------------------------- |
| `MaintenanceWindow` | 유지보수 시간 | `SUN:0300-0400`                             |
| `AutoShutdown`      | 자동 종료     | `true`, `false`                             |
| `MonitoringLevel`   | 모니터링 수준 | `BASIC`, `STANDARD`, `ENHANCED`, `DETAILED` |
| `AlertSeverity`     | 알람 심각도   | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`         |

## DynamoDB 환경별 격리

### 테이블 명명 및 격리

#### Development

```typescript
{
  tableName: 'hanbit-todo-dev-apne2-dynamodb-todos',
  billingMode: PAY_PER_REQUEST,
  backup: {
    enabled: false,
    pitrEnabled: false,
  },
  encryption: AWS_MANAGED,
  removalPolicy: DESTROY,
  ttl: {
    enabled: true,
    guestDataTtlDays: 1,  // 게스트 데이터 1일 후 삭제
  }
}
```

#### Test

```typescript
{
  tableName: 'hanbit-todo-test-apne2-dynamodb-todos',
  billingMode: PAY_PER_REQUEST,
  backup: {
    enabled: true,
    pitrEnabled: false,
  },
  encryption: AWS_MANAGED,
  removalPolicy: DESTROY,
  ttl: {
    enabled: true,
    guestDataTtlDays: 3,  // 게스트 데이터 3일 후 삭제
  }
}
```

#### Staging

```typescript
{
  tableName: 'hanbit-todo-staging-apne2-dynamodb-todos',
  billingMode: PROVISIONED,
  readCapacity: 5,
  writeCapacity: 5,
  autoScaling: {
    enabled: true,
    minCapacity: 5,
    maxCapacity: 50,
    targetUtilization: 70,
  },
  backup: {
    enabled: true,
    pitrEnabled: true,
    continuousBackups: true,
  },
  encryption: CUSTOMER_MANAGED,
  stream: {
    enabled: true,
    viewType: NEW_AND_OLD_IMAGES,
  },
  removalPolicy: SNAPSHOT,
  ttl: {
    enabled: true,
    guestDataTtlDays: 7,
  }
}
```

#### Production

```typescript
{
  tableName: 'hanbit-todo-prod-apne2-dynamodb-todos',
  billingMode: PROVISIONED,
  readCapacity: 10,
  writeCapacity: 10,
  autoScaling: {
    enabled: true,
    minCapacity: 10,
    maxCapacity: 1000,
    targetUtilization: 70,
  },
  backup: {
    enabled: true,
    pitrEnabled: true,
    continuousBackups: true,
  },
  encryption: CUSTOMER_MANAGED,
  stream: {
    enabled: true,
    viewType: NEW_AND_OLD_IMAGES,
  },
  globalTable: {
    enabled: true,
    regions: ['us-east-1', 'eu-west-1'],
  },
  removalPolicy: RETAIN,
  ttl: {
    enabled: true,
    guestDataTtlDays: 7,
  }
}
```

### 글로벌 보조 인덱스 (GSI)

- `GSI1-StatusPriority`: 상태 및 우선순위별 쿼리
- `GSI2-SearchTitle`: 제목 검색 최적화
- `GSI3-Backup`: (프로덕션 전용) 백업 용도

## Lambda 함수 최적화

### 환경별 설정

#### Development

```typescript
{
  memorySize: 256,
  timeout: 30,
  logLevel: 'DEBUG',
  logRetention: THREE_DAYS,
  tracing: ACTIVE,
  reservedConcurrency: undefined,
  provisionedConcurrency: undefined,
}
```

#### Test

```typescript
{
  memorySize: 512,
  timeout: 60,
  logLevel: 'INFO',
  logRetention: ONE_WEEK,
  tracing: ACTIVE,
  reservedConcurrency: undefined,
  provisionedConcurrency: undefined,
}
```

#### Staging

```typescript
{
  memorySize: 1024,
  timeout: 30,
  logLevel: 'WARN',
  logRetention: TWO_WEEKS,
  tracing: ACTIVE,
  reservedConcurrency: 10,
  provisionedConcurrency: undefined,
  deadLetterQueue: {
    enabled: true,
    maxRetryCount: 3,
  }
}
```

#### Production

```typescript
{
  memorySize: 1536,
  timeout: 30,
  logLevel: 'ERROR',
  logRetention: ONE_MONTH,
  tracing: ACTIVE,
  reservedConcurrency: 100,
  provisionedConcurrency: 10,
  deadLetterQueue: {
    enabled: true,
    maxRetryCount: 5,
  },
  edgeOptimized: true,
}
```

### 콜드 스타트 최적화

- **Development**: 최적화 없음
- **Test**: 기본 최적화
- **Staging**: Reserved Concurrency 설정
- **Production**: Provisioned Concurrency 활성화

## API Gateway 스테이지 관리

### 스테이지별 설정

#### Development (`/dev`)

```typescript
{
  stageName: 'dev',
  throttling: { rateLimit: 100, burstLimit: 200 },
  logging: { level: 'INFO', dataTrace: true },
  caching: { enabled: false },
  cors: { allowOrigins: ['http://localhost:*'] },
}
```

#### Test (`/test`)

```typescript
{
  stageName: 'test',
  throttling: { rateLimit: 500, burstLimit: 1000 },
  logging: { level: 'INFO', dataTrace: true },
  caching: { enabled: false },
  cors: { allowOrigins: ['https://test.example.com'] },
}
```

#### Staging (`/staging`)

```typescript
{
  stageName: 'staging',
  throttling: { rateLimit: 1000, burstLimit: 2000 },
  logging: { level: 'ERROR', dataTrace: false },
  caching: { enabled: true, ttl: 300 },
  cors: { allowOrigins: ['https://staging.example.com'] },
}
```

#### Production (`/v1`)

```typescript
{
  stageName: 'v1',
  throttling: { rateLimit: 10000, burstLimit: 20000 },
  logging: { level: 'ERROR', dataTrace: false },
  caching: { enabled: true, ttl: 600 },
  waf: { enabled: true },
  apiKey: { required: true, quota: { limit: 100000, period: 'DAY' } },
  customDomain: 'api.example.com',
  cors: { allowOrigins: ['https://example.com'] },
}
```

## 보안 및 권한 관리

### IAM 정책

#### 최소 권한 원칙

```typescript
// 환경별 IAM 정책
const policies = {
  development: {
    enforceMinimumPrivilege: false,
    maxSessionDuration: 12시간,
  },
  test: {
    enforceMinimumPrivilege: true,
    maxSessionDuration: 8시간,
  },
  staging: {
    enforceMinimumPrivilege: true,
    requireMFA: true,
    maxSessionDuration: 4시간,
  },
  production: {
    enforceMinimumPrivilege: true,
    requireMFA: true,
    maxSessionDuration: 1시간,
  }
};
```

### 암호화

#### KMS 키 관리

- **Development/Test**: AWS 관리형 키
- **Staging/Production**: 고객 관리형 키 + 자동 순환

#### 전송 중 암호화

- 모든 환경에서 HTTPS 강제
- API Gateway에서 TLS 1.2 이상 요구

#### 저장 중 암호화

- DynamoDB: 모든 환경에서 암호화
- S3: 서버 측 암호화 (SSE-S3 또는 SSE-KMS)
- Secrets Manager: 자동 암호화 및 순환

### 네트워크 보안

#### VPC 설정

```typescript
const vpcConfig = {
  development: { enabled: false },
  test: { enabled: false },
  staging: {
    enabled: true,
    privateSubnets: true,
    natGateways: 1,
  },
  production: {
    enabled: true,
    privateSubnets: true,
    natGateways: 3,
    vpcEndpoints: ['s3', 'dynamodb', 'secrets-manager'],
  },
};
```

### 감사 및 컴플라이언스

#### CloudTrail

- **Test 이상**: 활성화
- **Production**: 멀티 리전 추적 + 파일 무결성 검증

#### Config

- **Staging 이상**: 활성화
- **Production**: 규칙 자동 평가

#### GuardDuty

- **Staging 이상**: 활성화
- **Production**: 위협 인텔리전스 피드 통합

## 배포 절차

### 사전 준비

1. AWS 계정 및 권한 확인
2. 환경 변수 설정
3. 의존성 설치

```bash
# 환경 변수 설정
export DEPLOY_ENV=development  # 또는 test, staging, production
export PROJECT_NAME=hanbit-todo
export AWS_ACCOUNT_ID=123456789012
export AWS_REGION=ap-northeast-2

# 의존성 설치
cd apps/server/infrastructure
pnpm install
```

### 환경별 배포

#### Development 배포

```bash
npm run deploy:dev
# 또는
DEPLOY_ENV=development npx cdk deploy
```

#### Test 배포

```bash
npm run deploy:test
# 또는
DEPLOY_ENV=test npx cdk deploy
```

#### Staging 배포

```bash
npm run deploy:staging
# 또는
DEPLOY_ENV=staging npx cdk deploy
```

#### Production 배포

```bash
# 프로덕션 배포는 추가 확인 필요
npm run deploy:prod
# 확인 프롬프트가 표시됨
```

### 배포 검증

```bash
# 스택 상태 확인
aws cloudformation describe-stacks --stack-name hanbit-todo-{environment}-stack

# 리소스 확인
aws dynamodb describe-table --table-name hanbit-todo-{environment}-apne2-dynamodb-todos
aws lambda list-functions --query "Functions[?starts_with(FunctionName, 'hanbit-todo-{environment}')]"
aws apigateway get-rest-apis --query "items[?name=='hanbit-todo-{environment}-apne2-api-gateway']"
```

### 롤백 절차

```bash
# 이전 버전으로 롤백
aws cloudformation update-stack \
  --stack-name hanbit-todo-{environment}-stack \
  --use-previous-template

# 또는 스택 삭제 (주의!)
cdk destroy hanbit-todo-{environment}-stack
```

## 모니터링 및 알람

### CloudWatch 대시보드

#### 환경별 대시보드

- `hanbit-todo-dev-apne2-cloudwatch-metrics`: 개발 환경
- `hanbit-todo-test-apne2-cloudwatch-metrics`: 테스트 환경
- `hanbit-todo-staging-apne2-cloudwatch-metrics`: 스테이징 환경
- `hanbit-todo-prod-apne2-cloudwatch-metrics`: 프로덕션 환경

### 주요 메트릭

#### Lambda 메트릭

- Invocations: 호출 수
- Errors: 에러 수
- Duration: 실행 시간
- Throttles: 스로틀링
- ConcurrentExecutions: 동시 실행

#### DynamoDB 메트릭

- ConsumedReadCapacityUnits: 읽기 용량 사용
- ConsumedWriteCapacityUnits: 쓰기 용량 사용
- SystemErrors: 시스템 에러
- UserErrors: 사용자 에러
- ThrottledRequests: 스로틀링된 요청

#### API Gateway 메트릭

- Count: API 호출 수
- 4XXError: 클라이언트 에러
- 5XXError: 서버 에러
- Latency: 지연 시간
- IntegrationLatency: 통합 지연 시간

### 알람 설정

#### 심각도별 알람

| 심각도   | Development | Test | Staging | Production |
| -------- | ----------- | ---- | ------- | ---------- |
| LOW      | ❌          | ❌   | ❌      | ❌         |
| MEDIUM   | ❌          | ✅   | ✅      | ❌         |
| HIGH     | ❌          | ✅   | ✅      | ✅         |
| CRITICAL | ❌          | ❌   | ✅      | ✅         |

#### 알림 채널

- **Development**: 없음
- **Test**: 이메일
- **Staging**: 이메일 + Slack
- **Production**: 이메일 + Slack + PagerDuty

### X-Ray 트레이싱

#### 샘플링 비율

- **Development**: 10%
- **Test**: 50%
- **Staging**: 80%
- **Production**: 100%

## 비용 최적화

### DynamoDB 비용 최적화

#### 빌링 모드 선택

- **개발/테스트**: On-Demand (예측 불가능한 트래픽)
- **스테이징/프로덕션**: Provisioned + Auto Scaling (예측 가능한 트래픽)

#### TTL 활용

- 게스트 데이터 자동 삭제로 스토리지 비용 절감
- 환경별 TTL 설정으로 개발 환경 비용 최소화

### Lambda 비용 최적화

#### 메모리 최적화

- 환경별 적정 메모리 설정
- 프로파일링을 통한 최적 메모리 크기 결정

#### 예약된 용량

- 프로덕션: Reserved Capacity 구매 고려
- 스테이징: 필요시 Savings Plans 활용

### API Gateway 비용 최적화

#### 캐싱 활용

- 스테이징/프로덕션에서 캐싱 활성화
- 적절한 TTL 설정으로 API 호출 감소

#### 사용량 계획

- API 키와 사용량 계획으로 과도한 사용 방지
- 환경별 쿼터 설정

### 모니터링 비용 최적화

#### 로그 보존 기간

- **Development**: 3일
- **Test**: 7일
- **Staging**: 14일
- **Production**: 30일

#### 메트릭 수집

- 환경별 필요한 메트릭만 수집
- 커스텀 메트릭은 프로덕션에서만 활성화

### 비용 모니터링

#### Budget 알람

| 환경        | 월 예산 | 알람 임계값   |
| ----------- | ------- | ------------- |
| Development | $100    | 80%           |
| Test        | $100    | 80%           |
| Staging     | $500    | 70%, 90%      |
| Production  | $1000   | 50%, 75%, 90% |

#### 태그 기반 비용 추적

```bash
# 환경별 비용 조회
aws ce get-cost-and-usage \
  --time-period Start=2024-01-01,End=2024-01-31 \
  --granularity MONTHLY \
  --metrics "UnblendedCost" \
  --group-by Type=DIMENSION,Key=LINKED_ACCOUNT \
  --filter '{
    "Tags": {
      "Key": "Environment",
      "Values": ["production"]
    }
  }'
```

## 트러블슈팅

### 일반적인 문제 해결

#### Lambda 콜드 스타트

- **증상**: 첫 호출 시 높은 지연 시간
- **해결**: Provisioned Concurrency 설정 (프로덕션)

#### DynamoDB 스로틀링

- **증상**: ProvisionedThroughputExceededException
- **해결**: Auto Scaling 설정 조정 또는 On-Demand 모드 전환

#### API Gateway 429 에러

- **증상**: Too Many Requests
- **해결**: 스로틀링 한도 증가 또는 캐싱 활성화

### 디버깅 도구

#### CloudWatch Logs Insights

```sql
-- Lambda 에러 조회
fields @timestamp, @message
| filter @message like /ERROR/
| sort @timestamp desc
| limit 100
```

#### X-Ray 서비스 맵

- 서비스 간 호출 관계 시각화
- 병목 지점 식별

## 참고 자료

### AWS 문서

- [AWS CDK 개발자 가이드](https://docs.aws.amazon.com/cdk/latest/guide/)
- [서버리스 애플리케이션 모범 사례](https://docs.aws.amazon.com/wellarchitected/latest/serverless-applications-lens/welcome.html)
- [DynamoDB 모범 사례](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)

### 내부 문서

- [프로젝트 아키텍처 문서](../docs/architecture.md)
- [보안 정책 가이드](../docs/security.md)
- [비용 최적화 가이드](./OPTIMIZATION_GUIDE.md)
