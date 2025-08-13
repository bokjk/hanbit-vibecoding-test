# 배포 및 운영 가이드

이 문서는 Hanbit TODO 앱의 배포 모니터링, 알림 시스템, 롤백 전략을 포함한 완전한 운영 시스템 가이드입니다.

## 📋 목차

1. [시스템 개요](#시스템-개요)
2. [배포 모니터링](#배포-모니터링)
3. [알림 시스템](#알림-시스템)
4. [롤백 전략](#롤백-전략)
5. [배포 메트릭](#배포-메트릭)
6. [운영 가이드](#운영-가이드)
7. [트러블슈팅](#트러블슈팅)

## 🏗️ 시스템 개요

### 아키텍처

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   GitHub        │    │   AWS Lambda     │    │   CloudWatch    │
│   Actions       │────▶   Functions     │────▶   Monitoring   │
│                 │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                        │
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   DynamoDB      │    │   SNS Topics     │    │   Slack/Email   │
│   History       │    │   Alerts         │    │   Notifications │
│                 │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### 주요 컴포넌트

1. **배포 모니터링 시스템**
   - 실시간 헬스체크
   - 자동 롤백 감지
   - 성능 메트릭 수집

2. **알림 시스템**
   - 이메일 알림 (SNS)
   - Slack 통합
   - 다단계 알림 전략

3. **배포 히스토리**
   - DynamoDB 기반 추적
   - API를 통한 조회
   - 90일 자동 보관

4. **자동 롤백**
   - 실패 감지 시 자동 트리거
   - Git 커밋 기반 복원
   - 헬스체크 검증

## 📊 배포 모니터링

### CloudWatch 대시보드

각 환경별로 전용 대시보드가 생성됩니다:

- `deployment-monitoring-dev`
- `deployment-monitoring-test`
- `deployment-monitoring-prod`

### 주요 메트릭

1. **배포 성공률**
   - 총 배포 횟수
   - 성공/실패 비율
   - 평균 배포 시간

2. **Lambda 함수 성능**
   - 에러율
   - 응답 시간
   - 동시 실행 수

3. **API Gateway 메트릭**
   - 5XX 에러율
   - 평균 응답 시간
   - 요청 수

### 대시보드 접근 방법

```bash
# CDK 출력에서 대시보드 URL 확인
aws cloudformation describe-stacks \
  --stack-name HanbitTodoStack-prod \
  --query 'Stacks[0].Outputs[?OutputKey==`DeploymentDashboardUrlProd`].OutputValue' \
  --output text
```

## 🔔 알림 시스템

### 이메일 알림 (SNS)

#### 설정 방법

```typescript
// environment.ts에서 설정
monitoring: {
  alertEmail: "ops-team@company.com",
  // ...
}
```

#### 알림 유형

- ✅ 배포 성공
- ❌ 배포 실패
- ⚠️ 헬스체크 실패
- 🔄 자동 롤백 시작/완료

### Slack 통합

#### Webhook URL 설정

```bash
# 환경 변수로 설정
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX"

# 또는 environment.ts에서 설정
monitoring: {
  slackWebhookUrl: process.env.SLACK_WEBHOOK_URL,
  // ...
}
```

#### 알림 예시

```json
{
  "text": "🚨 프로덕션 배포 실패!",
  "attachments": [
    {
      "color": "danger",
      "fields": [
        { "title": "배포 ID", "value": "deploy-20241212-143052-a1b2c3d4", "short": true },
        { "title": "환경", "value": "prod", "short": true },
        { "title": "커밋", "value": "a1b2c3d4", "short": true },
        { "title": "배포자", "value": "developer", "short": true }
      ]
    }
  ]
}
```

## 🔄 롤백 전략

### 자동 롤백

#### 트리거 조건

1. 헬스체크 실패 (연속 2회)
2. Lambda 함수 에러율 > 5%
3. API Gateway 5XX 에러율 > 10%

#### 롤백 프로세스

```mermaid
flowchart TD
    A[배포 실패 감지] --> B[현재 상태 백업]
    B --> C[롤백 대상 확인]
    C --> D[Git 커밋 기반 롤백]
    D --> E[CDK 재배포]
    E --> F[헬스체크 수행]
    F --> G{헬스체크 성공?}
    G -->|Yes| H[롤백 완료 알림]
    G -->|No| I[수동 개입 필요 알림]
```

### 수동 롤백

#### 스크립트 사용

```bash
# 최근 성공한 배포 목록 확인
cd apps/server/infrastructure/scripts
./deployment-metrics.sh prod 7

# 특정 배포로 롤백
./rollback-deployment.sh prod deploy-20241212-120000-x1y2z3w4
```

#### GitHub Actions를 통한 롤백

```yaml
# workflow_dispatch로 수동 트리거
deployment_type: rollback
rollback_target: deploy-20241212-120000-x1y2z3w4
```

## 📈 배포 메트릭

### 메트릭 수집

#### 자동 수집

- 배포 이벤트마다 DynamoDB에 자동 기록
- CloudWatch 커스텀 메트릭으로 전송
- 알림 발생 시 메트릭 업데이트

#### 수동 수집

```bash
# 배포 메트릭 리포트 생성
cd apps/server/infrastructure/scripts
./deployment-metrics.sh prod 30

# 생성된 리포트 확인
ls reports/
```

### 리포트 파일

1. **deployment-stats-{env}-{timestamp}.json**

   ```json
   {
     "stats": {
       "totalDeployments": 45,
       "successfulDeployments": 43,
       "failedDeployments": 2,
       "successRate": 95.56,
       "averageDuration": 180
     },
     "recentTrends": {
       "last7Days": {...},
       "last30Days": {...}
     }
   }
   ```

2. **cloudwatch-metrics-{env}-{timestamp}.json**
   - Lambda 함수별 에러/성능 메트릭
   - API Gateway 메트릭
   - 시간대별 상세 데이터

3. **deployment-summary-{env}-{timestamp}.md**
   - 한눈에 보는 요약 리포트
   - 권장사항 포함
   - 마크다운 형식

### API를 통한 조회

```bash
# 최근 배포 히스토리 조회
curl -X GET "https://your-api.com/deployment/history?limit=10"

# 배포 통계 조회
curl -X GET "https://your-api.com/deployment/stats?period=30"

# 특정 배포 상세 정보
curl -X GET "https://your-api.com/deployment/history/deploy-20241212-120000"
```

## 🛠️ 운영 가이드

### 일일 운영 체크리스트

#### 오전 체크 (09:00)

- [ ] 야간 배포 결과 확인
- [ ] CloudWatch 알람 상태 점검
- [ ] 배포 메트릭 리포트 검토

#### 오후 체크 (14:00)

- [ ] 배포 대기 중인 PR 확인
- [ ] 시스템 성능 모니터링
- [ ] 알림 설정 상태 확인

#### 주간 작업 (매주 월요일)

- [ ] 주간 배포 리포트 생성
- [ ] 실패한 배포 원인 분석
- [ ] 배포 프로세스 개선 사항 검토

### 환경별 배포 절차

#### 개발 환경 (development)

```bash
# 자동 배포 (main 브랜치 push 시)
git push origin main

# 수동 배포
cd apps/server/infrastructure
cdk deploy HanbitTodoStack-development
```

#### 테스트 환경 (test)

```bash
# GitHub Actions 수동 트리거
# Repository → Actions → "Deploy to Test" → Run workflow
```

#### 프로덕션 환경 (production)

```bash
# 승인 필요한 배포
# Repository → Actions → "프로덕션 배포 승인 워크플로우" → Run workflow
# → 승인 대기 → Environment approval → 배포 진행
```

### 긴급 상황 대응

#### 서비스 장애 시

1. **즉시 롤백**

   ```bash
   # 최근 성공한 배포로 롤백
   ./rollback-deployment.sh prod [마지막_성공_배포_ID]
   ```

2. **핫픽스 배포**

   ```yaml
   # GitHub Actions에서 핫픽스 배포
   deployment_type: hotfix
   force_deploy: true
   ```

3. **수동 개입**
   - AWS 콘솔에서 직접 조치
   - CloudFormation 스택 상태 확인
   - Lambda 함수 개별 점검

## 🔧 트러블슈팅

### 자주 발생하는 문제

#### 1. 배포 실패

**증상**: CDK 배포 중 에러 발생

```bash
# 해결 방법
1. CloudFormation 스택 이벤트 확인
aws cloudformation describe-stack-events --stack-name HanbitTodoStack-prod

2. Lambda 함수 로그 확인
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/HanbitTodoStack"

3. 필요시 수동 정리 후 재배포
cdk destroy HanbitTodoStack-prod
cdk deploy HanbitTodoStack-prod
```

#### 2. 헬스체크 실패

**증상**: 배포 후 헬스체크가 지속적으로 실패

```bash
# 해결 방법
1. API Gateway 엔드포인트 상태 확인
curl -v https://your-api.com/health

2. Lambda 함수 실행 로그 확인
aws logs tail /aws/lambda/HanbitTodoStack-prod-Lambda-CreateTodoFunction

3. DynamoDB 테이블 상태 확인
aws dynamodb describe-table --table-name todos-prod
```

#### 3. 알림 미수신

**증상**: 배포 실패 시 알림이 오지 않음

```bash
# 해결 방법
1. SNS 토픽 구독 상태 확인
aws sns list-subscriptions-by-topic --topic-arn arn:aws:sns:...

2. Slack Webhook URL 유효성 확인
curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"테스트 메시지"}' \
  $SLACK_WEBHOOK_URL

3. Lambda 함수 실행 권한 확인
aws iam list-attached-role-policies --role-name HanbitTodoStack-prod-...
```

### 로그 분석

#### CloudWatch Logs 쿼리

```bash
# 배포 관련 에러 검색
aws logs start-query \
  --log-group-name "/aws/lambda/HanbitTodoStack-prod-DeploymentMonitoring-HealthCheckFunction" \
  --start-time 1702339200 \
  --end-time 1702342800 \
  --query-string 'fields @timestamp, @message | filter @message like /ERROR/'
```

#### 배포 실패 패턴 분석

```sql
-- CloudWatch Logs Insights 쿼리
fields @timestamp, @message
| filter @message like /deployment/
| filter @message like /failed/
| stats count() by bin(5m)
```

### 성능 최적화

#### Lambda 함수 최적화

```typescript
// 콜드 스타트 최소화
const client = new DynamoDBClient({}); // 함수 외부에서 초기화

export const handler = async event => {
  // 핸들러 내부는 최소화
};
```

#### DynamoDB 최적화

```bash
# 읽기/쓰기 용량 모니터링
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ConsumedReadCapacityUnits \
  --dimensions Name=TableName,Value=deployment-history-prod
```

## 📚 참고 자료

### AWS 문서

- [CloudWatch 대시보드 가이드](https://docs.aws.amazon.com/cloudwatch/latest/monitoring/CloudWatch_Dashboards.html)
- [SNS 알림 설정](https://docs.aws.amazon.com/sns/latest/dg/sns-email-notifications.html)
- [Lambda 모니터링](https://docs.aws.amazon.com/lambda/latest/dg/lambda-monitoring.html)

### 내부 문서

- [CDK 배포 가이드](./README.md)
- [환경 설정 가이드](./config/README.md)
- [보안 설정 가이드](./SECURITY.md)

### 스크립트 및 도구

- `deployment-metrics.sh` - 배포 메트릭 수집
- `rollback-deployment.sh` - 수동 롤백 실행
- GitHub Actions 워크플로우 - `.github/workflows/`

---

## 🚨 긴급 연락처

**개발팀**: dev-team@company.com  
**운영팀**: ops-team@company.com  
**보안팀**: security-team@company.com

**24시간 대응**: +82-10-XXXX-XXXX  
**Slack 채널**: #hanbit-todo-ops

---

_이 문서는 정기적으로 업데이트됩니다. 마지막 업데이트: 2024-12-12_
