# TODO 웹 앱 설계 문서 - 통합 인덱스

> **참고**: 이 문서는 각 설계 영역별로 분리된 상세 문서들의 인덱스입니다. 각 섹션을 클릭하여 자세한 내용을 확인하세요.

## 📚 문서 구조

### [1. 문서 개요](design/01-overview.md)

- 프로젝트 목적 및 범위
- 기술 스택 개요
- 단계별 개발 전략

### [2. 시스템 아키텍처](design/02-architecture.md)

- 전체 아키텍처 개요
- 1단계: MVP 아키텍처 (localStorage 기반)
- 2단계: AWS 서버리스 확장 아키텍처
- 단계별 아키텍처 진화

### [3. 데이터 모델 설계](design/03-data-models.md)

- Todo 엔티티 및 타입 정의
- 필터 및 정렬 모델
- 사용자 및 인증 모델 (2단계)
- 애플리케이션 상태 구조

### [4. 컴포넌트 설계](design/04-components.md)

- React 컴포넌트 계층 구조
- 주요 컴포넌트 명세
- 공통 컴포넌트 설계
- 성능 최적화 전략

### [5. 상태 관리 설계](design/05-state-management.md)

- React Context 구조
- useReducer Actions 정의
- 커스텀 훅 패턴
- Reducer 구현 상세

### [6. 데이터 플로우](design/06-data-flow.md)

- 1단계: localStorage 기반 플로우
- 2단계: API 통합 플로우
- 낙관적 업데이트 패턴
- 오프라인 동기화 전략

### [7. API 설계 (2단계)](design/07-api-design.md)

- REST API 엔드포인트 명세
- 인증 및 데이터 관리 API
- 에러 응답 표준화
- API 클라이언트 설계

### [8. 보안 설계](design/08-security.md)

- Amazon Cognito 인증/인가
- JWT 토큰 관리
- API 보안 및 접근 제어
- 데이터 보안 및 입력 검증

### [9. 배포 전략](design/09-deployment.md)

- 단계별 배포 전략
- AWS 서버리스 인프라 (Terraform)
- CI/CD 파이프라인
- 모니터링 및 로깅

### [10. 테스트 전략](design/10-testing.md)

- 단위 테스트 (TDD 백엔드)
- 컴포넌트 테스트 (React)
- 통합 테스트 및 E2E 테스트
- 성능 테스트 및 품질 보증

---

## 🎯 핵심 설계 원칙

### 단계적 개발 접근법

1. **1단계 (MVP)**: localStorage 기반 프론트엔드 전용
2. **2단계 (확장)**: AWS 서버리스 백엔드 통합

### 데이터 플로우 패턴

- **1단계**: 사용자 → 컴포넌트 → Context → Reducer → LocalStorage 서비스
- **2단계**: 사용자 → 컴포넌트 → Context → Reducer → API 서비스 → 백엔드

### 아키텍처 특징

- **모노레포 구조**: pnpm workspaces로 통합 관리
- **타입 안전성**: TypeScript strict 모드
- **컴포넌트 기반**: React + shadcn/ui
- **상태 관리**: Context + useReducer 패턴
- **서버리스**: AWS Lambda + DynamoDB

---

## 🚀 빠른 시작 가이드

### 1단계 개발 시작하기

```bash
# 의존성 설치
pnpm install

# 프론트엔드 개발 서버 시작
cd apps/client
pnpm dev
```

### 2단계 백엔드 배포하기

```bash
# 인프라 배포
cd infrastructure
terraform init
terraform apply

# 백엔드 배포
cd apps/server
pnpm deploy
```

---

## 📋 개발 체크리스트

### 필수 확인사항

- [ ] [요구사항 문서](../requirements.md) 검토
- [ ] [개발 원칙](.claude/development-principles.md) 숙지
- [ ] [TypeScript 규칙](.claude/typescript-rules.md) 준수
- [ ] [테스트 전략](.claude/testing-rules.md) 적용

### 품질 기준

- [ ] 테스트 커버리지 90% 이상 (백엔드)
- [ ] TypeScript strict 모드 적용
- [ ] ESLint/Prettier 규칙 준수
- [ ] 접근성 WCAG 2.1 AA 준수

---

## 🔗 관련 문서

- [요구사항 명세서](../requirements.md)
- [체크리스트](../checklist.md)
- [프로젝트 README](../../README.md)

---

_마지막 업데이트: 2024년 1월_
