# Hanbit TODO 앱 환경별 배포 가이드

이 문서는 Hanbit TODO 앱의 환경별 배포 설정과 사용법에 대해 설명합니다.

## 🏗️ 환경 구성

### 지원 환경

- **개발(dev)**: 로컬 개발 및 테스트용
- **테스트(test)**: QA 및 통합 테스트용
- **프로덕션(prod)**: 실제 서비스 운영용

### 환경별 특징

| 환경 | 리소스 크기 | 백업 | 모니터링 | 로그 보존 | 비용 최적화 |
| ---- | ----------- | ---- | -------- | --------- | ----------- |
| dev  | 최소        | 없음 | 기본     | 7일       | 높음        |
| test | 중간        | 있음 | 상세     | 14일      | 중간        |
| prod | 높음        | 완전 | 완전     | 30일      | 낮음        |

## 🚀 배포 방법

### 1. 사전 준비

```bash
# AWS CLI 설치 및 구성
aws configure

# CDK CLI 설치
npm install -g aws-cdk

# 프로젝트 의존성 설치
cd apps/server/infrastructure
npm install
```

### 2. CDK 부트스트랩 (최초 1회)

```bash
# 기본 리전에 부트스트랩
npm run bootstrap

# 또는 특정 리전/계정에 부트스트랩
cdk bootstrap aws://ACCOUNT-ID/REGION
```

### 3. 환경별 배포

#### 개발 환경 배포

```bash
# 기본 CDK 명령어
npm run deploy:dev

# 또는 고급 배포 스크립트 (권장)
npm run deploy-script:dev

# Dry run (변경사항만 확인)
npm run deploy-script:dev-dry
```

#### 테스트 환경 배포

```bash
npm run deploy:test
# 또는
npm run deploy-script:test
```

#### 프로덕션 환경 배포

```bash
npm run deploy:prod
# 또는
npm run deploy-script:prod

# 강제 승인 (CI/CD용)
./scripts/deploy.sh prod --force-approval
```

### 4. 배포 후 환경 변수 동기화

배포가 완료되면 프론트엔드 환경 변수가 자동으로 동기화됩니다.
수동으로 동기화하려면:

```bash
# 개발 환경
npm run secrets:sync-env:dev

# 테스트 환경
npm run secrets:sync-env:test

# 프로덕션 환경
npm run secrets:sync-env:prod
```

## 🔐 시크릿 관리

### 시크릿 조회

```bash
# 환경별 시크릿 목록
./scripts/manage-secrets.sh list dev
./scripts/manage-secrets.sh list test
./scripts/manage-secrets.sh list prod

# 특정 시크릿 값 조회
./scripts/manage-secrets.sh get dev --secret-name jwt-secret
```

### 시크릿 설정

```bash
# Secrets Manager 시크릿 설정
./scripts/manage-secrets.sh set prod --secret-name api-key --secret-value "your-secret-value"

# Parameter Store 파라미터 설정
./scripts/manage-secrets.sh set prod --parameter-name config-value --parameter-value "your-config"
```

### JWT 시크릿 로테이션

```bash
# 프로덕션 JWT 시크릿 로테이션
./scripts/manage-secrets.sh rotate prod
```

## 📊 모니터링 및 로그

### CloudWatch 대시보드

각 환경별로 CloudWatch 대시보드가 자동 생성됩니다:

- 개발: `HanbitTodo-Dev-Dashboard`
- 테스트: `HanbitTodo-Test-Dashboard`
- 프로덕션: `HanbitTodo-Prod-Dashboard`

### 로그 확인

```bash
# Lambda 로그 확인
aws logs tail /aws/lambda/HanbitTodoStack-Dev-Lambda-TodoCreate --follow

# API Gateway 로그 확인
aws logs tail API-Gateway-Execution-Logs_XXXXX/dev --follow
```

### 알람 설정

프로덕션 환경에서는 다음 알람이 자동 설정됩니다:

- API Gateway 4xx/5xx 에러율
- Lambda 함수 에러율 및 지연시간
- DynamoDB 스로틀링

## 🗂️ 환경별 설정 파일

### CDK 설정

- `config/environment.ts`: 환경별 인프라 설정
- `cdk.json`: CDK 컨텍스트 및 환경 매핑

### 프론트엔드 환경 변수

- `apps/client/.env.development`: 개발 환경
- `apps/client/.env.test`: 테스트 환경
- `apps/client/.env.production`: 프로덕션 환경

## 🔧 고급 설정

### 계정/리전 변경

`cdk.json` 파일에서 환경별 계정과 리전을 설정:

```json
{
  "context": {
    "hanbit-todo:environments": {
      "prod": {
        "account": "123456789012",
        "region": "us-east-1",
        "stackName": "HanbitTodoStack-Prod"
      }
    }
  }
}
```

### 커스텀 스택 이름

환경 변수로 스택 이름 오버라이드:

```bash
export STACK_NAME="CustomStackName"
cdk deploy --context environment=dev
```

## 🚨 문제 해결

### 일반적인 문제

#### 1. CDK 부트스트랩 에러

```bash
# 부트스트랩 상태 확인
aws cloudformation describe-stacks --stack-name CDKToolkit

# 부트스트랩 재실행
cdk bootstrap --force
```

#### 2. 배포 실패

```bash
# 변경사항 확인
npm run diff:prod

# 스택 상태 확인
aws cloudformation describe-stacks --stack-name HanbitTodoStack-Prod
```

#### 3. 환경 변수 동기화 실패

```bash
# 수동 동기화
./scripts/manage-secrets.sh sync-env prod

# .env 파일 백업 복구
cp apps/client/.env.production.backup.20240101_120000 apps/client/.env.production
```

### 로그 및 디버깅

```bash
# CDK 상세 로그
cdk deploy --context environment=dev --verbose

# CloudFormation 이벤트 확인
aws cloudformation describe-stack-events --stack-name HanbitTodoStack-Dev
```

## 📋 배포 체크리스트

### 배포 전

- [ ] AWS 자격증명 설정 확인
- [ ] CDK 부트스트랩 완료
- [ ] 의존성 설치 완료
- [ ] 환경별 설정 검토

### 배포 후

- [ ] 스택 배포 상태 확인
- [ ] 환경 변수 동기화 확인
- [ ] 모니터링 대시보드 확인
- [ ] 헬스 체크 테스트

### 프로덕션 배포 시 추가 확인

- [ ] 백업 정책 확인
- [ ] 알람 설정 확인
- [ ] 보안 정책 검토
- [ ] 롤백 계획 수립

## 🔗 관련 문서

- [CDK 공식 문서](https://docs.aws.amazon.com/cdk/)
- [AWS CLI 구성](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
- [CloudWatch 모니터링](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/)
