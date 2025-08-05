# 2단계: 공유 패키지 설정

## 📋 작업 개요
`packages/types`와 `packages/ui`에 공유 타입 정의 및 UI 컴포넌트 설정

## ✅ 완료 상태: **완료됨**

## 📝 세부 체크리스트

-   [x] **2. 공유 패키지 설정**
    -   [x] `packages/types`에 `Todo`, `Priority` 등 공유 타입 정의
    -   [x] `client`와 `server`에서 `packages/types` 참조 설정
    -   [x] `packages/ui`에 `Button` 등 기본 UI 컴포넌트 추가
    -   [x] `client`에서 `packages/ui` 참조 설정
    -   [x] **(커밋: `feat: setup shared types and ui packages`)**

## 🎯 달성한 목표
- 프론트엔드와 백엔드 간 타입 안전성 확보
- shadcn/ui 기반 공통 UI 컴포넌트 라이브러리 구축
- workspace 패키지 간 의존성 관리 설정

## 📚 관련 문서
- [데이터 모델 설계](../design/03-data-models.md) - 공유 타입 인터페이스 명세
- [컴포넌트 설계](../design/04-components.md) - UI 컴포넌트 구조