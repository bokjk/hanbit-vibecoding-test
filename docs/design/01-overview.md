# 1. 문서 개요

## 1.1 목적

- TODO 웹 애플리케이션의 기술적 설계 명세
- 개발팀의 구현 가이드라인 제공
- 단계별 개발 전략에 따른 아키텍처 설계

## 1.2 범위

- 1단계: 프론트엔드 전용 MVP (localStorage 기반)
- 2단계: 백엔드 연동 확장 (AWS 서버리스)

## 1.3 기술 스택

- **모노레포 관리**: pnpm workspaces
- **프론트엔드**: React 18 + TypeScript + Tailwind CSS
- **UI Kit**: Shadcn/ui
- **빌드 도구**: Vite
- **상태 관리**: React Context + useReducer
- **테스트**: Jest + React Testing Library
- **배포**: GitHub Pages (1단계), AWS (2단계)

---

**참조**: [전체 설계 문서](../design.md)  
**다음**: [시스템 아키텍처](02-architecture.md)
