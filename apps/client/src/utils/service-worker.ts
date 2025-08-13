/**
 * Service Worker 관리 유틸리티
 * PWA 지원, 캐시 관리, 업데이트 처리
 */

export interface ServiceWorkerState {
  isSupported: boolean;
  isRegistered: boolean;
  isUpdateAvailable: boolean;
  registration: ServiceWorkerRegistration | null;
  version: string | null;
}

export interface CacheStats {
  [cacheName: string]: {
    count: number;
    urls: string[];
  };
}

/**
 * Service Worker 관리자 클래스
 */
export class ServiceWorkerManager {
  private static instance: ServiceWorkerManager;
  private registration: ServiceWorkerRegistration | null = null;
  private updateHandlers: Array<(hasUpdate: boolean) => void> = [];
  private stateHandlers: Array<(state: ServiceWorkerState) => void> = [];

  private constructor() {
    // Singleton pattern
  }

  static getInstance(): ServiceWorkerManager {
    if (!ServiceWorkerManager.instance) {
      ServiceWorkerManager.instance = new ServiceWorkerManager();
    }
    return ServiceWorkerManager.instance;
  }

  /**
   * Service Worker 지원 여부 확인
   */
  isSupported(): boolean {
    return "serviceWorker" in navigator && "caches" in window;
  }

  /**
   * Service Worker 등록
   */
  async register(): Promise<ServiceWorkerRegistration | null> {
    if (!this.isSupported()) {
      console.warn("[SW Manager] Service Worker is not supported");
      return null;
    }

    try {
      // 프로덕션 환경에서만 Service Worker 활성화
      const isProduction = import.meta.env.MODE === "production";
      const enableSW = import.meta.env.VITE_ENABLE_SERVICE_WORKER !== "false";

      if (!isProduction && !enableSW) {
        console.log("[SW Manager] Service Worker disabled in development");
        return null;
      }

      // Service Worker 스크립트 경로
      const swPath = import.meta.env.BASE_URL + "sw.js";

      console.log("[SW Manager] Registering service worker:", swPath);

      this.registration = await navigator.serviceWorker.register(swPath, {
        scope: import.meta.env.BASE_URL,
        updateViaCache: "none", // 항상 네트워크에서 업데이트 확인
      });

      console.log("[SW Manager] Service worker registered successfully");

      // 업데이트 확인
      this.setupUpdateHandling();

      // 상태 알림
      this.notifyStateChange();

      // 주기적 업데이트 확인 (30분마다)
      this.scheduleUpdateChecks();

      return this.registration;
    } catch (error) {
      console.error("[SW Manager] Service worker registration failed:", error);
      return null;
    }
  }

  /**
   * Service Worker 업데이트 처리 설정
   */
  private setupUpdateHandling(): void {
    if (!this.registration) return;

    // 새로운 service worker가 설치되었을 때
    this.registration.addEventListener("updatefound", () => {
      console.log("[SW Manager] New service worker found");

      const newWorker = this.registration?.installing;
      if (!newWorker) return;

      newWorker.addEventListener("statechange", () => {
        if (
          newWorker.state === "installed" &&
          navigator.serviceWorker.controller
        ) {
          // 새 버전이 설치되었고 기존 워커가 있음 (업데이트 필요)
          console.log(
            "[SW Manager] New service worker installed, update available",
          );
          this.notifyUpdateAvailable();
        }
      });
    });

    // 새 service worker가 제어권을 가져갔을 때
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      console.log("[SW Manager] New service worker activated");
      // 페이지 새로고침하여 새 버전 적용
      if (this.shouldAutoReload()) {
        window.location.reload();
      }
    });

    // 메시지 수신 처리
    navigator.serviceWorker.addEventListener("message", (event) => {
      this.handleMessage(event);
    });
  }

  /**
   * 업데이트 사용 가능 알림
   */
  private notifyUpdateAvailable(): void {
    this.updateHandlers.forEach((handler) => handler(true));
    this.notifyStateChange();
  }

  /**
   * 상태 변경 알림
   */
  private notifyStateChange(): void {
    const state = this.getState();
    this.stateHandlers.forEach((handler) => handler(state));
  }

  /**
   * 현재 상태 조회
   */
  getState(): ServiceWorkerState {
    return {
      isSupported: this.isSupported(),
      isRegistered: !!this.registration,
      isUpdateAvailable: this.isUpdateAvailable(),
      registration: this.registration,
      version: null, // 버전은 별도 메시지로 조회
    };
  }

  /**
   * 업데이트 사용 가능 여부 확인
   */
  private isUpdateAvailable(): boolean {
    return !!(
      this.registration?.waiting ||
      (this.registration?.installing && navigator.serviceWorker.controller)
    );
  }

  /**
   * 자동 새로고침 여부 결정
   */
  private shouldAutoReload(): boolean {
    // 개발 환경에서는 자동 새로고침, 프로덕션에서는 사용자 확인
    return import.meta.env.MODE === "development";
  }

  /**
   * Service Worker 업데이트 적용
   */
  async applyUpdate(): Promise<void> {
    if (!this.registration?.waiting) {
      console.log("[SW Manager] No waiting service worker found");
      return;
    }

    try {
      // waiting 상태의 service worker에게 skipWaiting 메시지 전송
      this.registration.waiting.postMessage({ type: "SKIP_WAITING" });
      console.log("[SW Manager] Update applied, page will reload");
    } catch (error) {
      console.error("[SW Manager] Failed to apply update:", error);
    }
  }

  /**
   * Service Worker 버전 조회
   */
  async getVersion(): Promise<string | null> {
    if (!navigator.serviceWorker.controller) return null;

    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();
      messageChannel.port1.onmessage = (event) => {
        resolve(event.data.version || null);
      };

      navigator.serviceWorker.controller.postMessage({ type: "GET_VERSION" }, [
        messageChannel.port2,
      ]);

      // 5초 타임아웃
      setTimeout(() => resolve(null), 5000);
    });
  }

  /**
   * 캐시 통계 조회
   */
  async getCacheStats(): Promise<CacheStats | null> {
    if (!navigator.serviceWorker.controller) return null;

    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();
      messageChannel.port1.onmessage = (event) => {
        resolve(event.data || null);
      };

      navigator.serviceWorker.controller.postMessage({ type: "CACHE_STATS" }, [
        messageChannel.port2,
      ]);

      // 10초 타임아웃
      setTimeout(() => resolve(null), 10000);
    });
  }

  /**
   * 캐시 정리
   */
  async clearCache(): Promise<boolean> {
    if (!navigator.serviceWorker.controller) return false;

    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();
      messageChannel.port1.onmessage = (event) => {
        resolve(event.data.success || false);
      };

      navigator.serviceWorker.controller.postMessage({ type: "CLEAR_CACHE" }, [
        messageChannel.port2,
      ]);

      // 30초 타임아웃
      setTimeout(() => resolve(false), 30000);
    });
  }

  /**
   * 업데이트 확인
   */
  async checkForUpdates(): Promise<boolean> {
    if (!this.registration) return false;

    try {
      await this.registration.update();
      return this.isUpdateAvailable();
    } catch (error) {
      console.error("[SW Manager] Update check failed:", error);
      return false;
    }
  }

  /**
   * 주기적 업데이트 확인 스케줄링
   */
  private scheduleUpdateChecks(): void {
    // 30분마다 업데이트 확인
    setInterval(
      async () => {
        try {
          const hasUpdate = await this.checkForUpdates();
          if (hasUpdate) {
            console.log(
              "[SW Manager] Scheduled update check found new version",
            );
          }
        } catch (error) {
          console.error("[SW Manager] Scheduled update check failed:", error);
        }
      },
      30 * 60 * 1000,
    );
  }

  /**
   * Service Worker 메시지 처리
   */
  private handleMessage(event: MessageEvent): void {
    const { type, data } = event.data || {};

    switch (type) {
      case "VERSION_INFO":
        console.log("[SW Manager] Version info received:", data);
        break;

      case "CACHE_UPDATE":
        console.log("[SW Manager] Cache updated:", data);
        break;

      default:
        console.log("[SW Manager] Unknown message:", event.data);
    }
  }

  /**
   * 업데이트 핸들러 등록
   */
  onUpdate(handler: (hasUpdate: boolean) => void): () => void {
    this.updateHandlers.push(handler);

    // 구독 해제 함수 반환
    return () => {
      const index = this.updateHandlers.indexOf(handler);
      if (index > -1) {
        this.updateHandlers.splice(index, 1);
      }
    };
  }

  /**
   * 상태 변경 핸들러 등록
   */
  onStateChange(handler: (state: ServiceWorkerState) => void): () => void {
    this.stateHandlers.push(handler);

    // 현재 상태 즉시 전송
    handler(this.getState());

    // 구독 해제 함수 반환
    return () => {
      const index = this.stateHandlers.indexOf(handler);
      if (index > -1) {
        this.stateHandlers.splice(index, 1);
      }
    };
  }

  /**
   * Service Worker 등록 해제
   */
  async unregister(): Promise<boolean> {
    if (!this.registration) return false;

    try {
      const result = await this.registration.unregister();
      console.log("[SW Manager] Service worker unregistered:", result);
      this.registration = null;
      this.notifyStateChange();
      return result;
    } catch (error) {
      console.error("[SW Manager] Failed to unregister service worker:", error);
      return false;
    }
  }
}

/**
 * 기본 인스턴스 내보내기
 */
export const serviceWorkerManager = ServiceWorkerManager.getInstance();

/**
 * Service Worker 초기화 함수
 */
export async function initializeServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  const manager = ServiceWorkerManager.getInstance();

  // 페이지 로드 완료 후 등록
  if (document.readyState === "loading") {
    await new Promise((resolve) => {
      document.addEventListener("DOMContentLoaded", resolve, { once: true });
    });
  }

  return await manager.register();
}

/**
 * 업데이트 알림 UI 표시 함수
 */
export function showUpdateNotification(): void {
  const manager = ServiceWorkerManager.getInstance();

  // 업데이트 사용 가능시 알림
  manager.onUpdate((hasUpdate) => {
    if (!hasUpdate) return;

    // 간단한 확인 다이얼로그 (실제로는 더 나은 UI 구현 권장)
    const shouldUpdate = confirm(
      "새로운 버전이 사용 가능합니다. 지금 업데이트하시겠습니까?",
    );

    if (shouldUpdate) {
      manager.applyUpdate();
    }
  });
}

/**
 * 오프라인 상태 감지 및 알림
 */
export function setupOfflineHandling(): void {
  const updateOnlineStatus = () => {
    const isOnline = navigator.onLine;
    console.log(
      "[SW Manager] Connection status:",
      isOnline ? "online" : "offline",
    );

    // 온라인 상태 변경시 UI 업데이트
    document.body.classList.toggle("is-offline", !isOnline);

    if (isOnline) {
      // 온라인 복구시 백그라운드 동기화 트리거
      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready
          .then((registration) => {
            if ("sync" in registration) {
              return registration.sync.register("todo-sync");
            }
          })
          .catch((error) => {
            console.error(
              "[SW Manager] Background sync registration failed:",
              error,
            );
          });
      }
    }
  };

  // 초기 상태 설정
  updateOnlineStatus();

  // 온라인 상태 변경 감지
  window.addEventListener("online", updateOnlineStatus);
  window.addEventListener("offline", updateOnlineStatus);
}

export default ServiceWorkerManager;
