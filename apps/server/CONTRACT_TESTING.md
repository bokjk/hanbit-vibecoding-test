# 📋 Contract Testing 가이드

TODO 앱의 API Contract Testing은 프론트엔드와 백엔드 간의 API 계약을 보장하는 테스트 시스템입니다.

## 🎯 목적

- **API 스키마 일치성 검증**: OpenAPI 스키마와 실제 구현의 일치성 확인
- **요청/응답 형식 검증**: 모든 API 엔드포인트의 데이터 형식 검증
- **에러 처리 일관성**: 표준화된 에러 응답 형식 검증
- **보안 정책 준수**: CORS, 인증, Rate Limiting 등 보안 정책 검증
- **HTTP 표준 준수**: 적절한 상태 코드와 헤더 사용 검증

## 🏗️ 테스트 구조

```
apps/server/
├── openapi/
│   └── api-schema.yaml          # OpenAPI 3.0 스키마 정의
├── lambda/__tests__/contract/
│   ├── setup.ts                 # Contract 테스트 환경 설정
│   ├── todos.contract.test.ts   # TODO API Contract 테스트
│   ├── auth.contract.test.ts    # 인증 API Contract 테스트
│   ├── error-responses.contract.test.ts  # 에러 응답 검증 테스트
│   └── utils/
│       ├── contract-environment.ts      # 테스트 환경 관리
│       └── contract-helpers.ts          # 테스트 헬퍼 함수
├── scripts/
│   └── run-contract-tests.js    # Contract 테스트 실행 스크립트
└── vitest.contract.config.ts    # Contract 테스트 전용 설정
```

## 🚀 사용법

### 1. Contract 테스트 실행

```bash
# 기본 실행
pnpm test:contract

# Watch 모드 실행
pnpm test:contract:watch

# 상세한 실행 및 분석
node scripts/run-contract-tests.js
```

### 2. OpenAPI 스키마 검증

```bash
# 스키마 문법 검증
npx swagger-parser validate openapi/api-schema.yaml
```

### 3. CI/CD 파이프라인에서 실행

GitHub Actions에서 자동으로 실행됩니다:

```yaml
- name: Contract 테스트 실행
  run: |
    cd apps/server
    pnpm test:contract --reporter=verbose --reporter=json --outputFile=contract-test-results.json
```

## 📊 테스트 범위

### TODO API 검증

- **POST /todos**: 할일 생성 API
  - ✅ 유효한 요청 데이터 검증
  - ✅ 응답 스키마 일치성 검증
  - ✅ 입력 검증 에러 처리 (400)
  - ✅ 인증 에러 처리 (401)
  - ✅ CORS 헤더 검증

- **GET /todos**: 할일 목록 조회 API
  - ✅ 쿼리 파라미터 검증 (status, priority, limit, cursor)
  - ✅ 응답 데이터 구조 검증
  - ✅ 필터링 기능 검증
  - ✅ 페이징 정보 검증

- **PUT /todos/{id}**: 할일 업데이트 API
  - ✅ 경로 파라미터 검증 (ID 형식)
  - ✅ 부분 업데이트 데이터 검증
  - ✅ Not Found 에러 처리 (404)
  - ✅ 빈 업데이트 데이터 검증

- **DELETE /todos/{id}**: 할일 삭제 API
  - ✅ 삭제 성공 응답 (204)
  - ✅ 유효하지 않은 ID 처리
  - ✅ 존재하지 않는 리소스 처리

### 인증 API 검증

- **POST /auth/login**: 로그인 API
  - ✅ 유효한 인증 정보 검증
  - ✅ 잘못된 인증 정보 처리 (401)
  - ✅ 입력 검증 에러 처리 (400)
  - ✅ JWT 토큰 형식 검증

- **POST /auth/refresh**: 토큰 갱신 API
  - ✅ 리프레시 토큰 검증
  - ✅ 만료된 토큰 처리
  - ✅ 잘못된 토큰 형식 처리

- **GET /auth/me**: 사용자 정보 조회 API
  - ✅ 인증된 사용자 정보 반환
  - ✅ 인증 토큰 검증

### 보안 및 에러 처리 검증

- **HTTP 상태 코드 일관성**
  - ✅ 400 Bad Request: 입력 검증 실패
  - ✅ 401 Unauthorized: 인증 실패
  - ✅ 403 Forbidden: 권한 없음
  - ✅ 404 Not Found: 리소스 없음
  - ✅ 429 Too Many Requests: Rate Limit 초과
  - ✅ 500 Internal Server Error: 서버 오류

- **에러 응답 형식 표준화**
  - ✅ 일관된 에러 객체 구조
  - ✅ 민감한 정보 노출 방지
  - ✅ 타임스탬프 형식 (ISO 8601)

- **보안 헤더 검증**
  - ✅ CORS 헤더 설정
  - ✅ Content-Type 검증
  - ✅ Rate Limiting 헤더

- **입력 보안 검증**
  - ✅ SQL Injection 방지
  - ✅ XSS 공격 방지
  - ✅ 입력 크기 제한

## 🔧 설정 및 커스터마이징

### OpenAPI 스키마 업데이트

`openapi/api-schema.yaml` 파일을 수정한 후:

1. 스키마 문법 검증: `npx swagger-parser validate openapi/api-schema.yaml`
2. Contract 테스트 실행: `pnpm test:contract`
3. 실패한 테스트 확인 및 구현 수정

### 새로운 API 엔드포인트 추가

1. **OpenAPI 스키마에 엔드포인트 정의**:
   ```yaml
   /new-endpoint:
     post:
       summary: 새로운 엔드포인트
       requestBody:
         # 요청 스키마 정의
       responses:
         # 응답 스키마 정의
   ```

2. **Contract 테스트 작성**:
   ```typescript
   describe('POST /new-endpoint', () => {
     it('✅ 유효한 요청으로 성공해야 함', async () => {
       // Contract 테스트 구현
     });
   });
   ```

3. **Lambda 핸들러 구현**:
   ```typescript
   export const handler = async (event: APIGatewayProxyEvent) => {
     // 실제 구현
   };
   ```

### Contract 환경 설정

`lambda/__tests__/contract/setup.ts`에서 전역 설정:

```typescript
// Mock 서버 설정
await contractEnv.setupMockServer();

// 환경 변수 설정
process.env.NODE_ENV = 'test';
process.env.IS_CONTRACT_TEST = 'true';
```

## 📈 결과 해석

### 성공 기준

- **스키마 검증**: OpenAPI 스키마 문법 오류 없음
- **요청 검증**: 모든 요청이 스키마와 일치
- **응답 검증**: 모든 응답이 스키마와 일치
- **에러 처리**: 일관된 에러 응답 형식
- **보안 정책**: CORS, 인증, Rate Limiting 올바른 구현

### 실패 대응

1. **스키마 불일치**: OpenAPI 스키마와 구현 동기화
2. **응답 형식 오류**: 응답 데이터 구조 수정
3. **상태 코드 불일치**: 적절한 HTTP 상태 코드 사용
4. **보안 헤더 누락**: CORS, Rate Limit 헤더 추가
5. **입력 검증 실패**: Zod 스키마 및 검증 로직 수정

## 🔗 관련 파일

- **OpenAPI 스키마**: `openapi/api-schema.yaml`
- **Contract 테스트**: `lambda/__tests__/contract/*.test.ts`
- **테스트 환경**: `lambda/__tests__/contract/utils/*`
- **실행 스크립트**: `scripts/run-contract-tests.js`
- **CI/CD 설정**: `.github/workflows/ci.yml`

## 💡 모범 사례

1. **스키마 우선 개발**: OpenAPI 스키마를 먼저 정의하고 구현
2. **지속적인 검증**: 코드 변경 시마다 Contract 테스트 실행
3. **일관된 에러 처리**: 표준화된 에러 응답 형식 유지
4. **보안 고려**: 모든 API에 적절한 보안 검증 적용
5. **문서화**: API 변경 사항은 스키마와 테스트에 반영

Contract Testing을 통해 안정적이고 일관된 API를 보장하여 프론트엔드와 백엔드 간의 통합 오류를 사전에 방지할 수 있습니다.