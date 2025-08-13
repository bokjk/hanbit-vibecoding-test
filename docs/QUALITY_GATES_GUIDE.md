# 🎯 품질 게이트 시스템 가이드

이 문서는 강화된 품질 게이트 시스템의 사용법과 구성에 대해 설명합니다.

## 📊 개요

품질 게이트 시스템은 다음과 같은 종합적인 품질 검사를 자동화합니다:

- **코드 품질**: ESLint, TypeScript, 포맷팅
- **테스트 커버리지**: 단위 테스트 및 통합 테스트 커버리지
- **성능 벤치마크**: Lighthouse, 번들 크기, API 응답 시간
- **보안 스캔**: SAST, DAST, 의존성 취약점, 시크릿 검사
- **접근성 테스트**: WCAG 2.1 AA 준수, axe-core, Pa11y
- **통합 대시보드**: 실시간 메트릭 및 트렌드 분석

## 🚀 빠른 시작

### 로컬에서 전체 품질 검사 실행

```bash
# 전체 품질 게이트 실행 (모든 검사 포함)
pnpm quality

# 빠른 검사 (테스트 제외)
pnpm quality:fast

# 개발 환경용 검사
pnpm quality:dev
```

### 개별 품질 검사 실행

```bash
# 성능 벤치마크만 실행
pnpm quality:performance

# 보안 스캔만 실행
pnpm quality:security

# 접근성 테스트만 실행
pnpm quality:accessibility

# 대시보드만 생성
pnpm quality:dashboard
```

## 📋 품질 임계값

### 기본 임계값

| 메트릭       | 임계값 | 가중치 |
| ------------ | ------ | ------ |
| **커버리지** | 85%    | 25%    |
| **성능**     | 90점   | 25%    |
| **보안**     | 85점   | 25%    |
| **접근성**   | 95%    | 15%    |
| **코드품질** | 80점   | 10%    |

### 세부 임계값

#### 커버리지

- Statements: 85%
- Branches: 80%
- Functions: 85%
- Lines: 85%

#### 성능

- Lighthouse 성능: 90점
- Lighthouse 접근성: 95점
- Lighthouse 모범사례: 90점
- Lighthouse SEO: 85점
- 번들 크기: < 500KB
- API 응답시간: < 200ms

#### 보안

- Critical 취약점: 0개
- High 취약점: 0개
- Medium 취약점: < 5개
- Low 취약점: < 10개
- 보안 헤더 점수: 80점 이상

#### 접근성

- WCAG 2.1 AA 준수율: 95%
- 키보드 네비게이션: 100%
- 색상 대비: 4.5:1 이상
- axe-core 위반: Critical(0), Serious(2), Moderate(5), Minor(10)

## 🛠️ 설정 커스터마이징

### quality-gates.config.js

프로젝트 루트의 `quality-gates.config.js`에서 임계값을 조정할 수 있습니다:

```javascript
export const qualityGates = {
  coverage: {
    global: {
      statements: 85,
      branches: 80,
      functions: 85,
      lines: 85,
    },
  },
  performance: {
    lighthouse: {
      performance: 90,
      accessibility: 95,
      bestPractices: 90,
      seo: 85,
    },
  },
  // ... 기타 설정
};
```

### 환경별 설정

```bash
# 개발 환경 (관대한 기준)
pnpm quality:dev

# 스테이징 환경 (프로덕션과 동일한 기준)
pnpm quality:staging

# 프로덕션 환경 (엄격한 기준)
pnpm quality:prod
```

## 📊 대시보드 사용법

품질 검사 완료 후 `./dashboard/index.html`에서 대시보드를 확인할 수 있습니다.

### 대시보드 기능

1. **전체 요약**: 종합 품질 점수 및 등급
2. **메트릭 카드**: 각 품질 영역별 상세 점수
3. **상세 탭**:
   - 개요: 레이더 차트로 전체 현황 파악
   - 커버리지: 코드 커버리지 상세 분석
   - 성능: Lighthouse 및 번들 분석 결과
   - 보안: 취약점 및 보안 헤더 현황
   - 접근성: WCAG 준수 및 접근성 검사 결과
   - 트렌드: 시간별 품질 메트릭 변화

### API 엔드포인트

대시보드는 다음 JSON API를 제공합니다:

- `/dashboard/api/metrics.json`: 전체 메트릭
- `/dashboard/api/summary.json`: 요약 정보
- `/dashboard/api/trends.json`: 트렌드 데이터

## 🔄 CI/CD 통합

### GitHub Actions

`.github/workflows/ci.yml`에서 품질 게이트가 자동으로 실행됩니다:

```yaml
name: 강화된 품질 게이트 CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]
# 품질 게이트 단계:
# 1. 환경 설정 및 캐싱
# 2. 코드 품질 검사 (ESLint, TypeScript, 포맷)
# 3. 빌드 검증
# 4. 단위 테스트 및 커버리지
# 5. 성능 테스트
# 6. 보안 스캔
# 7. 품질 게이트 최종 검증
```

### 품질 게이트 실패 시

CI가 실패하면 다음을 확인하세요:

1. **코드 품질**: ESLint 경고/오류 수정
2. **테스트**: 실패한 테스트 수정 및 커버리지 향상
3. **성능**: Lighthouse 점수 개선, 번들 크기 최적화
4. **보안**: 취약점 수정, 보안 헤더 설정
5. **접근성**: WCAG 기준 준수, 키보드 네비게이션 개선

## 📁 출력 파일

품질 검사 실행 후 다음 파일들이 생성됩니다:

```
quality-reports/
├── quality-suite-report.md          # 전체 요약 보고서
├── quality-suite-results.json       # JSON 결과 데이터
├── code-quality.json               # 코드 품질 결과
├── coverage-summary.json           # 커버리지 요약
├── performance-summary.json        # 성능 벤치마크 결과
├── security-summary.json           # 보안 스캔 결과
├── accessibility-summary.json      # 접근성 테스트 결과
└── ...

dashboard/
├── index.html                      # 대시보드 메인 페이지
├── dashboard.css                   # 대시보드 스타일
├── dashboard.js                    # 대시보드 JavaScript
├── api/
│   ├── metrics.json               # 전체 메트릭 API
│   ├── summary.json               # 요약 API
│   └── trends.json                # 트렌드 API
└── ...
```

## 🔧 문제 해결

### 일반적인 문제

#### 1. 성능 테스트 실패

```bash
# 개발 서버가 실행 중인지 확인
pnpm dev:client

# 다른 터미널에서 성능 테스트 실행
pnpm quality:performance --baseUrl http://localhost:4173
```

#### 2. 의존성 설치 문제

```bash
# 캐시 정리 후 재설치
pnpm store prune
pnpm install
```

#### 3. 브라우저 관련 오류

```bash
# Playwright 브라우저 재설치
npx playwright install --with-deps
```

### 디버깅

상세한 로그를 보려면 `--verbose` 플래그를 사용하세요:

```bash
pnpm quality --verbose
```

## 📚 추가 자료

- [품질 게이트 설정 파일](../quality-gates.config.js)
- [GitHub Actions 워크플로우](../.github/workflows/ci.yml)
- [성능 벤치마크 스크립트](../scripts/performance-benchmark.js)
- [보안 스캐너 스크립트](../scripts/security-scanner.js)
- [접근성 테스터 스크립트](../scripts/accessibility-tester.js)
- [품질 대시보드 생성기](../scripts/quality-dashboard.js)

## 🎯 결론

이 품질 게이트 시스템을 통해:

1. **자동화된 품질 검증**: 모든 커밋과 PR에서 자동 품질 검사
2. **종합적인 분석**: 코드 품질, 성능, 보안, 접근성을 통합 검사
3. **실시간 모니터링**: 대시보드를 통한 품질 메트릭 추적
4. **지속적인 개선**: 트렌드 분석으로 품질 변화 모니터링

이를 통해 높은 품질의 소프트웨어를 지속적으로 유지할 수 있습니다.
