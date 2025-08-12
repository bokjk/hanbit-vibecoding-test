# Hanbit TODO 앱 인프라 배포 가이드

이 문서는 Hanbit TODO 앱의 AWS 인프라를 환경별로 배포하는 방법을 설명합니다.

## 📋 목차

- [환경 개요](#환경-개요)
- [사전 요구사항](#사전-요구사항)
- [환경별 배포](#환경별-배포)
- [시크릿 관리](#시크릿-관리)
- [모니터링](#모니터링)
- [문제 해결](#문제-해결)

## 🌍 환경 개요

### 지원되는 환경

| 환경   | 스택명               | 용도          | 특징                      |
| ------ | -------------------- | ------------- | ------------------------- |
| `dev`  | HanbitTodoStack-Dev  | 개발 환경     | 최소 비용, 디버깅 활성화  |
| `test` | HanbitTodoStack-Test | 테스트 환경   | QA 테스트, 운영 환경 유사 |
| `prod` | HanbitTodoStack-Prod | 프로덕션 환경 | 고가용성, 보안 강화       |

### 환경별 주요 차이점

| 설정          | Dev       | Test      | Prod          |
| ------------- | --------- | --------- | ------------- |
| DynamoDB 용량 | 1 RCU/WCU | 2 RCU/WCU | 5 RCU/WCU     |
| Lambda 메모리 | 256MB     | 512MB     | 1024MB        |
| 백업          | 비활성화  | 활성화    | 활성화 + PITR |
| 로그 보존     | 7일       | 14일      | 30일          |
| 모니터링      | 기본      | 상세      | 상세 + 알림   |

## 🛠️ 사전 요구사항

### 필요한 도구

- Node.js 18 이상
- npm 또는 pnpm
- AWS CLI v2
- AWS CDK v2 (2.115.0 이상)

### AWS 설정

1. **AWS 자격증명 설정**

   ```bash
   aws configure
   ```

2. **CDK 부트스트랩** (최초 1회)

   ```bash
   cd apps/server/infrastructure
   npm run bootstrap
   ```

3. **권한 확인**
   - CloudFormation 스택 생성/수정/삭제
   - DynamoDB 테이블 관리
   - Lambda 함수 관리
   - API Gateway 관리
   - Secrets Manager/Parameter Store 접근
   - IAM 역할 생성

## 🚀 환경별 배포

### 개발 환경 배포

```bash
cd apps/server/infrastructure

# 변경사항 확인
npm run diff:dev

# 배포 실행
npm run deploy:dev

# 또는 스크립트 사용
./scripts/deploy.sh dev
```

### 테스트 환경 배포

```bash
# 테스트 포함 배포
./scripts/deploy.sh test

# 테스트 건너뛰기
./scripts/deploy.sh test --skip-tests
```

### 프로덕션 환경 배포

```bash
# 안전한 배포 (확인 포함)
./scripts/deploy.sh prod

# 강제 배포 (확인 생략)
./scripts/deploy.sh prod --force-approval

# Dry run (변경사항만 확인)
./scripts/deploy.sh prod --dry-run
```

### 배포 스크립트 옵션

| 옵션               | 설명                           |
| ------------------ | ------------------------------ |
| `--dry-run`        | 실제 배포 없이 변경사항만 확인 |
| `--force-approval` | 프로덕션 배포시 승인 없이 진행 |
| `--skip-build`     | 빌드 단계 건너뛰기             |
| `--skip-tests`     | 테스트 단계 건너뛰기           |

## 🔐 시크릿 관리

### 시크릿 목록 조회

```bash
# 개발 환경 시크릿 목록
./scripts/manage-secrets.sh list dev

# 모든 환경 시크릿 목록
./scripts/manage-secrets.sh list dev
./scripts/manage-secrets.sh list test
./scripts/manage-secrets.sh list prod
```

### 시크릿 값 조회

```bash
# JWT 시크릿 조회
./scripts/manage-secrets.sh get dev --secret-name jwt-secret

# 앱 설정 조회
./scripts/manage-secrets.sh get dev --parameter-name app-config
```

### 시크릿 값 설정

```bash
# API 키 설정
./scripts/manage-secrets.sh set prod \
  --secret-name api-keys \
  --secret-value '{"externalService": "your-api-key"}'

# 파라미터 설정
./scripts/manage-secrets.sh set prod \
  --parameter-name notification-settings \
  --parameter-value '{"slackWebhook": "https://hooks.slack.com/..."}'
```

### JWT 시크릿 로테이션

```bash
# 프로덕션 JWT 시크릿 로테이션
./scripts/manage-secrets.sh rotate prod
```

### 시크릿 유효성 검사

```bash
# 모든 필수 시크릿 확인
./scripts/manage-secrets.sh validate prod
```

## 📊 모니터링

### CloudWatch 대시보드

배포 완료 후 다음 URL에서 대시보드에 접근할 수 있습니다:

```
https://console.aws.amazon.com/cloudwatch/home?region=ap-northeast-2#dashboards:name=HanbitTodo-{Environment}
```

### 주요 메트릭

- **API Gateway**: 요청 수, 레이턴시, 에러율
- **Lambda**: 실행 시간, 에러 수, 콜드 스타트
- **DynamoDB**: 읽기/쓰기 용량 사용량, 에러 수
- **시스템**: CPU, 메모리 사용량

### 알림 설정

프로덕션 환경에서 알림을 받으려면:

1. 환경 변수 설정:

   ```bash
   export ALERT_EMAIL=your-email@example.com
   ```

2. 배포 실행:
   ```bash
   npm run deploy:prod
   ```

## 🔧 문제 해결

### 일반적인 문제

#### 1. 권한 부족 에러

**증상**: `AccessDenied` 또는 `UnauthorizedOperation` 에러

**해결방법**:

```bash
# 현재 사용자 확인
aws sts get-caller-identity

# 필요한 권한 확인
aws iam get-user
aws iam list-attached-user-policies --user-name {사용자명}
```

#### 2. CDK 부트스트랩 필요

**증상**: `Need to perform AWS CDK Bootstrap` 에러

**해결방법**:

```bash
cd apps/server/infrastructure
npm run bootstrap
```

#### 3. 스택 업데이트 실패

**증상**: CloudFormation 스택이 `UPDATE_ROLLBACK_COMPLETE` 상태

**해결방법**:

```bash
# 스택 상태 확인
aws cloudformation describe-stacks --stack-name HanbitTodoStack-Dev

# 롤백 후 재시도
npm run deploy:dev
```

#### 4. 시크릿 누락 에러

**증상**: Lambda 함수에서 시크릿을 찾을 수 없음

**해결방법**:

```bash
# 시크릿 존재 확인
./scripts/manage-secrets.sh validate dev

# 누락된 시크릿 생성
./scripts/manage-secrets.sh set dev --secret-name jwt-secret --secret-value "new-secret"
```

### 로그 확인

#### CloudWatch 로그

```bash
# Lambda 함수 로그 확인
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/HanbitTodoStack"

# 최근 로그 스트림 확인
aws logs describe-log-streams \
  --log-group-name "/aws/lambda/HanbitTodoStack-Dev-TodoCreateFunction" \
  --order-by LastEventTime --descending
```

#### CDK 디버그

```bash
# 상세 로그 출력
export CDK_DEBUG=true
npm run deploy:dev

# CloudFormation 템플릿 확인
npm run synth:dev
```

### 성능 최적화

#### Lambda 콜드 스타트 줄이기

1. **프로비저닝된 동시성 설정** (프로덕션 환경)
2. **메모리 크기 최적화**
3. **의존성 최소화**

#### DynamoDB 최적화

1. **적절한 RCU/WCU 설정**
2. **글로벌 보조 인덱스 최적화**
3. **핫 파티션 방지**

### 비용 최적화

#### 개발 환경 비용 절약

```bash
# 사용하지 않는 리소스 정리
npm run destroy:dev

# 필요할 때만 재배포
npm run deploy:dev
```

#### 모니터링 비용

- CloudWatch 메트릭 및 로그 보존 기간 조정
- 불필요한 알림 비활성화
- 상세 모니터링 선택적 적용

## 📚 추가 리소스

- [AWS CDK 공식 문서](https://docs.aws.amazon.com/cdk/)
- [AWS Lambda 모범 사례](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [DynamoDB 모범 사례](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)
- [API Gateway 모범 사례](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-basic-concept.html)

## 🆘 지원

문제가 발생하면 다음을 확인해주세요:

1. [문제 해결 섹션](#문제-해결) 참조
2. CloudWatch 로그 확인
3. AWS 콘솔에서 리소스 상태 확인
4. 개발팀에 문의

---

**참고**: 이 문서는 Hanbit TODO 앱 v1.0.0 기준으로 작성되었습니다. 버전 업그레이드 시 내용이 변경될 수 있습니다.
