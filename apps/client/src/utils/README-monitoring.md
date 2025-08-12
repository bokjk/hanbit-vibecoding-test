# 프론트엔드 성능 모니터링 및 에러 리포팅 시스템

## 개요

이 모니터링 시스템은 React 애플리케이션의 성능 메트릭을 수집하고, 에러를 추적하며, 사용자 상호작용을 분석하여 애플리케이션의 품질과 성능을 개선하는 데 도움을 줍니다.

## 주요 기능

### 🎯 성능 모니터링 (`performance-monitor.ts`)

- **Core Web Vitals**: LCP, FID, CLS, TTFB, FCP, INP 자동 수집
- **사용자 상호작용**: 클릭, 스크롤, 네비게이션, 폼 제출 추적
- **메모리 사용량**: JavaScript 힙 메모리 모니터링
- **네트워크 요청**: Fetch/XHR API 호출 성능 추적

### 🚨 에러 리포팅 (`error-reporter.ts`)

- **JavaScript 에러**: 전역 에러 핸들러로 자동 수집
- **리소스 로딩 실패**: 이미지, 스크립트, 스타일시트 로딩 에러
- **API 요청 에러**: HTTP 에러 상태 코드 및 네트워크 실패
- **Unhandled Promise Rejection**: 처리되지 않은 Promise 거부
- **Console 에러**: console.error 호출 감지

### 📊 Analytics 서비스 (`analytics.service.ts`)

- **Beacon API**: 페이지 언로드 시에도 안정적인 데이터 전송
- **배치 처리**: 효율적인 데이터 전송을 위한 이벤트 배치
- **재시도 메커니즘**: 네트워크 실패 시 자동 재시도
- **오프라인 지원**: 네트워크 복구 시 데이터 전송
- **큐 영속성**: localStorage를 통한 데이터 보존

### 🔗 React 통합 (`use-monitoring.ts`)

- **생명주기 관리**: React 컴포넌트와 연동된 모니터링
- **Error Boundary**: React 에러 자동 리포팅
- **API 모니터링**: 헬퍼 훅으로 API 성능 추적
- **환경변수 제어**: 프로덕션/개발 환경별 설정

## 사용 방법

### 1. 기본 설정

환경변수로 모니터링 활성화:

```bash
# .env.development
VITE_ENABLE_MONITORING=true
VITE_ENABLE_ERROR_REPORTING=true
VITE_ENABLE_ANALYTICS=true
VITE_DEBUG=true

# .env.production
VITE_ENABLE_MONITORING=true
VITE_ENABLE_ERROR_REPORTING=true
VITE_ENABLE_ANALYTICS=true
VITE_DEBUG=false
```

### 2. React 컴포넌트에서 사용

```tsx
import { useMonitoring } from "../hooks/use-monitoring";

function MyComponent() {
  const { trackUserInteraction, trackCustomMetric, reportApiError } =
    useMonitoring();

  const handleClick = () => {
    trackUserInteraction("button", "click", "my-component");
  };

  const handleApiCall = async () => {
    const startTime = performance.now();
    try {
      const response = await fetch("/api/data");
      if (!response.ok) {
        reportApiError(
          "/api/data",
          "GET",
          response.status,
          response.statusText,
          performance.now() - startTime,
        );
      }
    } catch (error) {
      reportApiError(
        "/api/data",
        "GET",
        0,
        error.message,
        performance.now() - startTime,
      );
    }
  };

  return <button onClick={handleClick}>Click me</button>;
}
```

### 3. Error Boundary와 연동

```tsx
import { ErrorBoundary } from "../components/ErrorBoundary";

function App() {
  return (
    <ErrorBoundary>
      <MyApp />
    </ErrorBoundary>
  );
}
```

### 4. API 모니터링 헬퍼 사용

```tsx
import { useApiMonitoring } from "../hooks/use-monitoring";

function useApiCall() {
  const { trackRequest } = useApiMonitoring();

  const apiCall = async (url: string) => {
    const startTime = performance.now();

    try {
      const response = await fetch(url);
      trackRequest(url, "GET", startTime, response);
      return response;
    } catch (error) {
      trackRequest(url, "GET", startTime, undefined, error);
      throw error;
    }
  };

  return { apiCall };
}
```

## 설정 옵션

### Performance Monitor

```typescript
const performanceConfig = {
  trackWebVitals: true, // Core Web Vitals 추적
  trackUserInteractions: true, // 사용자 상호작용 추적
  trackMemoryUsage: true, // 메모리 사용량 모니터링
  trackNetworkRequests: true, // 네트워크 요청 추적
};
```

### Error Reporter

```typescript
const errorConfig = {
  trackJavaScriptErrors: true, // JS 에러 추적
  trackResourceErrors: true, // 리소스 로딩 실패 추적
  trackApiErrors: true, // API 에러 추적
  trackUnhandledRejections: true, // Promise rejection 추적
  maxErrorsPerSession: 100, // 세션당 최대 에러 수
};
```

### Analytics Service

```typescript
const analyticsConfig = {
  batchSize: 20, // 배치 크기
  flushInterval: 10000, // 플러시 간격 (ms)
  maxRetries: 3, // 최대 재시도 횟수
  retryDelay: 1000, // 재시도 지연 (ms)
  enableCompression: true, // 데이터 압축
  enableQueuePersistence: true, // 큐 영속성
  maxQueueSize: 1000, // 최대 큐 크기
};
```

## 데이터 구조

### Performance Metric

```typescript
interface PerformanceMetric {
  name: string; // 메트릭 이름 (LCP, FID, CLS 등)
  value: number; // 메트릭 값
  timestamp: number; // 타임스탬프
  url: string; // 현재 페이지 URL
  userAgent: string; // 브라우저 정보
  sessionId: string; // 세션 ID
  metadata?: object; // 추가 메타데이터
}
```

### Error Report

```typescript
interface ErrorReport {
  id: string; // 에러 ID
  type: "javascript" | "resource" | "api"; // 에러 타입
  message: string; // 에러 메시지
  stack?: string; // 스택 트레이스
  url: string; // 발생 위치 URL
  timestamp: number; // 발생 시간
  severity: "low" | "medium" | "high" | "critical"; // 심각도
  context: ErrorContext; // 에러 발생 컨텍스트
}
```

### Analytics Event

```typescript
interface AnalyticsEvent {
  id: string; // 이벤트 ID
  type: "performance" | "error" | "user_interaction"; // 이벤트 타입
  category: string; // 카테고리
  action: string; // 액션
  label?: string; // 라벨
  value?: number; // 값
  timestamp: number; // 타임스탬프
  sessionId: string; // 세션 ID
  metadata?: object; // 메타데이터
}
```

## 개발자 도구

### 모니터링 데모 컴포넌트

개발 환경에서 `/sample-components` 페이지에서 모니터링 시스템을 테스트할 수 있습니다:

- 각종 이벤트 시뮬레이션
- 실시간 통계 확인
- 에러 발생 테스트
- 성능 메트릭 확인

### 디버그 모드

`VITE_DEBUG=true`로 설정하면 콘솔에서 모니터링 시스템의 동작을 확인할 수 있습니다:

```javascript
// 브라우저 콘솔에서
console.log("[Monitoring] Performance metric received", metric);
console.log("[Monitoring] Error report received", error);
console.log("[Analytics] Event tracked", event);
```

## 보안 고려사항

### 데이터 정화

- 개인정보 자동 필터링 (이메일, 전화번호, 비밀번호 등)
- 민감한 localStorage/sessionStorage 키 제외
- 에러 스택에서 민감한 정보 제거
- 폼 데이터에서 개인정보 필드 제외

### 데이터 최소화

- 에러 메시지 길이 제한
- 스택 트레이스 길이 제한
- 세션당 최대 에러 수 제한
- 메타데이터 크기 제한

## 성능 최적화

### 백그라운드 처리

- 논블로킹 데이터 수집
- 배치 처리로 네트워크 요청 최소화
- Web Worker 활용 (필요시)
- 메모리 사용량 모니터링

### 조건부 활성화

- 환경변수로 기능별 제어
- 프로덕션에서 디버그 로깅 비활성화
- 사용자 동의에 따른 선택적 활성화
- 배터리 상태에 따른 적응형 수집

## 문제 해결

### 일반적인 문제

1. **모니터링이 작동하지 않음**
   - 환경변수 설정 확인
   - 브라우저 호환성 확인 (Performance Observer API)
   - 네트워크 연결 상태 확인

2. **데이터가 전송되지 않음**
   - Analytics endpoint URL 확인
   - CORS 설정 확인
   - Beacon API 지원 여부 확인

3. **성능 영향**
   - 배치 크기 조정
   - 플러시 간격 늘리기
   - 일부 기능 비활성화

### 브라우저 호환성

- **Performance Observer**: Chrome 52+, Firefox 57+, Safari 11+
- **Beacon API**: Chrome 39+, Firefox 31+, Safari 11.1+
- **Memory API**: Chrome 7+ (webkit prefix)

## 라이센스

이 모니터링 시스템은 프로젝트의 라이센스를 따릅니다.
