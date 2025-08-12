/**
 * 성능 모니터링 시스템
 * Core Web Vitals, 사용자 상호작용, 메모리 사용량을 추적합니다.
 */

export interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  url: string;
  userAgent: string;
  sessionId: string;
  metadata?: Record<string, unknown>;
}

export interface WebVitalsMetrics {
  LCP?: number; // Largest Contentful Paint
  FID?: number; // First Input Delay
  CLS?: number; // Cumulative Layout Shift
  TTFB?: number; // Time to First Byte
  FCP?: number; // First Contentful Paint
  INP?: number; // Interaction to Next Paint (새로운 Core Web Vital)
}

export interface UserInteraction {
  type: "click" | "scroll" | "navigation" | "form_submit" | "api_call";
  target?: string;
  timestamp: number;
  duration?: number;
  metadata?: Record<string, unknown>;
}

export interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  timestamp: number;
}

export interface NetworkMetric {
  url: string;
  method: string;
  duration: number;
  size: number;
  status: number;
  timestamp: number;
  type: "fetch" | "xhr";
}

/**
 * 성능 모니터링을 위한 메인 클래스
 */
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private sessionId: string;
  private webVitalsMetrics: WebVitalsMetrics = {};
  private interactions: UserInteraction[] = [];
  private networkMetrics: NetworkMetric[] = [];
  private memoryMetrics: MemoryInfo[] = [];
  private observers: PerformanceObserver[] = [];
  private isEnabled: boolean;
  private onMetricCallback?: (metric: PerformanceMetric) => void;

  private constructor() {
    this.sessionId = this.generateSessionId();
    this.isEnabled = this.shouldEnableMonitoring();

    if (this.isEnabled) {
      this.initializeWebVitals();
      this.initializeUserInteractionTracking();
      this.initializeNetworkTracking();
      this.initializeMemoryTracking();
    }
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * 메트릭 수집 콜백 함수 설정
   */
  onMetric(callback: (metric: PerformanceMetric) => void): void {
    this.onMetricCallback = callback;
  }

  /**
   * 세션 ID 생성
   */
  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 모니터링 활성화 여부 결정
   */
  private shouldEnableMonitoring(): boolean {
    // 환경변수로 제어 가능
    const isDebugMode = import.meta.env.VITE_DEBUG === "true";
    const isProduction = import.meta.env.MODE === "production";
    const enableMonitoring = import.meta.env.VITE_ENABLE_MONITORING !== "false";

    return (isDebugMode || isProduction) && enableMonitoring;
  }

  /**
   * Core Web Vitals 초기화
   */
  private initializeWebVitals(): void {
    // LCP (Largest Contentful Paint) 측정
    this.observeMetric("largest-contentful-paint", (entries) => {
      const entry = entries[entries.length - 1] as PerformanceEntry & {
        size?: number;
      };
      this.webVitalsMetrics.LCP = entry.startTime;
      this.reportMetric("LCP", entry.startTime, {
        size: entry.size,
        id: (entry as PerformanceEntry & { id?: string }).id,
        url: (entry as PerformanceEntry & { url?: string }).url,
      });
    });

    // FCP (First Contentful Paint) 측정
    this.observeMetric("paint", (entries) => {
      const fcpEntry = entries.find(
        (entry) => entry.name === "first-contentful-paint",
      );
      if (fcpEntry) {
        this.webVitalsMetrics.FCP = fcpEntry.startTime;
        this.reportMetric("FCP", fcpEntry.startTime);
      }
    });

    // CLS (Cumulative Layout Shift) 측정
    this.observeMetric("layout-shift", (entries) => {
      let clsValue = 0;
      entries.forEach(
        (
          entry: PerformanceEntry & {
            hadRecentInput?: boolean;
            value?: number;
          },
        ) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value || 0;
          }
        },
      );
      this.webVitalsMetrics.CLS = clsValue;
      this.reportMetric("CLS", clsValue);
    });

    // Navigation Timing으로 TTFB 측정
    if ("navigation" in performance && "getEntriesByType" in performance) {
      const navigationEntry = performance.getEntriesByType(
        "navigation",
      )[0] as PerformanceNavigationTiming;
      if (navigationEntry) {
        const ttfb =
          navigationEntry.responseStart - navigationEntry.requestStart;
        this.webVitalsMetrics.TTFB = ttfb;
        this.reportMetric("TTFB", ttfb);
      }
    }

    // FID (First Input Delay) 및 INP 측정을 위한 이벤트 리스너
    this.measureFirstInputDelay();
    this.measureInteractionToNextPaint();
  }

  /**
   * Performance Observer를 사용한 메트릭 관찰
   */
  private observeMetric(
    type: string,
    callback: (entries: PerformanceEntry[]) => void,
  ): void {
    try {
      const observer = new PerformanceObserver((list) => {
        callback(list.getEntries());
      });
      observer.observe({ type, buffered: true });
      this.observers.push(observer);
    } catch (error) {
      console.warn(`Performance observer for ${type} not supported:`, error);
    }
  }

  /**
   * First Input Delay 측정
   */
  private measureFirstInputDelay(): void {
    let firstInputProcessed = false;

    const processFirstInput = (event: Event) => {
      if (firstInputProcessed) return;
      firstInputProcessed = true;

      const now = performance.now();
      const fid = now - (event as Event & { timeStamp: number }).timeStamp;

      this.webVitalsMetrics.FID = fid;
      this.reportMetric("FID", fid, {
        eventType: event.type,
        target: this.getElementSelector(event.target as Element),
      });
    };

    ["mousedown", "keydown", "touchstart", "pointerdown"].forEach(
      (eventType) => {
        document.addEventListener(eventType, processFirstInput, {
          once: true,
          passive: true,
          capture: true,
        });
      },
    );
  }

  /**
   * Interaction to Next Paint 측정
   */
  private measureInteractionToNextPaint(): void {
    this.observeMetric("event", (entries) => {
      entries.forEach(
        (
          entry: PerformanceEntry & {
            name?: string;
            processingEnd?: number;
            target?: string;
          },
        ) => {
          if (entry.name === "keydown" || entry.name === "pointerdown") {
            const processingEnd = entry.processingEnd || 0;
            const startTime = entry.startTime || 0;
            const inp = processingEnd - startTime;
            if (inp > 0) {
              this.webVitalsMetrics.INP = Math.max(
                this.webVitalsMetrics.INP || 0,
                inp,
              );
              this.reportMetric("INP", inp, {
                eventType: entry.name,
                target: entry.target,
              });
            }
          }
        },
      );
    });
  }

  /**
   * 사용자 상호작용 추적 초기화
   */
  private initializeUserInteractionTracking(): void {
    // 클릭 이벤트 추적
    document.addEventListener(
      "click",
      (event) => {
        this.trackInteraction({
          type: "click",
          target: this.getElementSelector(event.target as Element),
          timestamp: performance.now(),
          metadata: {
            x: event.clientX,
            y: event.clientY,
            button: event.button,
          },
        });
      },
      { passive: true },
    );

    // 스크롤 이벤트 추적 (throttled)
    let scrollTimeout: NodeJS.Timeout;
    document.addEventListener(
      "scroll",
      () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          this.trackInteraction({
            type: "scroll",
            timestamp: performance.now(),
            metadata: {
              scrollTop: document.documentElement.scrollTop,
              scrollLeft: document.documentElement.scrollLeft,
            },
          });
        }, 100);
      },
      { passive: true },
    );

    // 폼 제출 추적
    document.addEventListener(
      "submit",
      (event) => {
        this.trackInteraction({
          type: "form_submit",
          target: this.getElementSelector(event.target as Element),
          timestamp: performance.now(),
          metadata: {
            formData: this.getFormData(event.target as HTMLFormElement),
          },
        });
      },
      { passive: true },
    );

    // 페이지 네비게이션 추적
    this.trackPageNavigation();
  }

  /**
   * 페이지 네비게이션 추적
   */
  private trackPageNavigation(): void {
    let currentUrl = window.location.href;

    const trackNavigation = () => {
      const newUrl = window.location.href;
      if (newUrl !== currentUrl) {
        this.trackInteraction({
          type: "navigation",
          timestamp: performance.now(),
          metadata: {
            from: currentUrl,
            to: newUrl,
            type: "spa",
          },
        });
        currentUrl = newUrl;
      }
    };

    // History API 감지
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function (...args) {
      originalPushState.apply(this, args);
      trackNavigation();
    };

    history.replaceState = function (...args) {
      originalReplaceState.apply(this, args);
      trackNavigation();
    };

    window.addEventListener("popstate", trackNavigation);
  }

  /**
   * 네트워크 요청 추적 초기화
   */
  private initializeNetworkTracking(): void {
    // Fetch API 래핑
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const startTime = performance.now();
      const url = typeof args[0] === "string" ? args[0] : args[0].url;
      const method = args[1]?.method || "GET";

      try {
        const response = await originalFetch(...args);
        const endTime = performance.now();

        this.trackNetworkRequest({
          url,
          method,
          duration: endTime - startTime,
          size: parseInt(response.headers.get("content-length") || "0", 10),
          status: response.status,
          timestamp: startTime,
          type: "fetch",
        });

        return response;
      } catch (error) {
        const endTime = performance.now();
        this.trackNetworkRequest({
          url,
          method,
          duration: endTime - startTime,
          size: 0,
          status: 0,
          timestamp: startTime,
          type: "fetch",
        });
        throw error;
      }
    };

    // XMLHttpRequest 래핑
    const originalXhrOpen = XMLHttpRequest.prototype.open;
    const originalXhrSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (
      method: string,
      url: string,
      ...args: unknown[]
    ) {
      (
        this as XMLHttpRequest & {
          __method?: string;
          __url?: string;
          __startTime?: number;
        }
      ).__method = method;
      (
        this as XMLHttpRequest & {
          __method?: string;
          __url?: string;
          __startTime?: number;
        }
      ).__url = url;
      (
        this as XMLHttpRequest & {
          __method?: string;
          __url?: string;
          __startTime?: number;
        }
      ).__startTime = performance.now();
      return originalXhrOpen.call(this, method, url, ...args);
    };

    XMLHttpRequest.prototype.send = function (...args: unknown[]) {
      const xhrWithCustomProps = this as XMLHttpRequest & {
        __method?: string;
        __url?: string;
        __startTime?: number;
      };

      xhrWithCustomProps.addEventListener("loadend", () => {
        const endTime = performance.now();
        const monitor = PerformanceMonitor.getInstance();

        monitor.trackNetworkRequest({
          url: xhrWithCustomProps.__url || "unknown",
          method: xhrWithCustomProps.__method || "GET",
          duration: endTime - (xhrWithCustomProps.__startTime || 0),
          size: xhrWithCustomProps.responseText?.length || 0,
          status: xhrWithCustomProps.status,
          timestamp: xhrWithCustomProps.__startTime || 0,
          type: "xhr",
        });
      });

      return originalXhrSend.call(this, ...args);
    };
  }

  /**
   * 메모리 사용량 추적 초기화
   */
  private initializeMemoryTracking(): void {
    if ("memory" in performance) {
      // 주기적으로 메모리 정보 수집 (5초마다)
      setInterval(() => {
        const memoryInfo = this.getMemoryInfo();
        if (memoryInfo) {
          this.memoryMetrics.push(memoryInfo);
          this.reportMetric("memory_usage", memoryInfo.usedJSHeapSize, {
            total: memoryInfo.totalJSHeapSize,
            limit: memoryInfo.jsHeapSizeLimit,
            usage_percentage:
              (memoryInfo.usedJSHeapSize / memoryInfo.totalJSHeapSize) * 100,
          });

          // 메모리 사용량이 한계의 80% 이상이면 경고
          const usagePercent =
            (memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit) * 100;
          if (usagePercent > 80) {
            this.reportMetric("high_memory_usage", usagePercent, memoryInfo);
          }
        }
      }, 5000);
    }
  }

  /**
   * 상호작용 추적
   */
  private trackInteraction(interaction: UserInteraction): void {
    this.interactions.push(interaction);
    this.reportMetric("user_interaction", interaction.timestamp, interaction);
  }

  /**
   * 네트워크 요청 추적
   */
  private trackNetworkRequest(metric: NetworkMetric): void {
    this.networkMetrics.push(metric);
    this.reportMetric("network_request", metric.duration, {
      url: metric.url,
      method: metric.method,
      status: metric.status,
      size: metric.size,
      type: metric.type,
    });
  }

  /**
   * 메트릭 리포트
   */
  private reportMetric(
    name: string,
    value: number,
    metadata?: Record<string, unknown>,
  ): void {
    if (!this.onMetricCallback) return;

    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      sessionId: this.sessionId,
      metadata,
    };

    this.onMetricCallback(metric);
  }

  /**
   * Element selector 생성
   */
  private getElementSelector(element: Element | null): string {
    if (!element) return "unknown";

    if (element.id) {
      return `#${element.id}`;
    }

    if (element.className) {
      const classes = Array.from(element.classList).slice(0, 2).join(".");
      return `.${classes}`;
    }

    return element.tagName.toLowerCase();
  }

  /**
   * 폼 데이터 추출 (개인정보 제외)
   */
  private getFormData(form: HTMLFormElement): Record<string, string> {
    const formData = new FormData(form);
    const data: Record<string, string> = {};

    // 민감한 필드 제외
    const excludeFields = [
      "password",
      "email",
      "phone",
      "ssn",
      "credit",
      "card",
    ];

    for (const [key, value] of formData.entries()) {
      const lowerKey = key.toLowerCase();
      const shouldExclude = excludeFields.some((field) =>
        lowerKey.includes(field),
      );

      if (!shouldExclude && typeof value === "string") {
        data[key] = value.length > 50 ? "[long_text]" : "[form_field]";
      }
    }

    return data;
  }

  /**
   * 메모리 정보 조회
   */
  private getMemoryInfo(): MemoryInfo | null {
    const memory = (
      performance as Performance & {
        memory?: {
          usedJSHeapSize: number;
          totalJSHeapSize: number;
          jsHeapSizeLimit: number;
        };
      }
    ).memory;
    if (!memory) return null;

    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      timestamp: Date.now(),
    };
  }

  /**
   * API 호출 성능 추적
   */
  trackApiCall(
    url: string,
    method: string,
    duration: number,
    status: number,
  ): void {
    this.trackInteraction({
      type: "api_call",
      timestamp: performance.now(),
      duration,
      metadata: {
        url,
        method,
        status,
        slow_request: duration > 1000,
      },
    });
  }

  /**
   * 현재 수집된 메트릭 조회
   */
  getMetrics() {
    return {
      webVitals: this.webVitalsMetrics,
      interactions: this.interactions,
      networkMetrics: this.networkMetrics,
      memoryMetrics: this.memoryMetrics,
      sessionId: this.sessionId,
    };
  }

  /**
   * 모니터링 중단
   */
  destroy(): void {
    this.observers.forEach((observer) => observer.disconnect());
    this.observers = [];
  }
}

export default PerformanceMonitor;
