### TODO 앱 개발 작업 체크리스트 (모노레포)

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

-   [ ] **4. UI 개발 및 통합**
    -   [ ] `packages/ui`와 `Shadcn/ui`를 사용하여 `apps/client`의 컴포넌트 구현
    -   [ ] `TodoContainer`에서 모든 컴포넌트 조립 및 기능 연동
    -   [ ] **(커밋: `feat(client): implement UI and integrate features`)**

-   [ ] **5. 백엔드 개발 (TDD)**
    -   [ ] `apps/server`에 Lambda 함수 핸들러 테스트 작성
    -   [ ] 테스트를 통과하는 Todo CRUD 로직 구현
    -   [ ] **(커밋: `feat(server): implement serverless backend for todos`)**

-   [ ] **6. API 연동 및 배포**
    -   [ ] `apps/client`에 `APIRepository` 구현 및 연동
    -   [ ] AWS CDK를 사용하여 `apps/server` 배포 스크립트 작성
    -   [ ] GitHub Actions를 이용한 CI/CD 파이프라인 구축 (프론트/백엔드 분리 배포)
    -   [ ] **(커밋: `chore: setup CI/CD and deploy to AWS`)**