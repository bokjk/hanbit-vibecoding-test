/**
 * 백엔드 입력 정화 미들웨어
 * XSS 및 인젝션 공격 방지
 */
export class InputSanitizer {
  /**
   * HTML 태그 및 위험한 패턴 완전 제거
   * 사용자 입력 텍스트에 사용
   */
  static sanitizeText(input: string): string {
    return input
      // 스크립트 태그 제거
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      // 모든 HTML 태그 제거
      .replace(/<[^>]*>/g, '')
      // JavaScript URL 프로토콜 제거
      .replace(/javascript:/gi, '')
      // 이벤트 핸들러 제거
      .replace(/on\w+\s*=/gi, '')
      // SQL 인젝션 패턴 제거
      .replace(/(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/gi, '')
      // 특수 문자 이스케이프
      .replace(/[<>"'&]/g, (match) => {
        const escapeMap: Record<string, string> = {
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#x27;',
          '&': '&amp;'
        };
        return escapeMap[match] || match;
      })
      // 연속 공백 제거
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * 제한적 HTML 허용 (안전한 태그만)
   * 서식이 필요한 텍스트에 사용
   */
  static sanitizeHtml(input: string): string {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const allowedTags = ['b', 'i', 'em', 'strong', 'p', 'br'];
    
    return input
      // 허용되지 않은 태그 제거
      .replace(/<(?!\/?(?:${allowedTags.join('|')})\b)[^>]*>/gi, '')
      // 스크립트 및 위험한 패턴 제거
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();
  }

  /**
   * 파일 경로 정화 (경로 탐색 공격 방지)
   */
  static sanitizePath(path: string): string {
    return path
      // 상위 디렉토리 접근 패턴 제거
      .replace(/\.\.\/|\.\.\\|\.\./g, '')
      // 절대 경로 변환 방지
      .replace(/^\/+|^\\+/g, '')
      // 특수 문자 제거
      .replace(/[<>"'|?*]/g, '')
      // 연속 슬래시 제거
      .replace(/\/+/g, '/')
      .trim();
  }

  /**
   * 이메일 주소 정화 및 검증
   */
  static sanitizeEmail(email: string): string {
    return email
      .toLowerCase()
      .replace(/[<>"'&]/g, '')
      .trim();
  }

  /**
   * 전화번호 정화 (숫자와 특정 문자만 허용)
   */
  static sanitizePhone(phone: string): string {
    return phone.replace(/[^\d+\-()\\s]/g, '').trim();
  }

  /**
   * SQL 인젝션 방지를 위한 쿼리 정화
   * DynamoDB 사용 시에는 필요 없지만, 다른 DB 사용 시 대비
   */
  static sanitizeQuery(query: string): string {
    return query
      .replace(/['";\\]/g, '')
      .replace(/(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/gi, '')
      .trim();
  }

  /**
   * 객체의 모든 문자열 필드 정화
   */
  static sanitizeObject(obj: unknown): unknown {
    if (typeof obj === 'string') {
      return this.sanitizeText(obj);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }
    
    if (obj && typeof obj === 'object') {
      const sanitized: Record<string, unknown> = {};
      
      for (const [key, value] of Object.entries(obj)) {
        // 키 이름도 정화
        const sanitizedKey = this.sanitizeText(key);
        
        if (typeof value === 'string') {
          // 필드별 적절한 정화 방법 선택
          if (['title', 'description', 'content'].includes(sanitizedKey)) {
            sanitized[sanitizedKey] = this.sanitizeHtml(value);
          } else if (sanitizedKey === 'email') {
            sanitized[sanitizedKey] = this.sanitizeEmail(value);
          } else if (sanitizedKey === 'phone') {
            sanitized[sanitizedKey] = this.sanitizePhone(value);
          } else {
            sanitized[sanitizedKey] = this.sanitizeText(value);
          }
        } else {
          sanitized[sanitizedKey] = this.sanitizeObject(value);
        }
      }
      
      return sanitized;
    }
    
    return obj;
  }

  /**
   * 입력 크기 검증 (DoS 공격 방지)
   */
  static validateInputSize(input: string, maxSize: number = 10000): boolean {
    return Buffer.byteLength(input, 'utf8') <= maxSize;
  }

  /**
   * 위험한 패턴 탐지
   */
  static detectMaliciousPattern(input: string): {
    isSafe: boolean;
    detectedPatterns: string[];
  } {
    const dangerousPatterns = [
      { pattern: /<script/i, name: 'script-tag' },
      { pattern: /javascript:/i, name: 'javascript-protocol' },
      { pattern: /on\w+\s*=/i, name: 'event-handler' },
      { pattern: /\b(union|select|insert|update|delete)\b/i, name: 'sql-injection' },
      { pattern: /\.\.\//g, name: 'path-traversal' },
      { pattern: /<%[\s\S]*%>/g, name: 'server-side-template' }
    ];

    const detectedPatterns: string[] = [];
    
    for (const { pattern, name } of dangerousPatterns) {
      if (pattern.test(input)) {
        detectedPatterns.push(name);
      }
    }

    return {
      isSafe: detectedPatterns.length === 0,
      detectedPatterns
    };
  }
}

/**
 * 보안 검증 에러
 */
export class SecurityValidationError extends Error {
  constructor(
    message: string,
    public readonly detectedPatterns: string[],
    public readonly originalInput: string
  ) {
    super(message);
    this.name = 'SecurityValidationError';
  }
}

/**
 * Express 미들웨어 형태의 입력 정화기
 */
export class SecurityMiddleware {
  /**
   * 요청 본문 정화
   */
  static sanitizeRequestBody(body: unknown): unknown {
    const sanitized = InputSanitizer.sanitizeObject(body);
    
    // 위험한 패턴 검증
    if (typeof sanitized === 'object' && sanitized !== null) {
      for (const [, value] of Object.entries(sanitized)) {
        if (typeof value === 'string') {
          const validation = InputSanitizer.detectMaliciousPattern(value);
          if (!validation.isSafe) {
            throw new SecurityValidationError(
              `위험한 패턴이 탐지되었습니다: ${validation.detectedPatterns.join(', ')}`,
              validation.detectedPatterns,
              value
            );
          }
        }
      }
    }
    
    return sanitized;
  }

  /**
   * 쿼리 파라미터 정화
   */
  static sanitizeQueryParams(params: Record<string, string | undefined>): Record<string, string | undefined> {
    const sanitized: Record<string, string | undefined> = {};
    
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string') {
        sanitized[InputSanitizer.sanitizeText(key)] = InputSanitizer.sanitizeText(value);
      }
    }
    
    return sanitized;
  }

  /**
   * 경로 파라미터 정화
   */
  static sanitizePathParams(params: Record<string, string | undefined>): Record<string, string | undefined> {
    const sanitized: Record<string, string | undefined> = {};
    
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string') {
        sanitized[key] = InputSanitizer.sanitizePath(value);
      }
    }
    
    return sanitized;
  }
}