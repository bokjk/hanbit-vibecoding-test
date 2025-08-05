# 📚 TODO 앱 개발 문서 - 문서 구조 가이드

> **참고**: 이 프로젝트는 pnpm workspace 기반 모노레포로 구성된 TODO 웹 애플리케이션입니다.  
> React + TypeScript (프론트엔드) + AWS 서버리스 (백엔드) 기술 스택을 사용합니다.

## 📋 문서 개요

이 폴더에는 TODO 앱 개발을 위한 모든 문서가 체계적으로 구성되어 있습니다. 각 문서는 프로젝트의 특정 영역과 개발 단계를 다룹니다.

## 🗂️ 문서 구조

### 📄 핵심 문서
- **[requirements.md](requirements.md)** - 프로젝트 요구사항 정의서
- **[design.md](design.md)** - 설계 문서 통합 인덱스
- **[checklist.md](checklist.md)** - 개발 작업 체크리스트 (요약)

### 📂 세부 문서 폴더

#### `/design` - 설계 문서
상세한 시스템 설계 및 아키텍처 문서:
- `01-overview.md` - 프로젝트 개요 및 기술 스택
- `02-architecture.md` - 시스템 아키텍처 설계
- `03-data-models.md` - 데이터 모델 및 타입 정의
- `04-components.md` - React 컴포넌트 구조
- `05-state-management.md` - 상태 관리 패턴
- `06-data-flow.md` - 데이터 플로우 설계
- `07-api-design.md` - REST API 설계 (2단계)
- `08-security.md` - 보안 설계
- `09-deployment.md` - 배포 전략
- `10-testing.md` - 테스트 전략

#### `/task` - 작업별 체크리스트
9단계로 구분된 개발 작업 체크리스트:
- `01-monorepo-setup.md` - 모노레포 초기 설정 ✅
- `02-shared-packages.md` - 공유 패키지 설정 ✅
- `03-core-logic.md` - 핵심 로직 TDD ✅
- `04-ui-development.md` - UI 개발 및 통합 ✅
- `05-backend-development.md` - 통합 백엔드 개발 🔄
- `06-frontend-backend-integration.md` - 프론트엔드-백엔드 연동
- `07-security-quality.md` - 보안 및 품질 강화
- `08-deployment-operations.md` - 배포 및 운영
- `09-final-validation.md` - 최종 검증 및 문서화

#### `/image` - 설계 다이어그램
시각적 설계 자료:
- `overall-architecture.svg` - 전체 아키텍처
- `architecture-evolution.svg` - 아키텍처 진화
- `component-structure.svg` - 컴포넌트 구조
- `desktop-layout.svg` - 데스크톱 레이아웃
- `mobile-layout.svg` - 모바일 레이아웃
- `todo-add-flow.svg` - TODO 추가 플로우

## 🚀 빠른 시작 가이드

### 1. 프로젝트 이해하기
1. [requirements.md](requirements.md) - 프로젝트 요구사항 파악
2. [design/01-overview.md](design/01-overview.md) - 기술 스택 및 전략 이해

### 2. 설계 문서 탐색
1. [design.md](design.md) - 설계 문서 인덱스에서 필요한 영역 선택
2. 각 설계 영역별 상세 문서 검토

### 3. 개발 진행 상황 확인
1. [checklist.md](checklist.md) - 전체 진행 상황 파악
2. [task/](task/) 폴더 - 현재 작업 단계의 세부 체크리스트 확인

## 📊 현재 프로젝트 상태

- **완료**: 1-4단계 (프론트엔드 MVP) ✅
- **진행 중**: 5단계 (통합 백엔드 개발) 🔄
- **계획**: 6-9단계 (연동, 보안, 배포, 검증) 📋

## 🎯 단계별 개발 전략

### 1단계: LocalStorage 기반 MVP
```
사용자 → 컴포넌트 → Context → Reducer → LocalStorage 서비스
```

### 2단계: 클라우드 API 연동
```
사용자 → 컴포넌트 → Context → Reducer → API 서비스 → 백엔드
```

## 🛠️ 기술 스택

- **프론트엔드**: React, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **백엔드**: AWS Lambda, DynamoDB, API Gateway, Cognito
- **도구**: pnpm workspace, CDK, Jest, Playwright

## 📝 문서 작성 규칙

- 모든 문서는 한국어로 작성
- 각 문서는 독립적으로 이해 가능하도록 구성
- 상호 참조를 통한 문서 간 연결성 확보
- 실행 가능한 체크리스트 형태로 작업 관리

---

> **📌 중요**: 개발 작업 전 반드시 해당 단계의 문서를 숙지하고, 작업 완료 후 체크리스트를 업데이트하세요.