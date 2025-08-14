import { describe, it, expect } from 'vitest';
import {
  InputSanitizer,
  SecurityValidationError,
  SecurityMiddleware,
} from '../../middleware/input-sanitizer';

describe('InputSanitizer', () => {
  // ================================
  // sanitizeText 메서드 테스트
  // ================================

  describe('sanitizeText', () => {
    it('should remove script tags completely', () => {
      const maliciousInput = '<script>alert("xss")</script>Hello World';
      const result = InputSanitizer.sanitizeText(maliciousInput);

      expect(result).toBe('Hello World');
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert');
    });

    it('should remove all HTML tags', () => {
      const htmlInput = '<div>Hello</div><p>World</p><span>!</span>';
      const result = InputSanitizer.sanitizeText(htmlInput);

      expect(result).toBe('Hello World !');
      expect(result).not.toContain('<div>');
      expect(result).not.toContain('<p>');
    });

    it('should remove JavaScript URL protocols', () => {
      const jsInput = 'javascript:alert("xss")';
      const result = InputSanitizer.sanitizeText(jsInput);

      expect(result).toBe('alert(&quot;xss&quot;)');
      expect(result).not.toContain('javascript:');
    });

    it('should remove event handlers', () => {
      const eventInput = 'onclick=alert("xss") onmouseover=steal()';
      const result = InputSanitizer.sanitizeText(eventInput);

      expect(result).not.toContain('onclick=');
      expect(result).not.toContain('onmouseover=');
    });

    it('should remove SQL injection patterns', () => {
      const sqlInput = 'DROP TABLE users; SELECT * FROM passwords;';
      const result = InputSanitizer.sanitizeText(sqlInput);

      expect(result).not.toContain('DROP');
      expect(result).not.toContain('SELECT');
      expect(result).not.toContain('TABLE');
    });

    it('should escape special characters', () => {
      const specialInput = '<>"\'&';
      const result = InputSanitizer.sanitizeText(specialInput);

      expect(result).toBe('&lt;&gt;&quot;&#x27;&amp;');
    });

    it('should normalize whitespace', () => {
      const whitespaceInput = '  Hello    World   \n\t  ';
      const result = InputSanitizer.sanitizeText(whitespaceInput);

      expect(result).toBe('Hello World');
    });

    it('should handle empty and null-like inputs', () => {
      expect(InputSanitizer.sanitizeText('')).toBe('');
      expect(InputSanitizer.sanitizeText('   ')).toBe('');
    });

    it('should preserve safe text content', () => {
      const safeInput = '안전한 한글 텍스트 123';
      const result = InputSanitizer.sanitizeText(safeInput);

      expect(result).toBe('안전한 한글 텍스트 123');
    });
  });

  // ================================
  // sanitizeHtml 메서드 테스트
  // ================================

  describe('sanitizeHtml', () => {
    it('should allow safe HTML tags', () => {
      const safeHtml = '<b>Bold</b> <i>Italic</i> <em>Emphasis</em>';
      const result = InputSanitizer.sanitizeHtml(safeHtml);

      // 허용된 태그들은 유지되어야 함
      expect(result).toContain('<b>');
      expect(result).toContain('<i>');
      expect(result).toContain('<em>');
    });

    it('should remove dangerous HTML tags', () => {
      const dangerousHtml = '<script>alert("xss")</script><div>content</div>';
      const result = InputSanitizer.sanitizeHtml(dangerousHtml);

      expect(result).not.toContain('<script>');
      expect(result).not.toContain('<div>');
      expect(result).toContain('content');
    });

    it('should remove JavaScript and event handlers', () => {
      const jsHtml = '<p onclick="alert()">Click me</p>';
      const result = InputSanitizer.sanitizeHtml(jsHtml);

      expect(result).not.toContain('onclick');
      expect(result).not.toContain('javascript:');
    });
  });

  // ================================
  // sanitizePath 메서드 테스트
  // ================================

  describe('sanitizePath', () => {
    it('should prevent directory traversal attacks', () => {
      const traversalPath = '../../etc/passwd';
      const result = InputSanitizer.sanitizePath(traversalPath);

      expect(result).toBe('etc/passwd');
      expect(result).not.toContain('../');
    });

    it('should remove absolute path indicators', () => {
      const absolutePath = '/root/sensitive/file.txt';
      const result = InputSanitizer.sanitizePath(absolutePath);

      expect(result).toBe('root/sensitive/file.txt');
      expect(result).not.toMatch(/^\/+/);
    });

    it('should remove dangerous characters', () => {
      const dangerousPath = 'file<script>|name?.txt';
      const result = InputSanitizer.sanitizePath(dangerousPath);

      expect(result).toBe('filename.txt');
      expect(result).not.toContain('<');
      expect(result).not.toContain('|');
      expect(result).not.toContain('?');
    });

    it('should normalize multiple slashes', () => {
      const messyPath = 'folder///subfolder//file.txt';
      const result = InputSanitizer.sanitizePath(messyPath);

      expect(result).toBe('folder/subfolder/file.txt');
    });
  });

  // ================================
  // sanitizeEmail 메서드 테스트
  // ================================

  describe('sanitizeEmail', () => {
    it('should normalize email to lowercase', () => {
      const email = 'User@Example.COM';
      const result = InputSanitizer.sanitizeEmail(email);

      expect(result).toBe('user@example.com');
    });

    it('should remove dangerous characters', () => {
      const maliciousEmail = 'user<script>@evil.com';
      const result = InputSanitizer.sanitizeEmail(maliciousEmail);

      expect(result).toBe('user@evil.com');
      expect(result).not.toContain('<script>');
    });
  });

  // ================================
  // sanitizePhone 메서드 테스트
  // ================================

  describe('sanitizePhone', () => {
    it('should keep only valid phone characters', () => {
      const messyPhone = '+1-abc(555)def-123-4567xyz';
      const result = InputSanitizer.sanitizePhone(messyPhone);

      expect(result).toBe('+1-(555)-123-4567');
    });

    it('should remove letters and special characters', () => {
      const phone = '010<script>1234</script>5678';
      const result = InputSanitizer.sanitizePhone(phone);

      expect(result).toBe('01012345678');
    });
  });

  // ================================
  // sanitizeQuery 메서드 테스트
  // ================================

  describe('sanitizeQuery', () => {
    it('should remove SQL injection patterns', () => {
      const sqlQuery = "'; DROP TABLE users; --";
      const result = InputSanitizer.sanitizeQuery(sqlQuery);

      expect(result).not.toContain('DROP');
      expect(result).not.toContain("'");
      expect(result).not.toContain(';');
    });

    it('should preserve safe query content', () => {
      const safeQuery = 'search todo items';
      const result = InputSanitizer.sanitizeQuery(safeQuery);

      expect(result).toBe('search todo items');
    });
  });

  // ================================
  // sanitizeObject 메서드 테스트
  // ================================

  describe('sanitizeObject', () => {
    it('should sanitize string values in objects', () => {
      const maliciousObject = {
        title: '<script>alert("xss")</script>Todo Title',
        description: '<b>Bold description</b>',
        email: 'USER@EXAMPLE.COM',
        phone: 'abc123-456-7890xyz',
      };

      const result = InputSanitizer.sanitizeObject(maliciousObject) as any;

      expect(result.title).toContain('<b>Bold description</b>'); // HTML 허용 필드
      expect(result.title).not.toContain('<script>');
      expect(result.email).toBe('user@example.com');
      expect(result.phone).toBe('123-456-7890');
    });

    it('should handle nested objects', () => {
      const nestedObject = {
        user: {
          name: '<script>alert("xss")</script>John',
          details: {
            bio: '<i>Developer</i>',
          },
        },
      };

      const result = InputSanitizer.sanitizeObject(nestedObject) as any;

      expect(result.user.name).toBe('John');
      expect(result.user.details.bio).toContain('<i>Developer</i>');
    });

    it('should handle arrays', () => {
      const arrayObject = {
        tags: ['<script>evil</script>', 'safe-tag', '<b>bold</b>'],
      };

      const result = InputSanitizer.sanitizeObject(arrayObject) as any;

      expect(result.tags[0]).toBe('evil');
      expect(result.tags[1]).toBe('safe-tag');
      expect(result.tags[2]).toBe('bold'); // HTML 제거됨 (title 필드가 아니므로)
    });

    it('should handle primitive values', () => {
      expect(InputSanitizer.sanitizeObject('test')).toBe('test');
      expect(InputSanitizer.sanitizeObject(123)).toBe(123);
      expect(InputSanitizer.sanitizeObject(true)).toBe(true);
      expect(InputSanitizer.sanitizeObject(null)).toBe(null);
    });
  });

  // ================================
  // validateInputSize 메서드 테스트
  // ================================

  describe('validateInputSize', () => {
    it('should accept input within size limit', () => {
      const smallInput = 'small text';
      const result = InputSanitizer.validateInputSize(smallInput, 100);

      expect(result).toBe(true);
    });

    it('should reject input exceeding size limit', () => {
      const largeInput = 'x'.repeat(10001);
      const result = InputSanitizer.validateInputSize(largeInput);

      expect(result).toBe(false);
    });

    it('should handle UTF-8 byte length correctly', () => {
      const unicodeInput = '한글'.repeat(1000); // 한글은 3바이트씩
      const result = InputSanitizer.validateInputSize(unicodeInput, 2000);

      expect(result).toBe(false); // 3000 바이트이므로 false
    });
  });

  // ================================
  // detectMaliciousPattern 메서드 테스트
  // ================================

  describe('detectMaliciousPattern', () => {
    it('should detect script tags', () => {
      const maliciousInput = '<script>alert("xss")</script>';
      const result = InputSanitizer.detectMaliciousPattern(maliciousInput);

      expect(result.isSafe).toBe(false);
      expect(result.detectedPatterns).toContain('script-tag');
    });

    it('should detect JavaScript protocols', () => {
      const maliciousInput = 'javascript:alert("xss")';
      const result = InputSanitizer.detectMaliciousPattern(maliciousInput);

      expect(result.isSafe).toBe(false);
      expect(result.detectedPatterns).toContain('javascript-protocol');
    });

    it('should detect event handlers', () => {
      const maliciousInput = 'onclick=alert("xss")';
      const result = InputSanitizer.detectMaliciousPattern(maliciousInput);

      expect(result.isSafe).toBe(false);
      expect(result.detectedPatterns).toContain('event-handler');
    });

    it('should detect SQL injection', () => {
      const maliciousInput = 'DROP TABLE users';
      const result = InputSanitizer.detectMaliciousPattern(maliciousInput);

      expect(result.isSafe).toBe(false);
      expect(result.detectedPatterns).toContain('sql-injection');
    });

    it('should detect path traversal', () => {
      const maliciousInput = '../../etc/passwd';
      const result = InputSanitizer.detectMaliciousPattern(maliciousInput);

      expect(result.isSafe).toBe(false);
      expect(result.detectedPatterns).toContain('path-traversal');
    });

    it('should detect server-side template injection', () => {
      const maliciousInput = '<% eval("malicious code") %>';
      const result = InputSanitizer.detectMaliciousPattern(maliciousInput);

      expect(result.isSafe).toBe(false);
      expect(result.detectedPatterns).toContain('server-side-template');
    });

    it('should return safe for clean input', () => {
      const cleanInput = '안전한 TODO 아이템입니다';
      const result = InputSanitizer.detectMaliciousPattern(cleanInput);

      expect(result.isSafe).toBe(true);
      expect(result.detectedPatterns).toHaveLength(0);
    });

    it('should detect multiple patterns', () => {
      const multiMalicious = '<script>alert("xss")</script>javascript:void(0)';
      const result = InputSanitizer.detectMaliciousPattern(multiMalicious);

      expect(result.isSafe).toBe(false);
      expect(result.detectedPatterns).toContain('script-tag');
      expect(result.detectedPatterns).toContain('javascript-protocol');
    });
  });
});

describe('SecurityValidationError', () => {
  it('should create error with detected patterns and original input', () => {
    const detectedPatterns = ['script-tag', 'javascript-protocol'];
    const originalInput = '<script>alert("xss")</script>';
    const message = 'Security validation failed';

    const error = new SecurityValidationError(message, detectedPatterns, originalInput);

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('SecurityValidationError');
    expect(error.message).toBe(message);
    expect(error.detectedPatterns).toEqual(detectedPatterns);
    expect(error.originalInput).toBe(originalInput);
  });
});

describe('SecurityMiddleware', () => {
  // ================================
  // sanitizeRequestBody 메서드 테스트
  // ================================

  describe('sanitizeRequestBody', () => {
    it('should sanitize request body successfully', () => {
      const requestBody = {
        title: '안전한 제목',
        description: '<i>설명</i>',
        tags: ['tag1', 'tag2'],
      };

      const result = SecurityMiddleware.sanitizeRequestBody(requestBody);

      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    it('should throw SecurityValidationError for malicious content', () => {
      const maliciousBody = {
        title: '<script>alert("xss")</script>Malicious Title',
      };

      expect(() => {
        SecurityMiddleware.sanitizeRequestBody(maliciousBody);
      }).toThrow(SecurityValidationError);
    });

    it('should provide detailed error information', () => {
      const maliciousBody = {
        title: '<script>alert("xss")</script>Bad Content',
      };

      try {
        SecurityMiddleware.sanitizeRequestBody(maliciousBody);
        expect.fail('Should have thrown SecurityValidationError');
      } catch (error) {
        expect(error).toBeInstanceOf(SecurityValidationError);
        expect((error as SecurityValidationError).detectedPatterns).toContain('script-tag');
        expect((error as SecurityValidationError).originalInput).toContain('<script>');
      }
    });

    it('should handle non-object inputs safely', () => {
      expect(SecurityMiddleware.sanitizeRequestBody('simple string')).toBe('simple string');
      expect(SecurityMiddleware.sanitizeRequestBody(null)).toBe(null);
      expect(SecurityMiddleware.sanitizeRequestBody(undefined)).toBe(undefined);
    });
  });

  // ================================
  // sanitizeQueryParams 메서드 테스트
  // ================================

  describe('sanitizeQueryParams', () => {
    it('should sanitize query parameters', () => {
      const queryParams = {
        search: '<script>evil</script>search term',
        filter: 'active',
        sort: 'priority',
      };

      const result = SecurityMiddleware.sanitizeQueryParams(queryParams);

      expect(result.search).toBe('search term');
      expect(result.filter).toBe('active');
      expect(result.sort).toBe('priority');
    });

    it('should handle undefined values', () => {
      const queryParams = {
        search: 'term',
        undefined_param: undefined,
      };

      const result = SecurityMiddleware.sanitizeQueryParams(queryParams);

      expect(result.search).toBe('term');
      expect(result.undefined_param).toBe(undefined);
    });

    it('should sanitize parameter names', () => {
      const queryParams = {
        '<script>evil_key</script>': 'value',
      };

      const result = SecurityMiddleware.sanitizeQueryParams(queryParams);

      // 키 이름도 정화되어야 함
      const keys = Object.keys(result);
      expect(keys[0]).not.toContain('<script>');
      expect(keys[0]).toBe('evil_key');
    });
  });

  // ================================
  // sanitizePathParams 메서드 테스트
  // ================================

  describe('sanitizePathParams', () => {
    it('should sanitize path parameters', () => {
      const pathParams = {
        userId: '123',
        filename: '../../secret.txt',
      };

      const result = SecurityMiddleware.sanitizePathParams(pathParams);

      expect(result.userId).toBe('123');
      expect(result.filename).toBe('secret.txt');
      expect(result.filename).not.toContain('../');
    });

    it('should handle special path characters', () => {
      const pathParams = {
        path: '/root/file<script>.txt',
      };

      const result = SecurityMiddleware.sanitizePathParams(pathParams);

      expect(result.path).toBe('root/file.txt');
    });
  });

  // ================================
  // 통합 보안 테스트
  // ================================

  describe('Integration Security Tests', () => {
    it('should handle comprehensive malicious payload', () => {
      const comprehensiveMaliciousPayload = {
        title: '<script src="http://evil.com/xss.js"></script>Todo Title',
        description: '"><img src=x onerror=alert("xss")>',
        email: 'ADMIN<script>@evil.com',
        tags: ['javascript:alert("xss")', 'normal-tag'],
        metadata: {
          path: '../../../../etc/passwd',
          query: "'; DROP TABLE todos; --",
        },
      };

      try {
        SecurityMiddleware.sanitizeRequestBody(comprehensiveMaliciousPayload);
        expect.fail('Should have thrown SecurityValidationError');
      } catch (error) {
        expect(error).toBeInstanceOf(SecurityValidationError);
        expect((error as SecurityValidationError).detectedPatterns.length).toBeGreaterThan(0);
      }
    });

    it('should preserve safe content while removing threats', () => {
      const mixedPayload = {
        title: '안전한 할일 제목',
        description: '이것은 <b>안전한</b> 설명입니다',
        priority: 'high',
        tags: ['work', 'urgent'],
      };

      const result = SecurityMiddleware.sanitizeRequestBody(mixedPayload) as any;

      expect(result.title).toBe('안전한 할일 제목');
      expect(result.description).toContain('<b>안전한</b>'); // HTML 허용 필드
      expect(result.priority).toBe('high');
      expect(result.tags).toEqual(['work', 'urgent']);
    });
  });
});
