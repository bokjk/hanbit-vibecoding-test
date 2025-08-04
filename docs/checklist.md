# TODO 앱 개발 작업 체크리스트 (모노레포)

## 📋 개발 진행 상황 요약
- **완료**: 1-4단계 (프론트엔드 MVP)
- **진행 중**: 5단계 (통합 백엔드 개발)
- **계획**: 6-9단계 (연동, 보안, 배포, 검증)

---

## 🏗️ 단계별 체크리스트

-   [x] **1. 모노레포 초기 설정**
    -   [x] `pnpm` 설치 및 `pnpm init`
    -   [x] `pnpm-workspace.yaml` 파일 생성 및 `apps/*`, `packages/*` 설정
    -   [x] `apps/client` 디렉터리에 Vite + React + TS 프로젝트 생성
    -   [x] `apps/server` 디렉터리에 Node.js + TS 프로젝트 설정
    -   [x] `packages/types` 디렉터리 생성 및 `tsconfig.json` 설정
    -   [x] `packages/ui` 디렉터리 생성 및 `Shadcn/ui` 초기화
    -   [x] **(커밋: `feat: setup pnpm monorepo with client, server, and packages`)**

-   [x] **2. 공유 패키지 설정**
    -   [x] `packages/types`에 `Todo`, `Priority` 등 공유 타입 정의
    -   [x] `client`와 `server`에서 `packages/types` 참조 설정
    -   [x] `packages/ui`에 `Button` 등 기본 UI 컴포넌트 추가
    -   [x] `client`에서 `packages/ui` 참조 설정
    -   [x] **(커밋: `feat: setup shared types and ui packages`)**

-   [ ] **3. 핵심 로직 (TDD)**
    -   [x] **LocalStorage 서비스 (TDD)**
        -   [x] `apps/client/src/services/localStorage.service.test.ts` 테스트 작성
        -   [x] 테스트를 통과하는 `LocalStorageService` 클래스 구현
        -   [x] **(커밋: `feat(client): implement localStorage service with TDD`)**
    -   [x] **상태 관리 로직 (TDD)**
        -   [x] `apps/client/src/contexts/todo.reducer.test.ts` 테스트 작성
        -   [x] 테스트를 통과하는 `todoReducer` 구현
        -   [x] `TodoContext` 및 `TodoProvider` 설정
        -   [x] **(커밋: `feat(client): 상태 관리 로직 TDD 구현`)**

-   [x] **4. UI 개발 및 통합**
    -   [x] `packages/ui`와 `Shadcn/ui`를 사용하여 `apps/client`의 컴포넌트 구현
    -   [x] `TodoContainer`에서 모든 컴포넌트 조립 및 기능 연동
    -   [x] **(커밋: `feat(client): implement UI and integrate features`)**
    -   [x] **버그 수정 및 안정화**
        -   [x] TypeScript 모듈 import 에러 해결 (type import 사용)
        -   [x] LocalStorageService에 getTodos, saveTodos 메서드 추가
        -   [x] ADD_TODO 액션에서 고유 ID 자동 생성으로 React key prop 경고 해결
        -   [x] types 패키지 exports 설정 수정
        -   [x] **(커밋: `fix: 타입스크립트 모듈 import 에러 및 LocalStorage 서비스 수정`)**

-   [ ] **5. 통합 백엔드 개발 (Lambda + CDK, TDD)**
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

-   [ ] **6. 프론트엔드-백엔드 연동 (2단계)**
    -   [ ] **6.1 API 클라이언트 구현**
        -   [ ] `TodoAPIClient` 클래스 구현
        -   [ ] 인증 서비스 통합 (`AuthService`)
        -   [ ] API 에러 처리 및 재시도 로직
        -   [ ] **(커밋: `feat(client): implement API client with authentication`)**
    
    -   [ ] **6.2 상태 관리 확장**
        -   [ ] `AuthContext` 및 인증 상태 관리
        -   [ ] API 서비스와 localStorage 서비스 추상화
        -   [ ] 낙관적 업데이트 및 동기화 로직
        -   [ ] **(커밋: `feat(client): extend state management for API integration`)**
    
    -   [ ] **6.3 데이터 마이그레이션**
        -   [ ] localStorage 데이터를 클라우드로 마이그레이션 기능
        -   [ ] 게스트 사용자 흐름 구현
        -   [ ] 인증 사용자 등록/로그인 흐름
        -   [ ] **(커밋: `feat(client): implement data migration and authentication flows`)**

-   [ ] **7. 보안 및 품질 강화**
    -   [ ] **7.1 보안 구현**
        -   [ ] 입력 검증 및 XSS 방지
        -   [ ] Rate Limiting 구현
        -   [ ] CORS 정책 설정
        -   [ ] CSP (Content Security Policy) 설정
        -   [ ] **(커밋: `feat(security): implement comprehensive security measures`)**
    
    -   [ ] **7.2 테스트 커버리지 확장**
        -   [ ] 통합 테스트 (DynamoDB 연동)
        -   [ ] Contract 테스트 (API 스펙 검증)
        -   [ ] E2E 테스트 (Playwright)
        -   [ ] 성능 테스트
        -   [ ] **(커밋: `test: implement comprehensive test coverage`)**
    
    -   [ ] **7.3 에러 처리 및 모니터링**
        -   [ ] 구조화된 로깅 시스템
        -   [ ] 에러 추적 및 알림
        -   [ ] 성능 모니터링 대시보드
        -   [ ] **(커밋: `feat(monitoring): implement error tracking and monitoring`)**

-   [ ] **8. 배포 및 운영**
    -   [ ] **8.1 환경별 배포 설정**
        -   [ ] 개발(dev), 테스트(test), 프로덕션(prod) 환경 구성
        -   [ ] 환경별 CDK 설정 및 배포 스크립트
        -   [ ] 시크릿 관리 (AWS Parameter Store/Secrets Manager)
        -   [ ] **(커밋: `feat(deploy): setup environment-specific deployment`)**
    
    -   [ ] **8.2 CI/CD 파이프라인**
        -   [ ] GitHub Actions 백엔드 배포 워크플로우
        -   [ ] 프론트엔드 GitHub Pages 배포
        -   [ ] 자동화된 테스트 및 품질 검사
        -   [ ] 롤백 전략 구현
        -   [ ] **(커밋: `chore: implement comprehensive CI/CD pipeline`)**
    
    -   [ ] **8.3 성능 최적화**
        -   [ ] Lambda 콜드 스타트 최적화
        -   [ ] DynamoDB 쿼리 최적화
        -   [ ] 프론트엔드 번들 최적화
        -   [ ] CDN 및 캐싱 전략
        -   [ ] **(커밋: `perf: implement performance optimizations`)**

-   [ ] **9. 최종 검증 및 문서화**
    -   [ ] **9.1 사용자 수용 테스트**
        -   [ ] 핵심 사용자 시나리오 테스트
        -   [ ] 접근성 검증 (WCAG 2.1 AA)
        -   [ ] 크로스 브라우저 테스트
        -   [ ] 모바일 반응형 테스트
        -   [ ] **(커밋: `test: complete user acceptance testing`)**
    
    -   [ ] **9.2 문서화 완성**
        -   [ ] API 문서 (OpenAPI 3.0)
        -   [ ] 사용자 가이드
        -   [ ] 개발자 문서
        -   [ ] 운영 매뉴얼
        -   [ ] **(커밋: `docs: complete comprehensive documentation`)**
    
    -   [ ] **9.3 프로덕션 배포**
        -   [ ] 프로덕션 환경 최종 검증
        -   [ ] 도메인 설정 및 SSL 인증서
        -   [ ] 모니터링 및 알람 설정 확인
        -   [ ] 백업 및 재해 복구 계획
        -   [ ] **(커밋: `chore: production deployment and final setup`)**
