# CDK 인프라 최적화 가이드

## 📋 개요

이 문서는 Hanbit Todo 앱의 CDK 인프라를 환경별로 최적화하는 방법을 설명합니다.

## 🎯 최적화 목표

### 개발 환경 (Development)

- **최우선 목표**: 비용 최소화
- **목표 비용**: $100/월 이하
- **전략**:
  - On-demand 리소스 사용
  - 자동 종료 스케줄링
  - 최소 리소스 할당

### 테스트 환경 (Test)

- **최우선 목표**: 비용과 성능의 균형
- **목표 비용**: $300/월 이하
- **전략**:
  - 제한된 동시 실행
  - 주말 자동 스케일 다운
  - 선택적 모니터링

### 프로덕션 환경 (Production)

- **최우선 목표**: 고가용성 및 성능
- **목표 비용**: $1000/월 이하
- **전략**:
  - 자동 스케일링
  - 다중 AZ 배포
  - 포괄적 모니터링

## 🏗️ 최적화된 스택 구조

```
optimized/
├── base-stack.ts           # 기본 스택 (태깅, 비용 할당)
├── database-stack.ts        # DynamoDB 최적화
├── lambda-stack.ts          # Lambda 최적화
├── network-security-stack.ts # 네트워크/보안
└── cost-monitoring-stack.ts  # 비용 모니터링
```

## 📊 환경별 리소스 최적화

### 1. DynamoDB 최적화

| 환경 | 빌링 모드   | 백업 | PITR | 스트림 | GSI 프로젝션 | 예상 비용 |
| ---- | ----------- | ---- | ---- | ------ | ------------ | --------- |
| Dev  | On-Demand   | ❌   | ❌   | ❌     | KEYS_ONLY    | ~$5/월    |
| Test | On-Demand   | ✅   | ❌   | ✅     | INCLUDE      | ~$50/월   |
| Prod | Provisioned | ✅   | ✅   | ✅     | ALL          | ~$200/월  |

**개발 환경 최적화**:

```typescript
// Pay-per-request로 비용 절감
billingMode: dynamodb.BillingMode.PAY_PER_REQUEST;

// GSI는 키만 프로젝션
projectionType: dynamodb.ProjectionType.KEYS_ONLY;
```

**프로덕션 환경 최적화**:

```typescript
// Auto-scaling 설정
readScaling.scaleOnUtilization({
  targetUtilizationPercent: 70,
});

// 기여자 인사이트 활성화
contributorInsightsEnabled: true;
```

### 2. Lambda 최적화

| 환경 | 아키텍처 | 메모리 | 동시실행 | 프로비전드 | X-Ray | 예상 비용 |
| ---- | -------- | ------ | -------- | ---------- | ----- | --------- |
| Dev  | ARM64    | 256MB  | 무제한   | ❌         | ❌    | ~$10/월   |
| Test | x86_64   | 512MB  | 50       | ❌         | ✅    | ~$80/월   |
| Prod | ARM64    | 1024MB | 100      | 2          | ✅    | ~$300/월  |

**개발 환경 최적화**:

```typescript
// ARM 아키텍처로 비용 20% 절감
architecture: lambda.Architecture.ARM_64;

// 최소 메모리 사용
memorySize: 256;

// X-Ray 비활성화
tracing: lambda.Tracing.PASS_THROUGH;
```

**프로덕션 환경 최적화**:

```typescript
// 중요 함수에 프로비전드 동시성
provisionedConcurrentExecutions: 2;

// Lambda Insights 활성화
layers: [lambdaInsightsLayer];
```

### 3. 네트워크 및 보안 최적화

| 환경 | VPC | NAT GW | AZ  | WAF | VPC Endpoints | 예상 비용 |
| ---- | --- | ------ | --- | --- | ------------- | --------- |
| Dev  | ❌  | 0      | -   | ❌  | -             | $0/월     |
| Test | ✅  | 1      | 2   | ❌  | S3, DynamoDB  | ~$45/월   |
| Prod | ✅  | 2      | 3   | ✅  | 전체          | ~$200/월  |

**개발 환경 최적화**:

```typescript
// VPC 사용하지 않음
vpcEnabled: false;
```

**프로덕션 환경 최적화**:

```typescript
// 고가용성을 위한 다중 NAT Gateway
natGateways: 2;

// VPC Endpoints로 데이터 전송 비용 절감
vpcEndpoints: ['s3', 'dynamodb', 'secretsmanager', 'kms'];
```

## 💰 비용 모니터링 및 알림

### 예산 설정

```typescript
// 환경별 월간 예산
const monthlyBudget = {
  development: 100, // $100
  test: 300, // $300
  production: 1000, // $1000
};
```

### 알림 임계값

- **50% 도달**: 정보성 알림
- **80% 도달**: 경고 알림
- **100% 예상**: 긴급 알림

### 자동 비용 최적화

**개발 환경**:

- 평일 저녁 7시 이후 리소스 자동 중지
- 주말 전체 리소스 중지

**테스트 환경**:

- 금요일 저녁 10시 스케일 다운
- 월요일 아침 자동 스케일 업

## 🚀 배포 방법

### 1. 환경 변수 설정

```bash
# 개발 환경
export NODE_ENV=development
export COST_ALERT_EMAILS="dev-team@example.com"

# 테스트 환경
export NODE_ENV=test
export COST_ALERT_EMAILS="qa-team@example.com"

# 프로덕션 환경
export NODE_ENV=production
export COST_ALERT_EMAILS="ops-team@example.com"
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."
```

### 2. CDK 배포

```bash
# 의존성 설치
cd apps/server/infrastructure
npm install

# CDK Bootstrap (첫 배포시)
cdk bootstrap

# 개발 환경 배포
NODE_ENV=development cdk deploy --all

# 테스트 환경 배포
NODE_ENV=test cdk deploy --all

# 프로덕션 환경 배포 (승인 필요)
NODE_ENV=production cdk deploy --all --require-approval broadening
```

### 3. 배포 검증

```bash
# 스택 상태 확인
aws cloudformation describe-stacks --stack-name HanbitTodoStack-Dev

# 비용 예산 확인
aws budgets describe-budgets --account-id $(aws sts get-caller-identity --query Account --output text)

# CloudWatch 대시보드 확인
aws cloudwatch get-dashboard --dashboard-name hanbit-cost-dashboard-development
```

## 📈 성능 메트릭

### 목표 메트릭

| 메트릭             | 개발  | 테스트 | 프로덕션 |
| ------------------ | ----- | ------ | -------- |
| API 응답시간       | <1s   | <500ms | <200ms   |
| Lambda 콜드스타트  | <3s   | <2s    | <1s      |
| DynamoDB 읽기 지연 | <50ms | <30ms  | <10ms    |
| 에러율             | <5%   | <2%    | <0.5%    |
| 가용성             | 95%   | 99%    | 99.9%    |

## 🔧 트러블슈팅

### 비용 초과 시

1. **즉시 조치**:

   ```bash
   # 개발 환경 리소스 중지
   aws lambda put-function-concurrency \
     --function-name hanbit-todo-create-development \
     --reserved-concurrent-executions 0
   ```

2. **원인 분석**:
   - Cost Explorer에서 비용 급증 서비스 확인
   - CloudWatch Insights로 비정상 트래픽 분석
   - X-Ray로 성능 병목 확인

3. **최적화 적용**:
   - Reserved Instances 구매 검토
   - Savings Plans 적용
   - 불필요한 리소스 정리

### 성능 이슈 시

1. **Lambda 최적화**:
   - 메모리 크기 증가
   - 프로비전드 동시성 추가
   - 코드 최적화

2. **DynamoDB 최적화**:
   - Auto-scaling 임계값 조정
   - GSI 추가/수정
   - 파티션 키 설계 개선

## 📝 체크리스트

### 배포 전 확인사항

- [ ] 환경 변수 설정 완료
- [ ] 비용 예산 설정 확인
- [ ] 알림 이메일 설정
- [ ] 태그 전략 확인
- [ ] 보안 그룹 규칙 검토

### 배포 후 확인사항

- [ ] CloudFormation 스택 정상 생성
- [ ] Lambda 함수 동작 테스트
- [ ] API Gateway 엔드포인트 테스트
- [ ] CloudWatch 대시보드 확인
- [ ] 비용 알림 테스트

## 🎯 예상 절감 효과

### 최적화 전후 비교

| 항목          | 최적화 전     | 최적화 후     | 절감액            |
| ------------- | ------------- | ------------- | ----------------- |
| 개발 환경     | $150/월       | $100/월       | $50/월 (33%)      |
| 테스트 환경   | $450/월       | $300/월       | $150/월 (33%)     |
| 프로덕션 환경 | $1,300/월     | $1,000/월     | $300/월 (23%)     |
| **총합**      | **$1,900/월** | **$1,400/월** | **$500/월 (26%)** |

### 연간 절감액: $6,000

## 📚 참고 자료

- [AWS Well-Architected Framework - Cost Optimization](https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/welcome.html)
- [AWS CDK Best Practices](https://docs.aws.amazon.com/cdk/v2/guide/best-practices.html)
- [DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)
- [Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
