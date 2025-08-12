# Error Boundary 사용 가이드

React Error Boundary 컴포넌트의 사용법과 모범 사례를 안내합니다.

## 📋 목차

- [기본 사용법](#기본-사용법)
- [고급 설정](#고급-설정)
- [전역 에러 처리](#전역-에러-처리)
- [에러 리포팅](#에러-리포팅)
- [테스트 및 디버깅](#테스트-및-디버깅)
- [모범 사례](#모범-사례)

## 🚀 기본 사용법

### 1. 단순한 Error Boundary

```tsx
import { ErrorBoundary } from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <MyComponent />
    </ErrorBoundary>
  );
}
```

### 2. HOC를 사용한 방법

```tsx
import { withErrorBoundary } from './components/ErrorBoundary';

const SafeComponent = withErrorBoundary(MyComponent, {
  onError: (error, errorInfo) => {
    console.log('Component error:', error.message);
  }
});
```

## ⚙️ 고급 설정

### 1. 커스텀 Error UI

```tsx
function CustomErrorUI(error: Error, errorInfo: any, onRetry: () => void) {
  return (
    <div className="custom-error-container">
      <h2>앗, 문제가 발생했어요!</h2>
      <p>에러: {error.message}</p>
      <button onClick={onRetry}>다시 시도</button>
    </div>
  );
}

<ErrorBoundary fallback={CustomErrorUI}>
  <MyComponent />
</ErrorBoundary>
```

### 2. 에러 리포팅 설정

```tsx
<ErrorBoundary
  enableReporting={true}
  reportEndpoint="/api/errors"
  onError={(error, errorInfo) => {
    // 커스텀 에러 처리 로직
    analytics.track('Error', {
      message: error.message,
      component: 'MyComponent'
    });
  }}
>
  <MyComponent />
</ErrorBoundary>
```

## 🌐 전역 에러 처리

### main.tsx에서 전역 에러 핸들러 초기화

```tsx
import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { initializeGlobalErrorHandler } from './utils/global-error-handler';
import App from './App';

function AppWrapper() {
  useEffect(() => {
    // 전역 에러 핸들러 초기화
    const handler = initializeGlobalErrorHandler({
      enableConsoleLogging: true,
      enableReporting: process.env.NODE_ENV === 'production',
      reportEndpoint: '/api/errors/global',
      onError: (error, context) => {
        console.warn(`Global error in ${context}:`, error.message);
        
        // 코드 스플리팅 에러 처리
        if (error.message.includes('ChunkLoadError')) {
          const shouldReload = confirm('앱 업데이트가 있습니다. 새로고침하시겠습니까?');
          if (shouldReload) window.location.reload();
        }
      }
    });

    return () => handler.cleanup();
  }, []);

  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppWrapper />
  </StrictMode>
);
```

### App.tsx에서 Error Boundary 적용

```tsx
import { ErrorBoundary } from './components/ErrorBoundary';

function App() {
  return (
    // 최상위 Error Boundary
    <ErrorBoundary
      enableReporting={true}
      reportEndpoint="/api/errors/app"
      onError={(error, errorInfo) => {
        console.error('App-level error:', error.message);
      }}
    >
      {/* 주요 섹션별로 Error Boundary 적용 */}
      <ErrorBoundary>
        <Header />
      </ErrorBoundary>
      
      <ErrorBoundary>
        <MainContent />
      </ErrorBoundary>
      
      <ErrorBoundary>
        <Footer />
      </ErrorBoundary>
    </ErrorBoundary>
  );
}
```

## 📊 에러 리포팅

### 1. 로컬 스토리지에 저장된 에러 확인

```tsx
import { ErrorBoundary } from './components/ErrorBoundary';

// 저장된 에러 로그 조회
const errorLogs = JSON.parse(localStorage.getItem('vive_error_logs') || '[]');
console.log('Stored errors:', errorLogs);

// 에러 로그 삭제
localStorage.removeItem('vive_error_logs');
```

### 2. 서버 에러 리포팅 엔드포인트 예시

```ts
// Backend API endpoint example
app.post('/api/errors', async (req, res) => {
  const errorData = req.body;
  
  // 에러 로깅
  logger.error('Frontend error received', {
    id: errorData.id,
    message: errorData.message,
    stack: errorData.stack,
    url: errorData.url,
    timestamp: errorData.timestamp
  });
  
  // 데이터베이스에 저장
  await ErrorReport.create(errorData);
  
  res.status(200).json({ success: true });
});
```

## 🧪 테스트 및 디버깅

### 1. 에러 발생 테스트

```tsx
import { throwError } from './components/ErrorBoundary';

function TestComponent() {
  return (
    <div>
      <button onClick={() => throwError('테스트 에러')}>
        에러 발생시키기
      </button>
    </div>
  );
}
```

### 2. ErrorBoundaryDemo 컴포넌트 사용

```tsx
import { ErrorBoundaryDemo } from './components/ErrorBoundaryDemo';

// 개발 환경에서만 사용
if (process.env.NODE_ENV === 'development') {
  // /error-demo 라우트에 추가
}
```

### 3. 비동기 에러 처리

```tsx
import { handleAsyncError } from './components/ErrorBoundary';

async function fetchData() {
  try {
    const response = await fetch('/api/data');
    return await response.json();
  } catch (error) {
    handleAsyncError(error as Error, 'fetchData');
    throw error; // 필요에 따라 다시 throw
  }
}
```

## 📋 모범 사례

### 1. Error Boundary 배치 전략

```tsx
// ❌ 너무 세분화된 배치
<ErrorBoundary>
  <button>버튼</button>
</ErrorBoundary>

// ✅ 적절한 단위로 그룹화
<ErrorBoundary>
  <UserProfile />
  <UserActions />
</ErrorBoundary>

// ✅ 중요한 기능별로 분리
<ErrorBoundary>
  <PaymentForm />
</ErrorBoundary>
```

### 2. 환경별 설정

```tsx
const errorBoundaryConfig = {
  development: {
    enableReporting: false,
    showDetailedErrors: true,
  },
  production: {
    enableReporting: true,
    reportEndpoint: '/api/errors',
    showDetailedErrors: false,
  }
};

const config = errorBoundaryConfig[process.env.NODE_ENV] || errorBoundaryConfig.production;
```

### 3. 에러 타입별 처리

```tsx
function smartErrorHandler(error: Error, context: string) {
  if (error.message.includes('ChunkLoadError')) {
    // 코드 스플리팅 에러 - 새로고침 권장
    return 'code_split_error';
  }
  
  if (error.message.includes('Network Error')) {
    // 네트워크 에러 - 재시도 권장
    return 'network_error';
  }
  
  if (error.name === 'TypeError') {
    // 타입 에러 - 심각한 버그 가능성
    return 'type_error';
  }
  
  return 'unknown_error';
}
```

### 4. 사용자 경험 향상

```tsx
<ErrorBoundary
  fallback={(error, errorInfo, onRetry) => (
    <div className="error-container">
      {/* 사용자 친화적 메시지 */}
      <h2>잠시 문제가 발생했어요</h2>
      <p>불편을 드려 죄송합니다. 아래 방법을 시도해 보세요.</p>
      
      {/* 단계별 해결책 제공 */}
      <ol>
        <li>
          <button onClick={onRetry}>다시 시도</button>
        </li>
        <li>
          <button onClick={() => window.location.reload()}>
            페이지 새로고침
          </button>
        </li>
        <li>브라우저 캐시 삭제 후 재시도</li>
      </ol>
      
      {/* 고객 지원 연결 */}
      <p>
        문제가 지속되면 <a href="/contact">고객 지원</a>에 문의해 주세요.
      </p>
    </div>
  )}
>
  <MyComponent />
</ErrorBoundary>
```

## 🚫 Error Boundary로 잡히지 않는 에러들

다음 에러들은 Error Boundary로 잡을 수 없으므로 전역 에러 핸들러를 사용해야 합니다:

- **이벤트 핸들러 내부의 에러**
- **비동기 코드의 에러** (setTimeout, Promise 등)
- **useEffect의 비동기 에러**
- **서버사이드 렌더링 에러**
- **Error Boundary 자체의 에러**

```tsx
// ❌ Error Boundary로 잡히지 않음
function Component() {
  const handleClick = () => {
    throw new Error('Click handler error');
  };
  
  useEffect(() => {
    setTimeout(() => {
      throw new Error('Async error');
    }, 1000);
  }, []);
  
  return <button onClick={handleClick}>Click</button>;
}

// ✅ 전역 에러 핸들러나 try-catch 사용
function Component() {
  const handleClick = () => {
    try {
      // 위험한 작업
    } catch (error) {
      handleAsyncError(error, 'handleClick');
    }
  };
  
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        // 비동기 작업
      } catch (error) {
        handleAsyncError(error, 'useEffect timeout');
      }
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);
}
```

## 🔧 트러블슈팅

### 1. Error Boundary가 작동하지 않는 경우

- 개발 모드에서는 React가 에러를 다시 throw할 수 있습니다
- 프로덕션 빌드에서 테스트해보세요
- 에러가 render 단계가 아닌 이벤트 핸들러에서 발생하지 않았는지 확인하세요

### 2. 에러 리포팅이 작동하지 않는 경우

- 네트워크 연결 상태 확인
- CORS 정책 확인
- 서버 엔드포인트 상태 확인

### 3. 성능 이슈

- Error Boundary를 너무 많이 중첩하지 마세요
- 대용량 에러 로그는 주기적으로 정리하세요
- 에러 리포팅 빈도를 제한하세요 (throttling)

## 📚 추가 리소스

- [React Error Boundaries 공식 문서](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)
- [Error Handling in React 16](https://reactjs.org/blog/2017/07/26/error-handling-in-react-16.html)
- [Production Error Monitoring Best Practices](https://blog.sentry.io/error-monitoring-best-practices/)