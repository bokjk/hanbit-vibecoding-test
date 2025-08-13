/**
 * Hanbit TODO Service Worker
 * PWA 지원, 오프라인 기능, 캐싱 전략 구현
 */

const CACHE_VERSION = "v1.0.0";
const CACHE_NAME = `hanbit-todo-${CACHE_VERSION}`;

// 캐싱할 정적 자산들
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  // CSS와 JS 파일들은 빌드 시 동적으로 추가됨
];

// API 캐시 설정
const API_CACHE_NAME = `hanbit-todo-api-${CACHE_VERSION}`;
const API_CACHE_DURATION = 5 * 60 * 1000; // 5분

// 이미지 캐시 설정
const IMAGE_CACHE_NAME = `hanbit-todo-images-${CACHE_VERSION}`;
const IMAGE_CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7일

// 폰트 캐시 설정
const FONT_CACHE_NAME = `hanbit-todo-fonts-${CACHE_VERSION}`;

/**
 * Service Worker 설치
 */
self.addEventListener("install", (event) => {
  console.log("[SW] Installing service worker version:", CACHE_VERSION);

  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);

        // 정적 자산 캐싱
        await cache.addAll(STATIC_ASSETS);
        console.log("[SW] Static assets cached successfully");

        // 새 서비스 워커를 즉시 활성화
        await self.skipWaiting();
      } catch (error) {
        console.error("[SW] Installation failed:", error);
      }
    })(),
  );
});

/**
 * Service Worker 활성화
 */
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating service worker version:", CACHE_VERSION);

  event.waitUntil(
    (async () => {
      try {
        // 오래된 캐시 정리
        const cacheNames = await caches.keys();
        const deletionPromises = cacheNames
          .filter(
            (cacheName) =>
              cacheName.startsWith("hanbit-todo-") &&
              !cacheName.includes(CACHE_VERSION),
          )
          .map((cacheName) => {
            console.log("[SW] Deleting old cache:", cacheName);
            return caches.delete(cacheName);
          });

        await Promise.all(deletionPromises);

        // 모든 클라이언트에서 새 서비스 워커 사용
        await self.clients.claim();

        console.log("[SW] Service worker activated and ready");
      } catch (error) {
        console.error("[SW] Activation failed:", error);
      }
    })(),
  );
});

/**
 * 네트워크 요청 가로채기
 */
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Chrome extension 요청은 무시
  if (url.protocol === "chrome-extension:") {
    return;
  }

  event.respondWith(handleRequest(request));
});

/**
 * 요청 처리 전략
 */
async function handleRequest(request) {
  const url = new URL(request.url);

  try {
    // API 요청 처리
    if (url.pathname.startsWith("/api/")) {
      return await handleApiRequest(request);
    }

    // 정적 자산 처리
    if (isStaticAsset(request)) {
      return await handleStaticAsset(request);
    }

    // 이미지 처리
    if (isImageRequest(request)) {
      return await handleImageRequest(request);
    }

    // 폰트 처리
    if (isFontRequest(request)) {
      return await handleFontRequest(request);
    }

    // HTML 문서 처리 (SPA 라우팅)
    if (request.mode === "navigate") {
      return await handleNavigationRequest(request);
    }

    // 기본: 네트워크 우선 전략
    return await networkFirst(request, CACHE_NAME);
  } catch (error) {
    console.error("[SW] Request handling failed:", error);

    // 오프라인 폴백
    if (request.mode === "navigate") {
      const cache = await caches.open(CACHE_NAME);
      return (
        (await cache.match("/index.html")) ||
        new Response("오프라인 상태입니다.", {
          status: 503,
          statusText: "Service Unavailable",
        })
      );
    }

    return new Response("요청을 처리할 수 없습니다.", {
      status: 503,
      statusText: "Service Unavailable",
    });
  }
}

/**
 * API 요청 처리 - Stale While Revalidate 전략
 */
async function handleApiRequest(request) {
  const cache = await caches.open(API_CACHE_NAME);

  // GET 요청만 캐싱
  if (request.method !== "GET") {
    try {
      return await fetch(request);
    } catch (error) {
      console.error("[SW] API request failed:", error);
      throw error;
    }
  }

  // 캐시된 응답 확인
  const cachedResponse = await cache.match(request);

  // 백그라운드에서 업데이트
  const fetchPromise = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        // 응답을 복제해서 캐시에 저장
        const responseToCache = response.clone();
        const responseWithTimestamp = new Response(responseToCache.body, {
          status: responseToCache.status,
          statusText: responseToCache.statusText,
          headers: {
            ...Object.fromEntries(responseToCache.headers.entries()),
            "sw-cached-at": Date.now().toString(),
          },
        });

        await cache.put(request, responseWithTimestamp);
      }
      return response;
    })
    .catch((error) => {
      console.error("[SW] API network request failed:", error);
      return null;
    });

  // 캐시된 응답이 있고 아직 유효하면 즉시 반환
  if (cachedResponse && isCacheValid(cachedResponse, API_CACHE_DURATION)) {
    // 백그라운드 업데이트는 계속 진행
    fetchPromise.catch(() => {}); // 에러 무시
    return cachedResponse;
  }

  // 네트워크 응답 우선 반환
  const networkResponse = await fetchPromise;
  if (networkResponse) {
    return networkResponse;
  }

  // 네트워크 실패 시 만료된 캐시라도 반환
  if (cachedResponse) {
    console.log("[SW] Returning stale cache for API request");
    return cachedResponse;
  }

  throw new Error("네트워크와 캐시 모두 사용할 수 없습니다.");
}

/**
 * 정적 자산 처리 - Cache First 전략
 */
async function handleStaticAsset(request) {
  const cache = await caches.open(CACHE_NAME);

  // 캐시 확인
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  // 네트워크에서 가져와서 캐시
  try {
    const response = await fetch(request);
    if (response.ok) {
      const responseToCache = response.clone();
      await cache.put(request, responseToCache);
    }
    return response;
  } catch (error) {
    console.error("[SW] Static asset fetch failed:", error);
    throw error;
  }
}

/**
 * 이미지 처리 - Cache First with Fallback 전략
 */
async function handleImageRequest(request) {
  const cache = await caches.open(IMAGE_CACHE_NAME);

  // 캐시 확인
  const cachedResponse = await cache.match(request);
  if (cachedResponse && isCacheValid(cachedResponse, IMAGE_CACHE_DURATION)) {
    return cachedResponse;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const responseToCache = response.clone();
      const responseWithTimestamp = new Response(responseToCache.body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers: {
          ...Object.fromEntries(responseToCache.headers.entries()),
          "sw-cached-at": Date.now().toString(),
        },
      });

      await cache.put(request, responseWithTimestamp);
    }
    return response;
  } catch (error) {
    console.error("[SW] Image fetch failed:", error);

    // 만료된 캐시라도 반환
    if (cachedResponse) {
      return cachedResponse;
    }

    // 기본 이미지 반환 (옵션)
    throw error;
  }
}

/**
 * 폰트 처리 - Cache First 전략 (장기 캐싱)
 */
async function handleFontRequest(request) {
  const cache = await caches.open(FONT_CACHE_NAME);

  // 캐시 확인
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const responseToCache = response.clone();
      await cache.put(request, responseToCache);
    }
    return response;
  } catch (error) {
    console.error("[SW] Font fetch failed:", error);
    throw error;
  }
}

/**
 * 네비게이션 요청 처리 (SPA 지원)
 */
async function handleNavigationRequest(request) {
  try {
    // 네트워크 우선 시도
    const response = await fetch(request);
    return response;
  } catch (error) {
    console.log("[SW] Navigation request failed, serving cached index.html");

    // 오프라인 시 index.html 반환
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match("/index.html");

    if (cachedResponse) {
      return cachedResponse;
    }

    // 최후 수단: 오프라인 페이지
    return new Response(
      `
      <!DOCTYPE html>
      <html>
        <head>
          <title>오프라인 - Hanbit TODO</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              background: #f3f4f6;
            }
            .offline-message {
              text-align: center;
              padding: 2rem;
              background: white;
              border-radius: 0.5rem;
              box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            .retry-btn {
              margin-top: 1rem;
              padding: 0.5rem 1rem;
              background: #3b82f6;
              color: white;
              border: none;
              border-radius: 0.25rem;
              cursor: pointer;
            }
          </style>
        </head>
        <body>
          <div class="offline-message">
            <h1>오프라인 상태입니다</h1>
            <p>인터넷 연결을 확인해주세요.</p>
            <button class="retry-btn" onclick="window.location.reload()">다시 시도</button>
          </div>
        </body>
      </html>
    `,
      {
        headers: { "Content-Type": "text/html" },
      },
    );
  }
}

/**
 * 네트워크 우선 전략
 */
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);

  try {
    const response = await fetch(request);
    if (response.ok) {
      const responseToCache = response.clone();
      await cache.put(request, responseToCache);
    }
    return response;
  } catch (error) {
    console.log("[SW] Network failed, trying cache");
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

/**
 * 캐시 유효성 검사
 */
function isCacheValid(response, maxAge) {
  const cachedAt = response.headers.get("sw-cached-at");
  if (!cachedAt) return false;

  const age = Date.now() - parseInt(cachedAt, 10);
  return age < maxAge;
}

/**
 * 요청 타입 확인 함수들
 */
function isStaticAsset(request) {
  const url = new URL(request.url);
  return /\.(js|css|html)$/i.test(url.pathname);
}

function isImageRequest(request) {
  const url = new URL(request.url);
  return /\.(jpg|jpeg|png|gif|webp|svg|ico)$/i.test(url.pathname);
}

function isFontRequest(request) {
  const url = new URL(request.url);
  return /\.(woff|woff2|eot|ttf|otf)$/i.test(url.pathname);
}

/**
 * 메시지 처리 (클라이언트와 통신)
 */
self.addEventListener("message", (event) => {
  const { type, data } = event.data || {};

  switch (type) {
    case "SKIP_WAITING":
      self.skipWaiting();
      break;

    case "GET_VERSION":
      event.ports[0].postMessage({ version: CACHE_VERSION });
      break;

    case "CLEAR_CACHE":
      clearCaches()
        .then(() => {
          event.ports[0].postMessage({ success: true });
        })
        .catch((error) => {
          event.ports[0].postMessage({ success: false, error: error.message });
        });
      break;

    case "CACHE_STATS":
      getCacheStats().then((stats) => {
        event.ports[0].postMessage(stats);
      });
      break;
  }
});

/**
 * 캐시 통계 조회
 */
async function getCacheStats() {
  const cacheNames = await caches.keys();
  const stats = {};

  for (const cacheName of cacheNames) {
    if (cacheName.startsWith("hanbit-todo-")) {
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();
      stats[cacheName] = {
        count: keys.length,
        urls: keys.map((req) => req.url),
      };
    }
  }

  return stats;
}

/**
 * 모든 캐시 정리
 */
async function clearCaches() {
  const cacheNames = await caches.keys();
  const deletionPromises = cacheNames
    .filter((cacheName) => cacheName.startsWith("hanbit-todo-"))
    .map((cacheName) => caches.delete(cacheName));

  await Promise.all(deletionPromises);
  console.log("[SW] All caches cleared");
}

/**
 * 백그라운드 동기화 지원
 */
self.addEventListener("sync", (event) => {
  console.log("[SW] Background sync triggered:", event.tag);

  if (event.tag === "todo-sync") {
    event.waitUntil(syncTodos());
  }
});

/**
 * TODO 동기화 (오프라인에서 생성된 데이터)
 */
async function syncTodos() {
  try {
    // IndexedDB에서 오프라인으로 생성된 TODO들을 가져와서 서버에 동기화
    // 이 부분은 클라이언트 측에서 IndexedDB를 구현한 후 연동 필요
    console.log("[SW] TODO synchronization completed");
  } catch (error) {
    console.error("[SW] TODO synchronization failed:", error);
    throw error; // 재시도를 위해 에러를 다시 throw
  }
}

/**
 * 푸시 알림 처리
 */
self.addEventListener("push", (event) => {
  console.log("[SW] Push message received");

  const options = {
    body: "새로운 알림이 있습니다.",
    icon: "/icon-192x192.png",
    badge: "/badge-72x72.png",
    tag: "hanbit-todo-notification",
    requireInteraction: false,
    actions: [
      {
        action: "open",
        title: "열기",
        icon: "/icon-open.png",
      },
      {
        action: "close",
        title: "닫기",
        icon: "/icon-close.png",
      },
    ],
  };

  if (event.data) {
    try {
      const data = event.data.json();
      options.body = data.message || options.body;
      options.tag = data.tag || options.tag;
    } catch (error) {
      console.error("[SW] Failed to parse push data:", error);
    }
  }

  event.waitUntil(self.registration.showNotification("Hanbit TODO", options));
});

/**
 * 알림 클릭 처리
 */
self.addEventListener("notificationclick", (event) => {
  console.log("[SW] Notification clicked:", event.action);

  event.notification.close();

  if (event.action === "open" || !event.action) {
    event.waitUntil(
      clients.openWindow("/"), // TODO 앱으로 이동
    );
  }
});

console.log("[SW] Service Worker script loaded");
