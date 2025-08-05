# 5단계: 통합 백엔드 개발 (Lambda + CDK, TDD)

## 📋 작업 개요
AWS 서버리스 아키텍처 기반 백엔드 구현 및 CDK 인프라 코드 구성

## ✅ 완료 상태: **진행 중** (5.1 완료, 5.2-5.6 진행 예정)

## 📝 세부 체크리스트

-   [x] **5.1 프로젝트 구조 설정**
    -   [x] `apps/server` 디렉터리 생성
    -   [x] `apps/server/infrastructure/` CDK 인프라 코드 구조
    -   [x] `apps/server/lambda/` Lambda 함수 코드 구조
    -   [x] 통합 `package.json` 및 빌드 설정
    -   [x] **(커밋: `feat(backend): setup integrated backend project structure`)**

-   [ ] **5.2 데이터베이스 스택 (DynamoDB)**
    -   [ ] `DatabaseStack` CDK 구현
    -   [ ] Single Table Design 구조 설정
    -   [ ] TTL 설정 (게스트 데이터용)
    -   [ ] GSI 설정 (정렬 및 쿼리 최적화)
    -   [ ] **(커밋: `feat(backend): implement DynamoDB stack with single table design`)**

-   [ ] **5.3 인증 스택 (Cognito)**
    -   [ ] `AuthStack` CDK 구현
    -   [ ] Cognito User Pool 설정
    -   [ ] Identity Pool 설정 (게스트 지원)
    -   [ ] IAM 역할 및 정책 설정
    -   [ ] **(커밋: `feat(backend): implement Cognito authentication stack`)**

-   [ ] **5.4 Lambda 함수 개발 (TDD)**
    -   [ ] `TodoRepository` 인터페이스 및 테스트 작성
    -   [ ] `DynamoDBTodoRepository` 구현 및 테스트
    -   [ ] Lambda 핸들러 함수들 TDD 구현:
        -   [ ] `get-todos` 핸들러
        -   [ ] `create-todo` 핸들러
        -   [ ] `update-todo` 핸들러
        -   [ ] `delete-todo` 핸들러
        -   [ ] `guest-auth` 핸들러
        -   [ ] `migrate` 핸들러
    -   [ ] 공유 로직 및 미들웨어 구현
    -   [ ] **(커밋: `feat(backend): implement Lambda functions with TDD`)**

-   [ ] **5.5 API 스택 (API Gateway)**
    -   [ ] `ApiStack` CDK 구현
    -   [ ] REST API 엔드포인트 설정
    -   [ ] Cognito Authorizer 통합
    -   [ ] CORS 설정
    -   [ ] Lambda 통합 설정
    -   [ ] **(커밋: `feat(backend): implement API Gateway stack`)**

-   [ ] **5.6 모니터링 스택 (CloudWatch)**
    -   [ ] `MonitoringStack` CDK 구현
    -   [ ] Lambda 로그 및 메트릭 설정
    -   [ ] X-Ray 트레이싱 설정
    -   [ ] 대시보드 및 알람 설정
    -   [ ] **(커밋: `feat(backend): implement monitoring and observability stack`)**

## 🎯 목표
- AWS 서버리스 아키텍처 완전 구현
- IaC(Infrastructure as Code) 방식 인프라 관리
- TDD 기반 견고한 Lambda 함수 개발
- 완전한 관찰가능성과 모니터링 구축

## 📚 관련 문서
- [API 설계](../design/07-api-design.md) - REST API 엔드포인트 설계
- [보안 설계](../design/08-security.md) - Cognito 인증/인가 구조
- [배포 전략](../design/09-deployment.md) - AWS CDK 인프라