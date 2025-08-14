# TODO 웹 앱 요건정의서

## 1. 프로젝트 개요

### 1.1 프로젝트 목적

- 사용자가 할 일을 효율적으로 관리할 수 있는 웹 기반 TODO 애플리케이션 개발
- 간단하고 직관적인 사용자 인터페이스 제공
- 기본적인 CRUD(Create, Read, Update, Delete) 기능 구현

### 1.2 프로젝트 범위

- 웹 브라우저에서 동작하는 클라이언트 사이드 애플리케이션
- 로컬 스토리지를 활용한 데이터 저장 (초기 버전)

## 2. 기능 요구사항

### 2.1 핵심 기능

1. **할 일 추가**
   - 새로운 TODO 항목을 입력하고 추가할 수 있어야 함
   - 제목은 필수 입력 항목

2. **할 일 목록 조회**
   - 등록된 모든 TODO 항목을 목록으로 표시
   - 완료/미완료 상태를 시각적으로 구분

3. **할 일 상태 변경**
   - TODO 항목의 완료/미완료 상태를 토글할 수 있어야 함
   - 완료된 항목은 시각적으로 구분 (취소선, 색상 변경 등)

4. **할 일 삭제**
   - 불필요한 TODO 항목을 삭제할 수 있어야 함
   - 삭제 전 확인 메시지 표시

5. **할 일 수정**
   - 기존 TODO 항목의 내용을 수정할 수 있어야 함

### 2.2 부가 기능 (선택사항)

1. **필터링**
   - 전체/완료/미완료 항목별로 필터링
2. **우선순위**
   - TODO 항목에 우선순위 설정 (높음/보통/낮음)
3. **마감일**
   - TODO 항목에 마감일 설정

4. **검색**
   - TODO 항목 제목으로 검색 기능

## 3. 비기능 요구사항

### 3.1 사용자 인터페이스

- 반응형 디자인 (모바일, 태블릿, 데스크톱 지원)
- 직관적이고 사용하기 쉬운 UI/UX
- 접근성 고려 (키보드 네비게이션, 스크린 리더 지원)

### 3.2 성능

- 페이지 로딩 시간 3초 이내
- 사용자 액션에 대한 즉각적인 반응

### 3.3 호환성

- 최신 웹 브라우저 지원 (Chrome, Firefox, Safari, Edge)
- 모바일 브라우저 지원

### 3.4 데이터 저장

- DynamoDB
- 데이터 내보내기/가져오기 기능

## 4. 기술 스택 (제안)

### 모노레포

- pnpm workspaces

### 프론트엔드

- **프레임워크**: React.js
- **UI Kit**: Shadcn/ui
- **스타일링**: Tailwind CSS
- **빌드 도구**: Vite
- 상태관리 : React Context + useReducer
- 테스트 : Jest, React Testing Library

### 백엔드 + 인프라 (통합)

- **런타임**: Node.js 18.x (TypeScript)
- **아키텍처**: AWS 서버리스 (Lambda Functions)
- **IaC**: AWS CDK v2 (TypeScript) - Lambda 코드와 인프라 통합 관리
- **API**: REST API (OpenAPI 3.0 스펙)
- **API Gateway**: REST API + CORS 설정
- **컴퓨팅**: AWS Lambda (Node.js 18.x)
- **데이터베이스**: Amazon DynamoDB (Single Table Design)
- **인증**: Amazon Cognito User Pools + Identity Pools (게스트 사용자 지원)
- **모니터링**: CloudWatch Logs + X-Ray Tracing
- **개발 방법론**: TDD (Test-Driven Development)
- **배포**: CDK로 Lambda 코드와 인프라를 함께 배포

### 데이터 저장

- **초기 버전**: localStorage
- **향후 확장**: REST API + 데이터베이스

## 5. 요건 정의를 위한 질문들

### 5.1 기능 관련 질문

1. **우선순위가 가장 높은 핵심 기능은 무엇인가요?**
   - 상관없음

2. **사용자 인증이 필요한가요?**
   - 다중 사용자를 지원

3. **데이터 동기화가 필요한가요?**
   - 여러 기기 간 데이터 동기화가 필요한가요? 네
   - 오프라인 사용이 가능해야 하나요? 아니요

4. **할 일 항목의 구조는 어떻게 할까요?**
   - 제목, 우선순위, 상태

5. **할 일 분류 기능이 필요한가요?**
   - 필요없음

### 5.2 UI/UX 관련 질문

1. **디자인 스타일은 어떻게 할까요?**
   - 미니멀한 디자인

2. **주요 사용 환경은 어디인가요?**
   - 주로 모바일

3. **사용자 경험에서 중요한 요소는 무엇인가요?**
   - 시각적 피드백이 중요

### 5.3 기술 관련 질문

1. **선호하는 기술 스택이 있나요?**
   - React, Vue, Angular 중 선호하는 프레임워크가 있나요? React
   - TypeScript 사용을 원하시나요? 네

2. **배포 환경은 어떻게 할까요?**
   - AWS에 배포, 프론트앤드와 CI/CD는 Github Pages 와 Github Actions 사용

3. **개발 일정은 어떻게 되나요?**
   - MVP(Minimum Viable Product) 완성 목표 시기는 언제인가요? 빠르면좋음
   - 단계별 개발이 필요한가요? 네

### 5.4 확장성 관련 질문

1. **향후 확장 계획이 있나요?**
   - 팀 협업 기능이 필요할까요? 아니요
   - 알림 기능이 필요할까요? 아니요
   - 데이터 내보내기/가져오기 기능이 필요할까요? 네

2. **성능 요구사항이 있나요?**
   - 예상 사용자 수는? 5명
   - 대용량 데이터 처리가 필요한가요? 아니요

## 6. 개발 단계별 계획

### 6.1 1단계: 프론트엔드 전용 버전 (MVP)

- **목표**: 빠른 프로토타입 완성 및 사용자 피드백 수집
- **기술 스택**: React + TypeScript + localStorage
- **핵심 기능**:
  - TODO 추가, 조회, 수정, 삭제 (CRUD)
  - 완료/미완료 상태 토글
  - 우선순위 설정
  - 반응형 UI/UX
- **데이터 저장**: 브라우저 localStorage 활용
- **배포**: GitHub Pages를 통한 정적 사이트 배포

### 6.2 2단계: 백엔드 연동 버전

- **목표**: 다중 사용자 지원 및 데이터 동기화
- **기술 스택**:
  - 프론트엔드: 기존 React 앱 확장
  - 백엔드: AWS 서버리스 (API Gateway + Lambda + DynamoDB)
- **추가 기능**:
  - 게스트 사용자 인증 시스템 (Cognito)
  - 여러 기기 간 데이터 동기화
  - 데이터 내보내기/가져오기
  - 실시간 업데이트 (선택사항)
- **마이그레이션**: localStorage 데이터를 클라우드로 이전하는 기능 제공

## 7. 백엔드 아키텍처 요구사항 (2단계)

### 7.1 AWS 서버리스 아키텍처 설계

#### 7.1.1 전체 아키텍처

```
[Client] → [CloudFront] → [API Gateway] → [Lambda] → [DynamoDB]
    ↓                                                      ↑
[Cognito Identity Pool] ← [Cognito User Pool] ←──────────┘
```

#### 7.1.2 핵심 컴포넌트

1. **Amazon API Gateway**
   - REST API 엔드포인트 제공
   - CORS 설정으로 프론트엔드 통신 허용
   - Cognito Authorizer를 통한 인증 검증
   - Request/Response 변환 및 검증

2. **AWS Lambda Functions**
   - Node.js 18.x TypeScript 런타임
   - 각 API 엔드포인트별 개별 함수 구성
   - 환경 변수를 통한 설정 관리
   - CloudWatch 로그 및 X-Ray 트레이싱

3. **Amazon DynamoDB**
   - Single Table Design 패턴 적용
   - 파티션 키: `PK` (사용자 ID 기반)
   - 정렬 키: `SK` (TODO 항목 ID 또는 메타데이터)
   - GSI(Global Secondary Index) 활용한 쿼리 최적화

### 7.2 인증 시스템 (Amazon Cognito)

#### 7.2.1 게스트 사용자 지원 설계

학습용 프로젝트이므로 **로그인 없는 게스트 사용자**도 앱을 사용할 수 있도록 설계

1. **Cognito User Pool**
   - 선택적 사용자 등록/로그인
   - 이메일 기반 사용자 인증
   - MFA 비활성화 (학습용)

2. **Cognito Identity Pool**
   - **인증된 사용자**: 전체 CRUD 권한
   - **게스트 사용자**: 제한된 읽기 권한 + 임시 쓰기 권한
   - 디바이스별 익명 식별자 생성

#### 7.2.2 권한 모델

```typescript
// 게스트 사용자 권한
interface GuestPermissions {
  canRead: boolean; // true - 샘플 데이터 읽기
  canCreate: boolean; // true - 임시 TODO 생성 (세션 기반)
  canUpdate: boolean; // true - 세션 내 수정
  canDelete: boolean; // true - 세션 내 삭제
  persistData: boolean; // false - 영구 저장 불가
  maxItems: number; // 10 - 최대 항목 수 제한
}

// 인증된 사용자 권한
interface AuthenticatedPermissions {
  canRead: boolean; // true - 본인 데이터 읽기
  canCreate: boolean; // true - 무제한 생성
  canUpdate: boolean; // true - 본인 데이터 수정
  canDelete: boolean; // true - 본인 데이터 삭제
  persistData: boolean; // true - 영구 저장
  maxItems: number; // 1000 - 최대 항목 수
}
```

### 7.3 API 설계 (REST API)

#### 7.3.1 API 엔드포인트

```typescript
// 기본 CRUD 엔드포인트
GET    /api/todos           // TODO 목록 조회
POST   /api/todos           // 새 TODO 생성
GET    /api/todos/{id}      // 특정 TODO 조회
PUT    /api/todos/{id}      // TODO 수정
DELETE /api/todos/{id}      // TODO 삭제

// 인증 관련
POST   /api/auth/guest      // 게스트 토큰 발급
POST   /api/auth/refresh    // 토큰 갱신

// 데이터 관리
GET    /api/export          // 데이터 내보내기
POST   /api/import          // 데이터 가져오기
POST   /api/migrate         // localStorage 마이그레이션
```

#### 7.3.2 데이터 모델

```typescript
interface TodoItem {
  id: string; // UUID
  userId: string; // Cognito User ID 또는 게스트 세션 ID
  title: string; // TODO 제목
  description?: string; // 설명 (선택사항)
  priority: "low" | "medium" | "high";
  completed: boolean;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  isGuest: boolean; // 게스트 데이터 여부
  sessionId?: string; // 게스트 세션 ID
}

interface User {
  id: string; // Cognito User ID
  email?: string; // 인증된 사용자만
  isGuest: boolean;
  createdAt: string;
  lastLoginAt: string;
  settings: UserSettings;
}

interface UserSettings {
  theme: "light" | "dark";
  defaultPriority: Priority;
  autoSort: boolean;
}
```

### 7.4 데이터베이스 설계 (DynamoDB)

#### 7.4.1 Single Table Design

```typescript
// Primary Table: todos-app-data
interface DynamoDBItem {
  PK: string;                 // USER#{userId} 또는 GUEST#{sessionId}
  SK: string;                 // TODO#{todoId} 또는 META#settings
  GSI1PK?: string;           // 쿼리 최적화용
  GSI1SK?: string;           // 정렬 최적화용
  itemType: 'TODO' | 'USER' | 'SETTINGS';
  data: TodoItem | User | UserSettings;
  ttl?: number;              // 게스트 데이터 TTL (24시간)
}

// 예시 데이터
{
  PK: "USER#auth0|123456",
  SK: "TODO#uuid-1234",
  GSI1PK: "USER#auth0|123456",
  GSI1SK: "TODO#2024-01-15T10:00:00Z",
  itemType: "TODO",
  data: { /* TodoItem */ }
}

{
  PK: "GUEST#session-abcd",
  SK: "TODO#uuid-5678",
  itemType: "TODO",
  data: { /* TodoItem */ },
  ttl: 1642291200  // 24시간 후 자동 삭제
}
```

### 7.5 통합 백엔드 구조 (Lambda + CDK)

#### 7.5.1 통합 프로젝트 구조

```typescript
// 📁 apps/server/                   // 백엔드 + 인프라 통합 관리
// ├── infrastructure/               // CDK 인프라 코드
// │   ├── bin/
// │   │   └── app.ts               // CDK 앱 진입점
// │   ├── lib/
// │   │   ├── todo-app-stack.ts    // 메인 스택 (다른 스택들 조합)
// │   │   ├── auth-stack.ts        // Cognito 설정
// │   │   ├── api-stack.ts         // API Gateway + Lambda
// │   │   ├── database-stack.ts    // DynamoDB 설정
// │   │   └── monitoring-stack.ts  // CloudWatch 설정
// │   └── cdk.json                 // CDK 설정
// │
// ├── lambda/                      // Lambda 함수 코드
// │   ├── functions/
// │   │   ├── get-todos/
// │   │   │   ├── index.ts
// │   │   │   └── handler.test.ts
// │   │   ├── create-todo/
// │   │   │   ├── index.ts
// │   │   │   └── handler.test.ts
// │   │   ├── update-todo/
// │   │   ├── delete-todo/
// │   │   └── auth-handler/
// │   ├── shared/                  // 공유 로직
// │   │   ├── models/              // 데이터 모델
// │   │   ├── services/            // 비즈니스 로직
// │   │   ├── repositories/        // 데이터 접근 계층
// │   │   ├── middleware/          // Lambda 미들웨어
// │   │   └── utils/               // 유틸리티
// │   └── layers/                  // Lambda Layers (공통 의존성)
// │
// ├── package.json                 // 통합 의존성 관리
// ├── tsconfig.json                // TypeScript 설정
// ├── jest.config.js               // 테스트 설정
// ├── esbuild.config.js            // Lambda 빌드 설정
// └── README.md
```

#### 7.5.2 통합 개발의 장점

1. **개발 효율성**
   - 하나의 `package.json`으로 백엔드와 인프라 의존성 통합 관리
   - 한 번의 빌드 명령으로 Lambda 코드 컴파일 + CDK 배포
   - 로컬 개발환경 설정 간소화

2. **배포 편의성**

   ```bash
   # 하나의 명령으로 전체 백엔드 + 인프라 배포
   cd apps/server
   pnpm build && pnpm deploy

   # 또는 환경별 배포
   pnpm deploy:dev
   pnpm deploy:prod
   ```

3. **코드 일관성**
   - Lambda 함수와 CDK 스택이 같은 TypeScript 타입 공유
   - 인프라 변경 시 Lambda 코드 동시 수정 가능
   - 스택 간 참조 관리 용이

4. **버전 관리**
   - 백엔드 코드와 인프라 코드의 버전 동기화
   - 롤백 시 인프라와 코드 함께 롤백 가능

#### 7.5.3 CDK에서 Lambda 참조 방식

```typescript
// infrastructure/lib/api-stack.ts
export class ApiStack extends NestedStack {
  private createLambdaFunctions(props: ApiStackProps) {
    this.lambdaFunctions.getTodos = new Function(this, "GetTodosFunction", {
      runtime: Runtime.NODEJS_18_X,
      // 같은 프로젝트 내 Lambda 코드 참조
      code: Code.fromAsset("../lambda/dist/functions/get-todos"),
      handler: "index.handler",
      environment: {
        TABLE_NAME: props.table.tableName,
      },
    });
  }
}
```

#### 7.5.4 통합 빌드 스크립트

```json
{
  "scripts": {
    "build": "tsc && pnpm build:lambda",
    "build:lambda": "esbuild lambda/functions/*/index.ts --outdir=lambda/dist/functions --bundle --platform=node",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "deploy": "pnpm build && cdk deploy --all",
    "deploy:dev": "pnpm build && cdk deploy --all --context environment=dev",
    "deploy:prod": "pnpm build && cdk deploy --all --context environment=prod",
    "destroy": "cdk destroy --all",
    "synth": "cdk synth",
    "diff": "cdk diff"
  }
}
```

#### 7.5.2 환경별 배포

- **개발 환경** (`dev`): 단일 개발자용, 최소 리소스
- **테스트 환경** (`test`): CI/CD 파이프라인용, 자동 삭제
- **프로덕션 환경** (`prod`): 실제 사용자용, 백업 및 모니터링

### 7.6 CI/CD 파이프라인 (GitHub Actions)

#### 7.6.1 백엔드 배포 워크플로우

```yaml
# .github/workflows/backend-deploy.yml
name: Backend Deploy

on:
  push:
    branches: [main]
    paths: ['apps/server/**', 'infrastructure/**']
  pull_request:
    paths: ['apps/server/**', 'infrastructure/**']

jobs:
  test:
    - Unit Tests (Jest)
    - Integration Tests
    - Type Checking
    - Linting & Formatting

  deploy-dev:
    if: github.ref == 'refs/heads/main'
    - AWS CDK Deploy to dev environment
    - API smoke tests

  deploy-prod:
    if: github.event_name == 'release'
    - Manual approval required
    - AWS CDK Deploy to prod environment
    - Full integration tests
```

#### 7.6.2 보안 및 시크릿 관리

- **GitHub Secrets**: AWS 인증 정보
- **AWS Parameter Store**: 환경별 설정값
- **AWS Secrets Manager**: API 키 및 민감 정보

### 7.7 개발 방법론 (TDD)

#### 7.7.1 TDD 사이클 적용

```typescript
// 📁 apps/server/src/functions/
// ├── create-todo/
// │   ├── create-todo.test.ts      // ← 먼저 테스트 작성
// │   ├── create-todo.handler.ts   // ← 테스트 통과하는 최소 코드
// │   └── create-todo.integration.test.ts
```

#### 7.7.2 테스트 전략

1. **Unit Tests**: 개별 함수 로직 검증
2. **Integration Tests**: DynamoDB와의 연동 테스트
3. **E2E Tests**: API Gateway를 통한 전체 플로우 테스트
4. **Contract Tests**: 프론트엔드와 API 계약 검증

### 7.8 모니터링 및 로깅

#### 7.8.1 관찰 가능성(Observability)

- **CloudWatch Logs**: 구조화된 로그 수집
- **X-Ray Tracing**: 분산 추적을 통한 성능 모니터링
- **CloudWatch Metrics**: 비즈니스 메트릭 및 알람
- **CloudWatch Dashboards**: 실시간 모니터링 대시보드

#### 7.8.2 핵심 메트릭

```typescript
interface BusinessMetrics {
  totalTodos: number; // 전체 TODO 개수
  activeTodos: number; // 미완료 TODO 개수
  completionRate: number; // 완료율
  dailyActiveUsers: number; // 일일 활성 사용자
  guestUserRatio: number; // 게스트 사용자 비율
  apiLatencyP95: number; // API 응답시간 95 percentile
  errorRate: number; // 에러율
}
```

## 8. 다음 단계

1. **요구사항 확정**: 위 질문들에 대한 답변을 바탕으로 최종 요구사항 확정
2. **와이어프레임 작성**: UI/UX 설계
3. **기술 스택 결정**: 개발 환경 및 도구 선택
4. **1단계 개발 계획 수립**: 프론트엔드 MVP 스프린트 계획
5. **프로토타입 개발**: 핵심 기능 구현
6. **테스트 및 배포**: 1단계 품질 검증 및 GitHub Pages 배포
7. **2단계 준비**: 백엔드 아키텍처 설계 및 개발

---

**작성일**: 2025년 07월 15일  
**작성자**: 개발팀  
**버전**: 1.0
