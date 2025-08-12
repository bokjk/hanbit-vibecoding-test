import DOMPurify from "dompurify";

/**
 * 클라이언트 사이드 보안 유틸리티
 */
export class ClientSecurity {
  /**
   * 사용자 입력을 실시간으로 정화 (XSS 방지)
   * TODO 제목, 설명 등에 사용
   */
  static sanitizeUserInput(input: string): string {
    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: ["b", "i", "em", "strong", "br"], // 기본 텍스트 포맷팅만 허용
      ALLOWED_ATTR: [], // 속성은 허용하지 않음
      KEEP_CONTENT: true, // 태그는 제거하되 내용은 유지
      ALLOW_DATA_ATTR: false, // data 속성 차단
    });
  }

  /**
   * 플레인 텍스트 정화 (모든 HTML 태그 제거)
   * 검색, 필터 입력 등에 사용
   */
  static sanitizePlainText(input: string): string {
    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: [], // 모든 태그 제거
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true,
    });
  }

  /**
   * 서버 응답 데이터 정화 (추가 보안 레이어)
   * API 응답을 표시하기 전 정화
   */
  static sanitizeServerResponse(data: unknown): unknown {
    if (typeof data === "string") {
      return this.sanitizeUserInput(data);
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizeServerResponse(item));
    }

    if (data && typeof data === "object") {
      const sanitized: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(data)) {
        if (typeof value === "string") {
          // 제목, 설명 등 텍스트 필드 정화
          if (["title", "description", "content"].includes(key)) {
            sanitized[key] = this.sanitizeUserInput(value);
          } else {
            sanitized[key] = this.sanitizePlainText(value);
          }
        } else {
          sanitized[key] = this.sanitizeServerResponse(value);
        }
      }

      return sanitized;
    }

    return data;
  }

  /**
   * URL 검증 (오픈 리다이렉트 방지)
   */
  static isValidUrl(url: string, allowedDomains: string[] = []): boolean {
    try {
      const parsedUrl = new URL(url);

      // 프로토콜 검증 (https, http만 허용)
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        return false;
      }

      // 허용된 도메인 확인
      if (allowedDomains.length > 0) {
        return allowedDomains.some(
          (domain) =>
            parsedUrl.hostname === domain ||
            parsedUrl.hostname.endsWith(`.${domain}`),
        );
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * 민감한 정보 마스킹
   * 로그 출력 시 사용
   */
  static maskSensitiveData(data: string, visibleChars: number = 4): string {
    if (data.length <= visibleChars) {
      return "*".repeat(data.length);
    }

    const maskedLength = data.length - visibleChars;
    const visiblePart = data.slice(-visibleChars);

    return "*".repeat(maskedLength) + visiblePart;
  }
}

/**
 * React 컴포넌트용 보안 훅
 */
export function useSafeInput() {
  const sanitizeInput = (input: string): string => {
    return ClientSecurity.sanitizeUserInput(input);
  };

  const sanitizePlainText = (input: string): string => {
    return ClientSecurity.sanitizePlainText(input);
  };

  return {
    sanitizeInput,
    sanitizePlainText,
  };
}

/**
 * 개발 모드에서 보안 경고 표시
 */
export function logSecurityWarning(message: string, data?: unknown): void {
  if (process.env.NODE_ENV === "development") {
    console.warn("🚨 Security Warning:", message, data);
  }
}
