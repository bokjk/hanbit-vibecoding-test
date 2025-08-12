# 🎭 Playwright E2E 테스트 가이드

TODO 앱의 End-to-End 테스트 환경과 사용법을 안내합니다.

## 📋 목차

- [테스트 환경 설정](#테스트-환경-설정)
- [테스트 실행](#테스트-실행)
- [테스트 구조](#테스트-구조)
- [페이지 오브젝트](#페이지-오브젝트)
- [CI/CD 통합](#cicd-통합)
- [문제 해결](#문제-해결)

## 🛠️ 테스트 환경 설정

### 사전 요구사항

```bash
# Node.js 18 이상
node --version

# npm 또는 yarn
npm --version
```

### 설치

```bash
# 종속성 설치
npm install

# Playwright 브라우저 설치
npx playwright install
```

## 🚀 테스트 실행

### 기본 실행 명령어

```bash
# 모든 E2E 테스트 실행
npm run test:e2e

# UI 모드로 실행 (권장)
npm run test:e2e:ui

# 헤드풀 모드로 실행 (브라우저 보기)
npm run test:e2e:headed

# 디버그 모드
npm run test:e2e:debug

# 성능 테스트만 실행
npm run test:performance

# 모바일 테스트만 실행
npm run test:mobile
```

### 특정 브라우저에서 실행

```bash
# Chrome에서만 실행
npx playwright test --project=chromium

# Firefox에서만 실행
npx playwright test --project=firefox

# Safari에서만 실행
npx playwright test --project=webkit
```

### 특정 테스트 파일 실행

```bash
# 특정 테스트 파일
npx playwright test todo-app.spec.ts

# 특정 테스트 케이스
npx playwright test --grep "새로운 할 일을 추가"
```

## 📁 테스트 구조

```
e2e/
├── fixtures/           # 테스트 데이터
│   └── test-data.ts   # 샘플 데이터 및 테스트 케이스
├── helpers/           # 헬퍼 함수
│   └── test-helpers.ts # 공통 유틸리티
├── page-objects/      # 페이지 오브젝트
│   └── todo-page.ts   # TODO 앱 페이지 추상화
├── todo-app.spec.ts   # 메인 E2E 테스트
├── performance.spec.ts # 성능 테스트
├── global-setup.ts    # 글로벌 설정
└── global-teardown.ts # 글로벌 정리
```

## 🎯 테스트 범위

### 핵심 기능 테스트

- ✅ 애플리케이션 로드 및 초기 상태
- ✅ 할 일 생성, 수정, 삭제
- ✅ 할 일 완료 상태 토글
- ✅ 필터링 (전체/진행중/완료)
- ✅ 정렬 (날짜/우선순위/제목)
- ✅ 검색 기능
- ✅ 통계 대시보드

### 반응형 및 접근성

- ✅ 모바일, 태블릿, 데스크톱 뷰포트
- ✅ 키보드 내비게이션
- ✅ 스크린 리더 호환성
- ✅ 포커스 관리

### 성능 테스트

- ✅ 페이지 로드 시간 (< 3초)
- ✅ 대량 데이터 렌더링 성능
- ✅ 검색 및 필터링 응답 시간
- ✅ 메모리 사용량 모니터링
- ✅ Core Web Vitals

### 데이터 지속성

- ✅ 로컬스토리지 연동
- ✅ 페이지 새로고침 후 데이터 유지
- ✅ 브라우저 재시작 후 복원

## 🔧 페이지 오브젝트 패턴

### TodoPage 클래스 사용법

```typescript
import { TodoPage } from "./page-objects/todo-page";

test("할 일 추가 테스트", async ({ page }) => {
  const todoPage = new TodoPage(page);

  await todoPage.goto();
  await todoPage.addTodo("새로운 할 일", "high");

  await expect(todoPage.getTodoItem("새로운 할 일")).toBeVisible();
});
```

### 주요 메서드

- `goto()`: 페이지로 이동
- `addTodo(title, priority)`: 할 일 추가
- `toggleTodo(title)`: 완료 상태 토글
- `editTodo(oldTitle, newTitle)`: 할 일 수정
- `deleteTodo(title)`: 할 일 삭제
- `search(query)`: 검색 실행
- `applyFilter(filterType)`: 필터 적용
- `expectStatsToEqual(stats)`: 통계 검증

## 📊 테스트 리포트

### HTML 리포트 보기

```bash
# 테스트 실행 후 리포트 열기
npm run test:e2e:report
```

### 리포트 내용

- 테스트 결과 요약
- 실패한 테스트의 스크린샷
- 테스트 실행 비디오
- 성능 메트릭
- 네트워크 요청 로그

## 🔄 CI/CD 통합

### GitHub Actions

`.github/workflows/e2e-tests.yml` 파일에서 설정됨:

- **트리거**: Push, PR, 스케줄 (매일 오전 2시)
- **매트릭스**: Chrome, Firefox, Safari
- **모바일 테스트**: iOS Safari, Android Chrome
- **성능 테스트**: Core Web Vitals 측정
- **아티팩트**: 테스트 리포트, 스크린샷, 비디오

### 로컬 CI 시뮬레이션

```bash
# CI 환경 변수 설정하여 실행
CI=true npm run test:e2e
```

## 🐛 문제 해결

### 일반적인 문제

#### 1. 브라우저 설치 오류

```bash
# 브라우저 재설치
npx playwright install --force
```

#### 2. 테스트 타임아웃

```bash
# 타임아웃 늘리기
npx playwright test --timeout=60000
```

#### 3. 헤드리스 모드에서 실패

```bash
# 헤드풀 모드로 실행하여 디버그
npm run test:e2e:headed
```

#### 4. 선택자 찾기 오류

```bash
# 디버그 모드로 단계별 실행
npm run test:e2e:debug
```

### 디버깅 팁

1. **스크린샷 활용**

   ```typescript
   await page.screenshot({ path: "debug.png" });
   ```

2. **콘솔 로그 확인**

   ```typescript
   page.on("console", (msg) => console.log(msg.text()));
   ```

3. **네트워크 모니터링**

   ```typescript
   page.on("response", (response) => {
     console.log("Response:", response.url(), response.status());
   });
   ```

4. **페이지 HTML 덤프**
   ```typescript
   console.log(await page.content());
   ```

## 📝 테스트 작성 가이드

### 좋은 테스트의 특징

- **독립적**: 다른 테스트에 의존하지 않음
- **반복 가능**: 여러 번 실행해도 같은 결과
- **빠름**: 불필요한 대기 시간 최소화
- **명확함**: 테스트 의도가 분명함

### 베스트 프랙티스

```typescript
test.describe("기능 그룹", () => {
  test.beforeEach(async ({ page }) => {
    // 공통 설정
    await page.goto("/");
  });

  test("구체적이고 명확한 테스트 이름", async ({ page }) => {
    // Given: 초기 상태 설정
    // When: 사용자 행동
    // Then: 결과 검증
  });
});
```

## 🔗 참고 자료

- [Playwright 공식 문서](https://playwright.dev/)
- [테스트 자동화 가이드](https://playwright.dev/docs/best-practices)
- [페이지 오브젝트 패턴](https://playwright.dev/docs/pom)
- [CI/CD 통합 가이드](https://playwright.dev/docs/ci)
