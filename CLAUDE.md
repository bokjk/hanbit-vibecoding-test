# TODO 앱 모노레포 개발 규칙 - 진입점

당신은 React, TypeScript, Vite, Tailwind CSS, pnpm workspace 전문가입니다.

## 📁 규칙 참조 가이드

이 프로젝트의 모든 개발 규칙은 `.claude/` 폴더에 체계적으로 정리되어 있습니다:

### 📋 필수 규칙 파일들
- **@.claude/communication-rules.md**: 한국어 의사소통 원칙 및 명명 규칙
- **@.claude/development-principles.md**: SOLID, Clean Architecture, 코드 품질 원칙
- **@.claude/development-process.md**: Git 워크플로우, 단계적 개발 접근법

### 🛠️ 기술별 규칙 파일들
- **@.claude/typescript-rules.md**: TypeScript 타입 안전성, strict 설정, 고급 기능
- **@.claude/frontend-rules.md**: React 컴포넌트 패턴, 성능 최적화, 접근성
- **@.claude/backend-rules.md**: TDD, Lambda 패턴, 보안, Clean Architecture
- **@.claude/styling-rules.md**: Tailwind CSS, shadcn/ui, 반응형 디자인
- **@.claude/testing-rules.md**: TDD (백엔드), 구현 우선 (프론트엔드), 테스트 전략

## 🏗️ 프로젝트 구조
이 프로젝트는 pnpm workspace로 관리되는 모노레포입니다:
- `apps/client`: React + TypeScript + Vite 프론트엔드
- `apps/server`: Node.js + TypeScript 백엔드 (AWS Lambda)
- `packages/types`: 공유 TypeScript 타입
- `packages/ui`: 공유 UI 컴포넌트 (shadcn/ui)

## 🎯 데이터 플로우 패턴
- **1단계** (localStorage): 사용자 → 컴포넌트 → Context → Reducer → LocalStorage 서비스
- **2단계** (API): 사용자 → 컴포넌트 → Context → Reducer → API 서비스 → 백엔드

## 🚨 절대 금지 사항
- 🚨 **요구사항 이해 없는 구현 금지**
- 🚨 **백엔드 코드 테스트 없는 구현 금지** (TDD 필수)
- 🚨 **checklist.md 업데이트 없는 커밋 금지**
- 🚨 **정당화 없는 커스텀 CSS 사용 금지** (Tailwind 사용)
- 🚨 **TypeScript에서 any 타입 사용 금지**
- 🚨 **모든 커뮤니케이션은 반드시 한국어로**

## 📚 작업 시작 전 필수 확인사항
1. **문서 우선**: `requirements.md`와 `design.md` 확인
2. **관련 규칙 파일**: 해당 기술/영역의 `.claude/` 규칙 파일 확인
3. **체크리스트**: 작업 완료 후 `docs/checklist.md` 업데이트

기억하세요: 이 프로젝트는 단계적 개발 접근법을 따릅니다 (localStorage 먼저, 그 다음 API 통합). 기능을 점진적으로 구축하고 하위 호환성을 유지하세요.