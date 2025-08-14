# 한빛 TODO 앱 운영 매뉴얼

## 📖 목차

1. [개요](#개요)
2. [시스템 아키텍처](#시스템-아키텍처)
3. [배포 프로세스](#배포-프로세스)
4. [모니터링 및 로그 관리](#모니터링-및-로그-관리)
5. [백업 및 복구 절차](#백업-및-복구-절차)
6. [보안 관리](#보안-관리)
7. [성능 최적화](#성능-최적화)
8. [트러블슈팅](#트러블슈팅)
9. [유지보수 가이드](#유지보수-가이드)
10. [비상 연락망](#비상-연락망)

---

## 개요

### 🎯 문서 목적

이 매뉴얼은 한빛 TODO 앱의 운영, 유지보수, 모니터링을 위한 종합 가이드입니다.

### 👥 대상 독자

- **DevOps 엔지니어**: 배포 및 인프라 관리
- **시스템 관리자**: 서버 운영 및 모니터링
- **개발 팀 리더**: 기술적 의사결정 및 장애 대응
- **보안 담당자**: 보안 정책 및 컴플라이언스

### 📋 운영 체크리스트

**일일 점검:**

- [ ] 시스템 상태 모니터링 확인
- [ ] 에러 로그 검토
- [ ] 성능 메트릭 확인
- [ ] 백업 상태 점검

**주간 점검:**

- [ ] 보안 업데이트 확인
- [ ] 용량 사용률 점검
- [ ] 성능 트렌드 분석
- [ ] 장애 리포트 정리

**월간 점검:**

- [ ] 전체 시스템 헬스 체크
- [ ] 비용 최적화 검토
- [ ] 보안 감사
- [ ] 재해 복구 테스트

---

## 시스템 아키텍처

### 🏗️ 인프라 구성

```
Internet Gateway
    ↓
Application Load Balancer (ALB)
    ↓
CloudFront (CDN)
    ↓
┌─────────────────┬─────────────────┐
│   Frontend      │    Backend      │
│   (S3 + CF)     │   (API Gateway  │
│                 │   + Lambda)     │
└─────────────────┼─────────────────┘
                  ↓
            DynamoDB
              ↓
         CloudWatch
              ↓
          AWS WAF
```

### 📊 리소스 현황

**프론트엔드:**

- **S3 Bucket**: Static website hosting
- **CloudFront**: Global CDN
- **Route 53**: DNS 관리

**백엔드:**

- **API Gateway**: REST API endpoint
- **Lambda Functions**: 서버리스 컴퓨팅
- **DynamoDB**: NoSQL 데이터베이스
- **Cognito**: 사용자 인증 관리

**모니터링:**

- **CloudWatch**: 로그 및 메트릭
- **X-Ray**: 분산 추적
- **AWS Config**: 설정 관리
- **CloudTrail**: API 호출 로그

---

## 배포 프로세스

### 🚀 CI/CD 파이프라인

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      # 1. 의존성 설치 및 빌드
      - name: Install and Build
        run: |
          pnpm install
          pnpm build

      # 2. 테스트 실행
      - name: Run Tests
        run: |
          pnpm test
          pnpm test:e2e

      # 3. 보안 스캔
      - name: Security Scan
        run: |
          pnpm audit

      # 4. 배포
      - name: Deploy to AWS
        run: |
          pnpm deploy:prod
```

### 📦 배포 단계

**1단계: 프리 배포 검증**

```bash
# 환경 변수 확인
aws ssm get-parameters --names \
  "/prod/todo-app/api-url" \
  "/prod/todo-app/cognito-client-id"

# 인프라 상태 확인
terraform plan -var-file="prod.tfvars"
```

**2단계: 프론트엔드 배포**

```bash
# S3에 정적 파일 업로드
aws s3 sync dist/ s3://todo-app-prod-frontend --delete

# CloudFront 캐시 무효화
aws cloudfront create-invalidation \
  --distribution-id E1234567890ABC \
  --paths "/*"
```

**3단계: 백엔드 배포**

```bash
# Lambda 함수 배포
serverless deploy --stage prod

# API Gateway 스테이지 업데이트
aws apigateway create-deployment \
  --rest-api-id abc123 \
  --stage-name prod
```

**4단계: 포스트 배포 검증**

```bash
# 헬스 체크
curl -f https://api.todo-app.com/health

# 스모크 테스트
npm run test:smoke:prod
```

### 🔄 롤백 절차

**자동 롤백 (실패 시):**

```bash
# 이전 버전으로 자동 롤백
aws lambda update-alias \
  --function-name todo-api \
  --name LIVE \
  --function-version $PREVIOUS_VERSION
```

**수동 롤백:**

```bash
# 1. 트래픽 차단
aws elbv2 modify-target-group \
  --target-group-arn $TARGET_GROUP_ARN \
  --health-check-path /maintenance

# 2. 이전 버전 배포
git checkout $LAST_KNOWN_GOOD_COMMIT
pnpm deploy:rollback

# 3. 검증 후 트래픽 복구
aws elbv2 modify-target-group \
  --target-group-arn $TARGET_GROUP_ARN \
  --health-check-path /health
```

---

## 모니터링 및 로그 관리

### 📊 핵심 메트릭

**시스템 메트릭:**

- **CPU 사용률**: < 70% (정상), > 85% (경고)
- **메모리 사용률**: < 80% (정상), > 90% (경고)
- **응답 시간**: < 200ms (정상), > 1000ms (경고)
- **에러율**: < 1% (정상), > 5% (경고)

**비즈니스 메트릭:**

- **활성 사용자 수**: DAU, MAU 추적
- **할일 생성율**: 시간당 생성 수
- **완료율**: 생성 대비 완료 비율
- **사용자 유지율**: 7일, 30일 유지율

### 🔍 로그 관리

**로그 레벨:**

```
ERROR   - 시스템 오류 (즉시 대응 필요)
WARN    - 경고 (모니터링 필요)
INFO    - 일반 정보 (비즈니스 로직)
DEBUG   - 디버깅 정보 (개발 환경만)
```

**로그 형식:**

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "ERROR",
  "service": "todo-api",
  "function": "createTodo",
  "userId": "user-123",
  "requestId": "req-456",
  "message": "Failed to create todo",
  "error": {
    "name": "ValidationError",
    "message": "Title is required",
    "stack": "..."
  },
  "metadata": {
    "ip": "192.168.1.1",
    "userAgent": "Mozilla/5.0..."
  }
}
```

### 📈 CloudWatch 대시보드

```json
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/Lambda", "Duration", "FunctionName", "todo-api"],
          ["AWS/Lambda", "Errors", "FunctionName", "todo-api"],
          ["AWS/ApiGateway", "4XXError", "ApiName", "todo-api"],
          ["AWS/ApiGateway", "5XXError", "ApiName", "todo-api"]
        ],
        "period": 300,
        "stat": "Average",
        "region": "ap-northeast-2",
        "title": "API Performance"
      }
    }
  ]
}
```

### 🚨 경고 설정

**CloudWatch 알람:**

```bash
# 높은 에러율 알람
aws cloudwatch put-metric-alarm \
  --alarm-name "todo-api-high-error-rate" \
  --alarm-description "API error rate > 5%" \
  --metric-name "Errors" \
  --namespace "AWS/Lambda" \
  --statistic "Sum" \
  --period 300 \
  --threshold 5.0 \
  --comparison-operator "GreaterThanThreshold" \
  --alarm-actions "arn:aws:sns:ap-northeast-2:123456789012:alerts"

# 응답 시간 알람
aws cloudwatch put-metric-alarm \
  --alarm-name "todo-api-high-latency" \
  --alarm-description "API latency > 1000ms" \
  --metric-name "Duration" \
  --namespace "AWS/Lambda" \
  --statistic "Average" \
  --period 300 \
  --threshold 1000.0 \
  --comparison-operator "GreaterThanThreshold" \
  --alarm-actions "arn:aws:sns:ap-northeast-2:123456789012:alerts"
```

---

## 백업 및 복구 절차

### 💾 백업 전략

**DynamoDB 백업:**

```bash
# 자동 백업 활성화 (권장)
aws dynamodb put-backup-policy \
  --table-name todos \
  --backup-policy BackupEnabled=true

# 수동 백업 생성
aws dynamodb create-backup \
  --table-name todos \
  --backup-name "todos-backup-$(date +%Y%m%d-%H%M%S)"
```

**설정 백업:**

```bash
# Lambda 함수 설정 백업
aws lambda get-function \
  --function-name todo-api > lambda-config-backup.json

# API Gateway 설정 백업
aws apigateway get-rest-api \
  --rest-api-id abc123 > apigateway-config-backup.json
```

### 🔄 복구 절차

**데이터 복구:**

```bash
# DynamoDB 테이블 복원
aws dynamodb restore-table-from-backup \
  --target-table-name todos-restored \
  --backup-arn "arn:aws:dynamodb:region:account:backup/backup-name"
```

**전체 시스템 복구:**

```bash
# 1. 인프라 복구 (Terraform)
terraform apply -var-file="disaster-recovery.tfvars"

# 2. 코드 배포
git checkout $LAST_KNOWN_GOOD_TAG
pnpm deploy:disaster-recovery

# 3. 데이터 복구
./scripts/restore-data.sh $BACKUP_DATE

# 4. 검증
./scripts/verify-restore.sh
```

### 📋 복구 시나리오

**시나리오 1: 단일 Lambda 함수 장애**

- 영향도: 낮음
- 복구 시간: 5분
- 절차: 자동 재시작 또는 이전 버전 배포

**시나리오 2: DynamoDB 테이블 손상**

- 영향도: 높음
- 복구 시간: 30분
- 절차: 백업에서 테이블 복원

**시나리오 3: 전체 리전 장애**

- 영향도: 매우 높음
- 복구 시간: 2시간
- 절차: 다른 리전으로 전환

---

## 보안 관리

### 🛡️ 보안 정책

**접근 제어:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::123456789012:role/TodoAppRole"
      },
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem"
      ],
      "Resource": "arn:aws:dynamodb:region:account:table/todos"
    }
  ]
}
```

**네트워크 보안:**

```bash
# VPC 보안 그룹 설정
aws ec2 authorize-security-group-ingress \
  --group-id sg-12345678 \
  --protocol tcp \
  --port 443 \
  --source-group sg-87654321
```

### 🔐 인증/인가 관리

**Cognito 사용자 관리:**

```bash
# 사용자 상태 확인
aws cognito-idp admin-get-user \
  --user-pool-id us-east-1_123456789 \
  --username user@example.com

# 의심스러운 사용자 비활성화
aws cognito-idp admin-disable-user \
  --user-pool-id us-east-1_123456789 \
  --username suspicious-user@example.com
```

**JWT 토큰 검증:**

```bash
# 토큰 만료 시간 확인
jwt-cli decode $JWT_TOKEN

# 토큰 블랙리스트 추가
redis-cli SET "blacklist:$JWT_JTI" "true" EX 3600
```

### 🔍 보안 모니터링

**의심스러운 활동 탐지:**

- 비정상적인 API 호출 패턴
- 실패한 인증 시도 급증
- 대량 데이터 접근
- 알려진 악성 IP에서의 요청

**보안 알람:**

```bash
# 비정상적인 트래픽 패턴 알람
aws logs put-metric-filter \
  --log-group-name "/aws/lambda/todo-api" \
  --filter-name "SuspiciousActivity" \
  --filter-pattern "[timestamp, requestId, level=ERROR, event=SECURITY_VIOLATION]" \
  --metric-transformations \
    metricName=SecurityViolations,metricNamespace=TodoApp,metricValue=1
```

---

## 성능 최적화

### ⚡ 성능 메트릭 목표

**응답 시간:**

- API 응답: < 200ms (90th percentile)
- 페이지 로딩: < 2초 (초기 로딩)
- 정적 자산: < 100ms (CDN 캐시 히트)

**처리량:**

- API 처리율: > 1000 RPS
- 동시 사용자: > 10,000명
- 데이터베이스: > 4000 WCU/RCU

### 🔧 최적화 전략

**프론트엔드 최적화:**

```bash
# 번들 크기 분석
pnpm build:analyze

# 코드 스플리팅 확인
ls -la dist/assets/

# 이미지 최적화 확인
imagemin src/assets/**/*.{jpg,png} --out-dir=dist/assets/
```

**백엔드 최적화:**

```python
# Lambda 콜드 스타트 최소화
import json
import boto3

# 전역 변수로 클라이언트 초기화 (콜드 스타트 시에만 실행)
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('todos')

def lambda_handler(event, context):
    # 핸들러 로직
    pass
```

**데이터베이스 최적화:**

```bash
# DynamoDB 인덱스 활용 상태 확인
aws dynamodb describe-table \
  --table-name todos \
  --query 'Table.GlobalSecondaryIndexes[].IndexStatus'

# 읽기/쓰기 용량 조정
aws dynamodb update-table \
  --table-name todos \
  --provisioned-throughput ReadCapacityUnits=100,WriteCapacityUnits=100
```

### 📊 성능 모니터링

**실시간 성능 대시보드:**

```bash
# API Gateway 메트릭 조회
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name Latency \
  --dimensions Name=ApiName,Value=todo-api \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average
```

---

## 트러블슈팅

### 🐛 일반적인 문제

**문제 1: API 응답 지연**

_증상:_ 응답 시간 > 1초
_원인:_ Lambda 콜드 스타트, DynamoDB 스로틀링
_해결:_

```bash
# Lambda 동시성 예약 설정
aws lambda put-reserved-concurrency-settings \
  --function-name todo-api \
  --reserved-concurrency-limit 100

# DynamoDB Auto Scaling 활성화
aws application-autoscaling register-scalable-target \
  --service-namespace dynamodb \
  --resource-id table/todos \
  --scalable-dimension dynamodb:table:WriteCapacityUnits
```

**문제 2: 간헐적 5XX 에러**

_증상:_ 5% 정도의 요청에서 500 에러
_원인:_ Lambda 함수 메모리 부족, 타임아웃
_해결:_

```bash
# Lambda 설정 조정
aws lambda update-function-configuration \
  --function-name todo-api \
  --memory-size 512 \
  --timeout 30
```

**문제 3: 사용자 인증 실패**

_증상:_ 로그인 후 401 Unauthorized
_원인:_ JWT 토큰 만료, Cognito 설정 오류
_해결:_

```bash
# Cognito 토큰 설정 확인
aws cognito-idp describe-user-pool-client \
  --user-pool-id us-east-1_123456789 \
  --client-id 1234567890abcdef
```

### 🔍 진단 도구

**로그 검색:**

```bash
# CloudWatch Insights로 에러 로그 검색
aws logs start-query \
  --log-group-name "/aws/lambda/todo-api" \
  --start-time $(date -d '1 hour ago' +%s) \
  --end-time $(date +%s) \
  --query-string 'fields @timestamp, @message | filter level = "ERROR" | sort @timestamp desc'
```

**성능 분석:**

```bash
# X-Ray 트레이스 분석
aws xray get-trace-summaries \
  --time-range-type TimeRangeByStartTime \
  --start-time $(date -d '1 hour ago' +%s) \
  --end-time $(date +%s) \
  --filter-expression 'duration > 5.0'
```

### 📞 에스컬레이션 절차

**레벨 1**: 운영 담당자 (일반 문제)
**레벨 2**: 시니어 엔지니어 (복잡한 기술 문제)
**레벨 3**: 아키텍트/CTO (시스템 전체 문제)

**에스컬레이션 기준:**

- 30분 내 해결 불가 시 레벨 2로 에스컬레이션
- 시스템 전체 장애 시 즉시 레벨 3으로 에스컬레이션
- 보안 사고 시 즉시 보안팀과 레벨 3에 동시 통보

---

## 유지보수 가이드

### 🔄 정기 유지보수

**매일:**

- [ ] 시스템 상태 확인
- [ ] 에러 로그 검토
- [ ] 백업 상태 점검

**매주:**

- [ ] 성능 트렌드 분석
- [ ] 보안 업데이트 확인
- [ ] 용량 계획 검토

**매월:**

- [ ] 전체 시스템 헬스 체크
- [ ] 비용 최적화 검토
- [ ] 재해 복구 테스트

**분기:**

- [ ] 보안 감사
- [ ] 성능 부하 테스트
- [ ] 아키텍처 리뷰

### 📈 용량 계획

**사용자 증가 예측:**

```bash
# 현재 사용자 수 확인
aws cloudwatch get-metric-statistics \
  --namespace TodoApp \
  --metric-name ActiveUsers \
  --start-time $(date -d '30 days ago' +%s) \
  --end-time $(date +%s) \
  --period 86400 \
  --statistics Maximum
```

**리소스 스케일링 계획:**

- 사용자 10% 증가 시: Lambda 동시성 20% 증가
- 데이터 증가 시: DynamoDB 용량 자동 스케일링
- 트래픽 급증 시: CloudFront 캐시 증대

### 💰 비용 최적화

**비용 모니터링:**

```bash
# 월별 비용 확인
aws ce get-cost-and-usage \
  --time-period Start=$(date -d 'last month' +%Y-%m-01),End=$(date +%Y-%m-01) \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE
```

**최적화 포인트:**

- 사용하지 않는 리소스 정리
- DynamoDB On-Demand vs Provisioned 비교
- Lambda 메모리 크기 최적화
- CloudFront 캐시 효율성 개선

---

## 비상 연락망

### 📞 연락처

**Primary On-Call (24/7):**

- 이름: 홍길동
- 전화: 010-1234-5678
- 이메일: hongkd@company.com
- 슬랙: @hongkd

**Secondary On-Call:**

- 이름: 김개발
- 전화: 010-2345-6789
- 이메일: kimdev@company.com
- 슬랙: @kimdev

**에스컬레이션:**

- CTO: 010-9999-8888
- 보안팀: security@company.com
- 인프라팀: infra@company.com

### 🚨 장애 대응 절차

**P0 (Critical): 전체 서비스 중단**

- 대응 시간: 5분 내
- 통보 대상: 모든 이해관계자
- 대응 방법: 즉시 대응팀 소집

**P1 (High): 주요 기능 장애**

- 대응 시간: 15분 내
- 통보 대상: 기술팀 + 관리자
- 대응 방법: Primary On-Call 대응

**P2 (Medium): 부분 기능 장애**

- 대응 시간: 1시간 내
- 통보 대상: 기술팀
- 대응 방법: 다음 근무일 대응

**P3 (Low): 개선 사항**

- 대응 시간: 48시간 내
- 통보 대상: 담당자
- 대응 방법: 백로그 등록

### 📊 SLA 목표

**가용성:**

- P0 장애 대응: 5분 내
- P1 장애 대응: 15분 내
- 월간 가용성: 99.9% 이상

**성능:**

- API 응답시간: 95th percentile < 500ms
- 페이지 로딩: 95th percentile < 3초

---

## 📝 운영 로그

### 변경 이력

| 날짜       | 변경 내용             | 담당자 | 승인자 |
| ---------- | --------------------- | ------ | ------ |
| 2024-01-15 | 초기 운영 매뉴얼 작성 | 김개발 | CTO    |
|            |                       |        |        |

### 장애 이력

| 날짜 | 장애 내용 | 원인 | 해결 방법 | 재발 방지 |
| ---- | --------- | ---- | --------- | --------- |
|      |           |      |           |           |

---

_이 매뉴얼은 시스템 변경에 따라 정기적으로 업데이트되어야 합니다._

**마지막 업데이트**: 2024년 1월 15일  
**버전**: 1.0.0  
**검토자**: CTO, DevOps 팀장
