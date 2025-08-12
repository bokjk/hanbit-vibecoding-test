import { randomBytes } from 'crypto';

/**
 * CSP Nonce 생성 및 관리 유틸리티
 */
export class CSPNonce {
  /**
   * 보안 nonce 생성
   */
  static generate(): string {
    return randomBytes(16).toString('base64');
  }

  /**
   * 요청별 고유 nonce 생성 (요청 ID 기반)
   */
  static generateForRequest(requestId: string): string {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const hash = require('crypto')
      .createHash('sha256')
      .update(requestId + Date.now() + Math.random())
      .digest('base64')
      .substring(0, 16);
    
    return hash;
  }

  /**
   * nonce 기반 CSP 정책 생성
   */
  static generateCSPWithNonce(nonce: string, options: {
    allowInlineStyles?: boolean;
    allowUnsafeEval?: boolean;
    additionalScriptSrc?: string[];
    additionalStyleSrc?: string[];
    reportUri?: string;
  } = {}): string {
    const {
      allowInlineStyles = false,
      allowUnsafeEval = false,
      additionalScriptSrc = [],
      additionalStyleSrc = [],
      reportUri
    } = options;

    const scriptSrc = [
      "'self'",
      `'nonce-${nonce}'`,
      ...(allowUnsafeEval ? ["'unsafe-eval'"] : []),
      ...additionalScriptSrc
    ].join(' ');

    const styleSrc = [
      "'self'",
      `'nonce-${nonce}'`,
      ...(allowInlineStyles ? ["'unsafe-inline'"] : []),
      ...additionalStyleSrc
    ].join(' ');

    const directives = [
      `default-src 'self'`,
      `script-src ${scriptSrc}`,
      `style-src ${styleSrc}`,
      `img-src 'self' data: https:`,
      `font-src 'self' data:`,
      `connect-src 'self' https:`,
      `media-src 'self'`,
      `object-src 'none'`,
      `child-src 'none'`,
      `frame-src 'none'`,
      `worker-src 'self'`,
      `frame-ancestors 'none'`,
      `form-action 'self'`,
      `base-uri 'self'`,
      `manifest-src 'self'`
    ];

    if (reportUri) {
      directives.push(`report-uri ${reportUri}`);
      directives.push(`report-to csp-endpoint`);
    }

    return directives.join('; ');
  }

  /**
   * 환경별 CSP 설정
   */
  static getEnvironmentCSP(environment: 'development' | 'staging' | 'production', nonce?: string): string {
    const baseConfig = {
      development: {
        allowInlineStyles: true,
        allowUnsafeEval: true,
        additionalScriptSrc: ["'unsafe-inline'", "localhost:*", "127.0.0.1:*"],
        additionalStyleSrc: ["'unsafe-inline'", "localhost:*"]
      },
      staging: {
        allowInlineStyles: true,
        allowUnsafeEval: false,
        additionalScriptSrc: ["staging.todoapp.hanbit.com"],
        additionalStyleSrc: ["staging.todoapp.hanbit.com"],
        reportUri: "https://staging.todoapp.hanbit.com/csp-report"
      },
      production: {
        allowInlineStyles: false,
        allowUnsafeEval: false,
        additionalScriptSrc: ["todoapp.hanbit.com", "cdn.jsdelivr.net"],
        additionalStyleSrc: ["todoapp.hanbit.com", "fonts.googleapis.com"],
        reportUri: "https://todoapp.hanbit.com/csp-report"
      }
    };

    const config = baseConfig[environment];

    if (nonce) {
      return this.generateCSPWithNonce(nonce, config);
    }

    // nonce가 없는 경우 기본 CSP
    return this.generateBasicCSP(environment, config);
  }

  /**
   * 기본 CSP 정책 (nonce 없음)
   */
  private static generateBasicCSP(environment: string, config: {
    allowUnsafeEval?: boolean;
    allowUnsafeInline?: boolean;
    allowedDomains?: string[];
    additionalScriptSrc?: string[];
    additionalStyleSrc?: string[];
    allowInlineStyles?: boolean;
  }): string {
    const scriptSrc = [
      "'self'",
      ...(config.allowUnsafeEval ? ["'unsafe-eval'"] : []),
      ...(environment === 'development' ? ["'unsafe-inline'"] : []),
      ...(config.additionalScriptSrc || [])
    ].join(' ');

    const styleSrc = [
      "'self'",
      ...(config.allowInlineStyles ? ["'unsafe-inline'"] : []),
      ...(config.additionalStyleSrc || [])
    ].join(' ');

    const directives = [
      `default-src 'self'`,
      `script-src ${scriptSrc}`,
      `style-src ${styleSrc}`,
      `img-src 'self' data: https:`,
      `font-src 'self' data:`,
      `connect-src 'self' https:`,
      `frame-ancestors 'none'`,
      `base-uri 'self'`
    ];

    if (config.reportUri) {
      directives.push(`report-uri ${config.reportUri}`);
    }

    return directives.join('; ');
  }

  /**
   * CSP 위반 보고서 처리를 위한 Report-To 헤더 생성
   */
  static generateReportToHeader(reportEndpoint: string): string {
    return JSON.stringify({
      group: "csp-endpoint",
      max_age: 10886400, // 126 days
      endpoints: [
        { url: reportEndpoint }
      ]
    });
  }

  /**
   * HTML에 nonce 속성 추가하기 위한 헬퍼
   */
  static injectNonceIntoHTML(html: string, nonce: string): string {
    // script 태그에 nonce 추가
    html = html.replace(
      /<script(?![^>]*nonce)/gi,
      `<script nonce="${nonce}"`
    );

    // style 태그에 nonce 추가  
    html = html.replace(
      /<style(?![^>]*nonce)/gi,
      `<style nonce="${nonce}"`
    );

    return html;
  }

  /**
   * CSP 위반 감지 및 로깅
   */
  static logCSPViolation(report: {
    'document-uri'?: string;
    referrer?: string;
    'violated-directive'?: string;
    'original-policy'?: string;
    'blocked-uri'?: string;
  }, userAgent?: string, ip?: string): void {
    console.warn('CSP Violation detected:', {
      documentUri: report['document-uri'],
      referrer: report.referrer,
      violatedDirective: report['violated-directive'],
      originalPolicy: report['original-policy'],
      blockedUri: report['blocked-uri'],
      statusCode: report['status-code'],
      userAgent,
      ip,
      timestamp: new Date().toISOString()
    });

    // 심각한 위반의 경우 추가 로깅 또는 알림
    const seriousViolations = ['script-src', 'object-src', 'base-uri'];
    const violatedDirective = report['violated-directive'];
    
    if (seriousViolations.some(directive => violatedDirective.includes(directive))) {
      console.error('Serious CSP violation detected:', {
        directive: violatedDirective,
        blockedUri: report['blocked-uri'],
        userAgent,
        ip
      });
    }
  }
}

/**
 * Lambda 응답에 CSP 헤더 추가하는 헬퍼
 */
export function addCSPToResponse(
  response: { headers?: Record<string, string> },
  requestId: string,
  environment: 'development' | 'staging' | 'production' = 'production'
): { headers: Record<string, string> } {
  const nonce = CSPNonce.generateForRequest(requestId);
  const csp = CSPNonce.getEnvironmentCSP(environment, nonce);
  
  return {
    ...response,
    headers: {
      ...response.headers,
      'Content-Security-Policy': csp,
      'X-Content-Security-Policy': csp, // 레거시 브라우저 지원
      'X-WebKit-CSP': csp, // 웹킷 브라우저 지원
      'X-CSP-Nonce': nonce // 클라이언트에서 nonce 사용 가능
    }
  };
}

/**
 * CSP 위반 보고서 처리 핸들러
 */
export function createCSPReportHandler() {
  return async (event: { 
    body: string; 
    headers: Record<string, string>; 
    requestContext: { identity: { sourceIp: string } } 
  }) => {
    try {
      const report = JSON.parse(event.body)['csp-report'];
      const userAgent = event.headers['User-Agent'];
      const ip = event.requestContext.identity.sourceIp;
      
      CSPNonce.logCSPViolation(report, userAgent, ip);
      
      return {
        statusCode: 204,
        body: ''
      };
    } catch (error) {
      console.error('Error processing CSP report:', error);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid CSP report' })
      };
    }
  };
}