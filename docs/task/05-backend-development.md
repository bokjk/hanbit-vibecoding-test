# 5단계: 통합 백엔드 개발 (Lambda + CDK, TDD)

## 📋 작업 개요

AWS 서버리스 아키텍처 기반 백엔드 구현 및 CDK 인프라 코드 구성

## ✅ 완료 상태: **거의 완료** (5.1-5.5 완료, 5.6 진행 예정)

## 📝 세부 체크리스트

- [x] **5.1 프로젝트 구조 설정**
  - [x] `apps/server` 디렉터리 생성
  - [x] `apps/server/infrastructure/` CDK 인프라 코드 구조
  - [x] `apps/server/lambda/` Lambda 함수 코드 구조
  - [x] 통합 `package.json` 및 빌드 설정
  - [x] **(커밋: `feat(backend): setup integrated backend project structure`)**

- [x] **5.2 데이터베이스 스택 (DynamoDB)**
  - [x] `DatabaseConstruct` CDK 구현
  - [x] Single Table Design 구조 설정 (PK/SK + GSI1/GSI2)
  - [x] TTL 설정 (게스트 데이터 7일 후 자동 삭제)
  - [x] GSI 설정 (GSI1: 상태/우선순위, GSI2: 제목 검색)
  - [x] 키 스키마 유틸리티 및 타입 정의 완료
  - [x] CloudWatch 메트릭 및 환경별 보안 설정
  - [x] **(커밋: `feat(backend): implement DynamoDB stack with single table design`)**

- [x] **5.3 인증 스택 (Cognito)**
  - [x] `AuthConstruct` CDK 구현
  - [x] Cognito User Pool 설정 (사용자 등록/로그인 관리)
  - [x] Identity Pool 설정 (게스트 사용자 지원)
  - [x] IAM 역할 및 정책 설정 (인증/게스트 사용자 권한 분리)
  - [x] 게스트 인증 Lambda 핸들러 구현
  - [x] JWT 토큰 검증 미들웨어 구현
  - [x] 토큰 검증 유틸리티 구현
  - [x] 메인 스택에 AuthConstruct 통합
  - [x] Lambda 구성에 인증 핸들러 추가
  - [x] API 타입에 인증 관련 타입 추가
  - [x] 의존성 추가 (jwks-rsa, cognito-identity SDK)
  - [x] ESLint 오류 수정 및 코드 품질 확인
  - [x] **(커밋: `feat(backend): implement Cognito authentication stack`)**

- [x] **5.4 Lambda 함수 개발 (TDD)**
  - [x] `TodoRepository` 인터페이스 및 테스트 작성
  - [x] `DynamoDBTodoRepository` 구현 및 테스트 (`repositories/todo-repository.ts`)
  - [x] Lambda 핸들러 함수들 TDD 구현:
    - [x] `list` 핸들러 (GET /todos - 필터링 및 페이지네이션)
    - [x] `create` 핸들러 (POST /todos - 인증 및 권한 검증)
    - [x] `update` 핸들러 (PUT /todos/{id} - 소유권 검증)
    - [x] `delete` 핸들러 (DELETE /todos/{id} - 소유권 검증)
    - [x] 기존 `guest-auth` 핸들러 유지
  - [x] 공유 로직 및 미들웨어 구현:
    - [x] 의존성 주입 컨테이너 (`utils/container.ts`)
    - [x] JWT 토큰 검증 미들웨어
    - [x] 에러 처리 및 로깅
  - [x] **(커밋: `feat(backend): implement Lambda functions with TDD`)**

- [x] **5.5 API 스택 (API Gateway)**
  - [x] `ApiConstruct` CDK 구현 완료
  - [x] REST API 엔드포인트 설정 (/todos, /auth, /health)
  - [x] Cognito Authorizer 통합 (인증된 사용자만 TODO API 접근)
  - [x] 환경별 CORS 설정 (개발/프로덕션 도메인 분리)
  - [x] 요청/응답 모델 정의 및 검증
  - [x] 표준화된 오류 응답 매핑 구현
  - [x] API Gateway 정책 및 throttling 설정
  - [x] Lambda 통합 설정 완료
  - [x] **(커밋: `feat(backend): implement comprehensive API Gateway stack with Cognito authorization`)**

- [ ] **5.6 모니터링 스택 (CloudWatch)**
  - [ ] `MonitoringStack` CDK 구현
  - [ ] Lambda 로그 및 메트릭 설정
  - [ ] X-Ray 트레이싱 설정
  - [ ] 대시보드 및 알람 설정
  - [ ] **(커밋: `feat(backend): implement monitoring and observability stack`)**

## 🎯 목표

- AWS 서버리스 아키텍처 완전 구현
- IaC(Infrastructure as Code) 방식 인프라 관리
- TDD 기반 견고한 Lambda 함수 개발
- 완전한 관찰가능성과 모니터링 구축

## 📚 관련 문서

- [API 설계](../design/07-api-design.md) - REST API 엔드포인트 설계
- [보안 설계](../design/08-security.md) - Cognito 인증/인가 구조
- [배포 전략](../design/09-deployment.md) - AWS CDK 인프라
