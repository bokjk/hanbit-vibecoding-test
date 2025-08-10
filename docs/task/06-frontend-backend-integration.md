# 6단계: 프론트엔드-백엔드 연동 (2단계)

## 📋 작업 개요

LocalStorage 기반 1단계에서 클라우드 API 기반 2단계로 전환

## ✅ 완료 상태: **대기 중** (5단계 완료 후 진행 예정)

## 📝 세부 체크리스트

- [x] **6.1 API 클라이언트 구현** ✅ **완료**
  - [x] `TodoAPIClient` 클래스 구현
  - [x] 인증 서비스 통합 (`AuthService`)
  - [x] API 에러 처리 및 재시도 로직
  - [x] **(커밋: `feat: API 클라이언트 및 통합 스토리지 서비스 구현`)**

- [x] **6.2 상태 관리 확장** ✅ **완료**
  - [x] `AuthContext` 및 인증 상태 관리
  - [x] API 서비스와 localStorage 서비스 추상화 (통합 스토리지 서비스)
  - [x] 낙관적 업데이트 및 동기화 로직
  - [x] 커스텀 훅 구현 (`use-todo.ts`)
  - [x] 기존 컴포넌트 업데이트 (동기화 상태 UI 포함)
  - [x] **(커밋: `feat(client): 상태 관리 확장 및 통합 스토리지 서비스 구현`)**

- [x] **6.3 데이터 마이그레이션** ✅ **완료**
  - [x] localStorage 데이터를 클라우드로 마이그레이션 기능 (`DataMigrationService` 클래스 구현)
  - [x] 게스트 사용자 흐름 구현 (`MigrationDialog`, `AuthPrompt` 컴포넌트)
  - [x] 인증 사용자 등록/로그인 흐름 (`LoginForm`, `RegisterForm` 스켈레톤 구현)
  - [x] App 초기화 로직 수정 (AuthProvider 통합, 마이그레이션 자동 감지)
  - [x] 마이그레이션 상태 관리 훅 (`use-migration.ts`) 구현
  - [x] **(커밋: `feat(client): implement data migration and authentication flows`)**

## 🎯 목표

- 단계적 전환으로 하위호환성 유지
- 인증 기반 개인화된 TODO 관리
- 오프라인/온라인 동기화 구현
- 데이터 손실 없는 마이그레이션

## 📚 관련 문서

- [데이터 플로우](../design/06-data-flow.md) - 2단계 데이터 흐름
- [API 설계](../design/07-api-design.md) - API 클라이언트 구조
