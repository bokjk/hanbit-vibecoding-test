/**
 * 에러 리포팅 시스템
 * JavaScript 에러, 리소스 로딩 실패, API 요청 에러를 수집하고 리포트합니다.
 */

export interface ErrorReport {
  id: string;
  type: 'javascript' | 'resource' | 'api' | 'unhandled_rejection' | 'console_error';
  message: string;
  stack?: string;
  url: string;
  lineNumber?: number;
  columnNumber?: number;
  timestamp: number;
  userAgent: string;
  sessionId: string;
  userId?: string;
  context: ErrorContext;
  severity: 'low' | 'medium' | 'high' | 'critical';
  fingerprint: string; // 동일한 에러 그룹화용
}

export interface ErrorContext {
  url: string;
  userAgent: string;
  viewport: {
    width: number;
    height: number;
  };
  timestamp: number;
  sessionDuration: number;
  previousActions: UserAction[];
  localStorage: Record<string, unknown>;
  sessionStorage: Record<string, unknown>;
  memoryUsage?: MemoryUsage;
  networkStatus: 'online' | 'offline';
  batteryLevel?: number;
}

export interface UserAction {
  type: 'click' | 'navigation' | 'form_submit' | 'api_call' | 'error';
  target?: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface MemoryUsage {
  used: number;
  total: number;
  limit: number;
}

export interface ResourceError {
  element: string;
  source: string;
  error: string;
  timestamp: number;
}

export interface ApiError {
  url: string;
  method: string;
  status: number;
  statusText: string;
  responseText?: string;
  requestBody?: unknown;
  timestamp: number;
  duration: number;
}

/**
 * 에러 리포터 메인 클래스
 */
export class ErrorReporter {
  private static instance: ErrorReporter;
  private sessionId: string;
  private sessionStartTime: number;
  private userActions: UserAction[] = [];
  private maxActionsHistory = 20;
  private isEnabled: boolean;
  private onErrorCallback?: (error: ErrorReport) => void;
  private errorCount = 0;
  private maxErrorsPerSession = 100; // 세션당 최대 에러 수집 제한

  private constructor() {
    this.sessionId = this.generateSessionId();
    this.sessionStartTime = Date.now();
    this.isEnabled = this.shouldEnableReporting();

    if (this.isEnabled) {
      this.initializeErrorHandlers();
      this.initializeResourceErrorHandling();
      this.initializeUnhandledRejectionHandling();
      this.initializeConsoleErrorInterception();
      this.trackUserActions();
    }
  }

  static getInstance(): ErrorReporter {
    if (!ErrorReporter.instance) {
      ErrorReporter.instance = new ErrorReporter();
    }
    return ErrorReporter.instance;
  }

  /**
   * 에러 콜백 함수 설정
   */
  onError(callback: (error: ErrorReport) => void): void {
    this.onErrorCallback = callback;
  }

  /**
   * 세션 ID 생성
   */
  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 에러 리포팅 활성화 여부 결정
   */
  private shouldEnableReporting(): boolean {
    // 환경변수로 제어
    const isDebugMode = import.meta.env.VITE_DEBUG === 'true';
    const isProduction = import.meta.env.MODE === 'production';
    const enableReporting = import.meta.env.VITE_ENABLE_ERROR_REPORTING !== 'false';
    
    return (isDebugMode || isProduction) && enableReporting;
  }

  /**
   * JavaScript 에러 핸들러 초기화
   */
  private initializeErrorHandlers(): void {
    // Global error handler
    window.addEventListener('error', (event) => {
      this.handleJavaScriptError({
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error
      });
    });

    // React Error Boundary와 통합 가능한 함수 제공
    (window as Window & { __reportReactError?: (error: Error, errorInfo: unknown) => void }).__reportReactError = (error: Error, errorInfo: unknown) => {
      this.reportReactError(error, errorInfo);
    };
  }

  /**
   * 리소스 로딩 에러 핸들링
   */
  private initializeResourceErrorHandling(): void {
    window.addEventListener('error', (event) => {
      const target = event.target as HTMLElement;
      
      // 리소스 로딩 에러만 처리
      if (target && target !== window && (target.tagName === 'IMG' || target.tagName === 'SCRIPT' || target.tagName === 'LINK')) {
        this.handleResourceError(target, event);
      }
    }, true); // capture phase에서 처리
  }

  /**
   * Unhandled Promise Rejection 핸들링
   */
  private initializeUnhandledRejectionHandling(): void {
    window.addEventListener('unhandledrejection', (event) => {
      this.handleUnhandledRejection(event);
    });
  }

  /**
   * Console error 가로채기
   */
  private initializeConsoleErrorInterception(): void {
    const originalConsoleError = console.error;
    
    console.error = (...args) => {
      // 원본 console.error 실행
      originalConsoleError.apply(console, args);
      
      // 에러 리포팅
      this.handleConsoleError(args);
    };
  }

  /**
   * 사용자 액션 추적
   */
  private trackUserActions(): void {
    // 클릭 추적
    document.addEventListener('click', (event) => {
      this.addUserAction({
        type: 'click',
        target: this.getElementSelector(event.target as Element),
        timestamp: Date.now(),
        metadata: {
          x: event.clientX,
          y: event.clientY
        }
      });
    }, { passive: true });

    // 네비게이션 추적
    const trackNavigation = () => {
      this.addUserAction({
        type: 'navigation',
        timestamp: Date.now(),
        metadata: {
          url: window.location.href,
          referrer: document.referrer
        }
      });
    };

    // History API 감지
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function(...args) {
      originalPushState.apply(this, args);
      trackNavigation();
    };

    history.replaceState = function(...args) {
      originalReplaceState.apply(this, args);
      trackNavigation();
    };

    window.addEventListener('popstate', trackNavigation);

    // 폼 제출 추적
    document.addEventListener('submit', (event) => {
      this.addUserAction({
        type: 'form_submit',
        target: this.getElementSelector(event.target as Element),
        timestamp: Date.now()
      });
    });
  }

  /**
   * JavaScript 에러 처리
   */
  private handleJavaScriptError(errorEvent: {
    message: string;
    filename?: string;
    lineno?: number;
    colno?: number;
    error?: Error;
  }): void {
    if (this.errorCount >= this.maxErrorsPerSession) {
      return;
    }

    const error = errorEvent.error;
    const stack = error?.stack || new Error().stack;
    
    const errorReport: ErrorReport = {
      id: this.generateErrorId(),
      type: 'javascript',
      message: errorEvent.message,
      stack,
      url: errorEvent.filename || window.location.href,
      lineNumber: errorEvent.lineno,
      columnNumber: errorEvent.colno,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      sessionId: this.sessionId,
      context: this.getErrorContext(),
      severity: this.calculateSeverity('javascript', errorEvent.message),
      fingerprint: this.generateFingerprint('javascript', errorEvent.message, stack)
    };

    this.reportError(errorReport);
  }

  /**
   * React 에러 처리
   */
  reportReactError(error: Error, errorInfo: { componentStack?: string; errorBoundary?: { constructor: { name: string } } }): void {
    if (this.errorCount >= this.maxErrorsPerSession) {
      return;
    }

    const errorReport: ErrorReport = {
      id: this.generateErrorId(),
      type: 'javascript',
      message: error.message,
      stack: error.stack,
      url: window.location.href,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      sessionId: this.sessionId,
      context: {
        ...this.getErrorContext(),
        reactErrorInfo: {
          componentStack: errorInfo.componentStack || 'Unknown',
          errorBoundary: errorInfo.errorBoundary?.constructor.name || 'Unknown'
        }
      },
      severity: 'high',
      fingerprint: this.generateFingerprint('react', error.message, error.stack)
    };

    this.reportError(errorReport);
  }

  /**
   * 리소스 에러 처리
   */
  private handleResourceError(element: HTMLElement, event: ErrorEvent): void {
    if (this.errorCount >= this.maxErrorsPerSession) {
      return;
    }

    const source = this.getResourceSource(element);
    
    const errorReport: ErrorReport = {
      id: this.generateErrorId(),
      type: 'resource',
      message: `Failed to load resource: ${source}`,
      url: window.location.href,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      sessionId: this.sessionId,
      context: {
        ...this.getErrorContext(),
        resourceInfo: {
          tagName: element.tagName,
          source,
          outerHTML: element.outerHTML.substring(0, 200)
        }
      },
      severity: this.calculateResourceSeverity(element.tagName),
      fingerprint: this.generateFingerprint('resource', source)
    };

    this.reportError(errorReport);
  }

  /**
   * Unhandled Promise Rejection 처리
   */
  private handleUnhandledRejection(event: PromiseRejectionEvent): void {
    if (this.errorCount >= this.maxErrorsPerSession) {
      return;
    }

    const reason = event.reason;
    let message = 'Unhandled Promise Rejection';
    let stack: string | undefined;

    if (reason instanceof Error) {
      message = reason.message;
      stack = reason.stack;
    } else if (typeof reason === 'string') {
      message = reason;
    } else {
      message = JSON.stringify(reason);
    }

    const errorReport: ErrorReport = {
      id: this.generateErrorId(),
      type: 'unhandled_rejection',
      message,
      stack,
      url: window.location.href,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      sessionId: this.sessionId,
      context: this.getErrorContext(),
      severity: 'medium',
      fingerprint: this.generateFingerprint('unhandled_rejection', message, stack)
    };

    this.reportError(errorReport);
  }

  /**
   * Console error 처리
   */
  private handleConsoleError(args: unknown[]): void {
    if (this.errorCount >= this.maxErrorsPerSession) {
      return;
    }

    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');

    // React 개발 모드의 경고나 일반적인 로그는 제외
    if (this.shouldIgnoreConsoleError(message)) {
      return;
    }

    const errorReport: ErrorReport = {
      id: this.generateErrorId(),
      type: 'console_error',
      message,
      url: window.location.href,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      sessionId: this.sessionId,
      context: this.getErrorContext(),
      severity: 'low',
      fingerprint: this.generateFingerprint('console_error', message)
    };

    this.reportError(errorReport);
  }

  /**
   * API 에러 리포트
   */
  reportApiError(apiError: ApiError): void {
    if (this.errorCount >= this.maxErrorsPerSession) {
      return;
    }

    const message = `API Error: ${apiError.method} ${apiError.url} - ${apiError.status} ${apiError.statusText}`;
    
    const errorReport: ErrorReport = {
      id: this.generateErrorId(),
      type: 'api',
      message,
      url: window.location.href,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      sessionId: this.sessionId,
      context: {
        ...this.getErrorContext(),
        apiInfo: {
          requestUrl: apiError.url,
          method: apiError.method,
          status: apiError.status,
          statusText: apiError.statusText,
          duration: apiError.duration,
          responseText: apiError.responseText?.substring(0, 1000), // 처음 1000자만
          requestBody: typeof apiError.requestBody === 'string' 
            ? apiError.requestBody.substring(0, 500)
            : JSON.stringify(apiError.requestBody).substring(0, 500)
        }
      },
      severity: this.calculateApiSeverity(apiError.status),
      fingerprint: this.generateFingerprint('api', `${apiError.method}_${apiError.url}_${apiError.status}`)
    };

    this.reportError(errorReport);
  }

  /**
   * 사용자 액션 추가
   */
  private addUserAction(action: UserAction): void {
    this.userActions.push(action);
    
    // 최대 개수 제한
    if (this.userActions.length > this.maxActionsHistory) {
      this.userActions = this.userActions.slice(-this.maxActionsHistory);
    }
  }

  /**
   * 에러 컨텍스트 생성
   */
  private getErrorContext(): ErrorContext {
    const now = Date.now();
    
    return {
      url: window.location.href,
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      timestamp: now,
      sessionDuration: now - this.sessionStartTime,
      previousActions: [...this.userActions], // 복사본 생성
      localStorage: this.getFilteredStorage('localStorage'),
      sessionStorage: this.getFilteredStorage('sessionStorage'),
      memoryUsage: this.getMemoryUsage(),
      networkStatus: navigator.onLine ? 'online' : 'offline',
      batteryLevel: this.getBatteryLevel()
    };
  }

  /**
   * 필터링된 스토리지 데이터 조회 (개인정보 제외)
   */
  private getFilteredStorage(storageType: 'localStorage' | 'sessionStorage'): Record<string, unknown> {
    const storage = storageType === 'localStorage' ? localStorage : sessionStorage;
    const filtered: Record<string, unknown> = {};
    
    // 민감한 키 제외
    const excludeKeys = ['token', 'password', 'email', 'phone', 'user', 'auth'];
    
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key) continue;
      
      const shouldExclude = excludeKeys.some(excludeKey => 
        key.toLowerCase().includes(excludeKey)
      );
      
      if (!shouldExclude) {
        try {
          const value = storage.getItem(key);
          filtered[key] = value ? JSON.parse(value) : value;
        } catch {
          filtered[key] = '[unparseable]';
        }
      }
    }
    
    return filtered;
  }

  /**
   * 메모리 사용량 조회
   */
  private getMemoryUsage(): MemoryUsage | undefined {
    const memory = (performance as Performance & { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
    if (!memory) return undefined;

    return {
      used: memory.usedJSHeapSize,
      total: memory.totalJSHeapSize,
      limit: memory.jsHeapSizeLimit
    };
  }

  /**
   * 배터리 레벨 조회
   */
  private getBatteryLevel(): number | undefined {
    // Battery API는 deprecated되었지만 일부 브라우저에서 여전히 사용 가능
    return undefined;
  }

  /**
   * Element selector 생성
   */
  private getElementSelector(element: Element | null): string {
    if (!element) return 'unknown';

    if (element.id) {
      return `#${element.id}`;
    }

    if (element.className) {
      const classes = Array.from(element.classList).slice(0, 2).join('.');
      return `.${classes}`;
    }

    return element.tagName.toLowerCase();
  }

  /**
   * 리소스 소스 조회
   */
  private getResourceSource(element: HTMLElement): string {
    if (element.tagName === 'IMG') {
      return (element as HTMLImageElement).src;
    }
    if (element.tagName === 'SCRIPT') {
      return (element as HTMLScriptElement).src;
    }
    if (element.tagName === 'LINK') {
      return (element as HTMLLinkElement).href;
    }
    return 'unknown';
  }

  /**
   * 심각도 계산
   */
  private calculateSeverity(type: string, message: string): ErrorReport['severity'] {
    const lowerMessage = message.toLowerCase();
    
    // Critical 에러
    if (lowerMessage.includes('cannot read property') || 
        lowerMessage.includes('is not a function') ||
        lowerMessage.includes('cannot access before initialization')) {
      return 'critical';
    }
    
    // High 에러
    if (lowerMessage.includes('typeerror') || 
        lowerMessage.includes('referenceerror')) {
      return 'high';
    }
    
    // Medium 에러
    if (type === 'unhandled_rejection') {
      return 'medium';
    }
    
    return 'low';
  }

  /**
   * 리소스 에러 심각도 계산
   */
  private calculateResourceSeverity(tagName: string): ErrorReport['severity'] {
    switch (tagName) {
      case 'SCRIPT':
        return 'high';
      case 'LINK':
        return 'medium';
      case 'IMG':
        return 'low';
      default:
        return 'low';
    }
  }

  /**
   * API 에러 심각도 계산
   */
  private calculateApiSeverity(status: number): ErrorReport['severity'] {
    if (status >= 500) return 'high';
    if (status >= 400) return 'medium';
    return 'low';
  }

  /**
   * Console error 무시 여부 결정
   */
  private shouldIgnoreConsoleError(message: string): boolean {
    const ignorePatterns = [
      'Warning:', // React 경고
      'You are running a production build of React', // React 정보 메시지
      '%c' // styled console log
    ];
    
    return ignorePatterns.some(pattern => message.includes(pattern));
  }

  /**
   * 에러 ID 생성
   */
  private generateErrorId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 에러 지문 생성 (동일한 에러 그룹화용)
   */
  private generateFingerprint(type: string, message: string, stack?: string): string {
    const key = `${type}-${message}`;
    if (stack) {
      // 스택의 첫 번째 유의미한 라인만 사용
      const stackLines = stack.split('\n');
      const meaningfulLine = stackLines.find(line => 
        line.includes('.js:') || line.includes('.ts:') || line.includes('.tsx:')
      );
      if (meaningfulLine) {
        return this.simpleHash(key + meaningfulLine);
      }
    }
    return this.simpleHash(key);
  }

  /**
   * 간단한 해시 함수
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32bit integer로 변환
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 에러 리포트 전송
   */
  private reportError(errorReport: ErrorReport): void {
    this.errorCount++;
    
    // 사용자 액션에 에러 추가
    this.addUserAction({
      type: 'error',
      timestamp: errorReport.timestamp,
      metadata: {
        errorType: errorReport.type,
        message: errorReport.message.substring(0, 100)
      }
    });

    if (this.onErrorCallback) {
      this.onErrorCallback(errorReport);
    }
  }

  /**
   * 통계 조회
   */
  getStats() {
    return {
      sessionId: this.sessionId,
      sessionDuration: Date.now() - this.sessionStartTime,
      errorCount: this.errorCount,
      userActionsCount: this.userActions.length
    };
  }

  /**
   * 에러 리포터 정리
   */
  destroy(): void {
    // 이벤트 리스너 정리는 브라우저가 자동으로 수행
    this.userActions = [];
  }
}

export default ErrorReporter;