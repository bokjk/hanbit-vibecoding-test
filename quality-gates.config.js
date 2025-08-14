/**
 * 품질 게이트 설정
 * CI/CD 파이프라인에서 사용되는 품질 임계값 정의
 */

export const qualityGates = {
  // 코드 커버리지 임계값
  coverage: {
    // 전체 커버리지 최소값
    global: {
      statements: 85,
      branches: 80,
      functions: 85,
      lines: 85,
    },
    // 개별 파일 커버리지 최소값
    perFile: {
      statements: 80,
      branches: 75,
      functions: 80,
      lines: 80,
    },
    // 중요한 파일들의 높은 커버리지 요구사항
    critical: {
      patterns: [
        'src/services/**/*.ts',
        'src/contexts/**/*.ts',
        'src/utils/**/*.ts',
        'lambda/services/**/*.ts',
        'lambda/repositories/**/*.ts',
      ],
      statements: 95,
      branches: 90,
      functions: 95,
      lines: 95,
    },
  },

  // 성능 임계값
  performance: {
    // 웹 성능 메트릭 (Lighthouse 기준)
    lighthouse: {
      performance: 90,
      accessibility: 95,
      bestPractices: 90,
      seo: 85,
      pwa: 80,
    },
    // 페이지 로드 성능
    loadTime: {
      // First Contentful Paint (ms)
      fcp: 1500,
      // Largest Contentful Paint (ms)
      lcp: 2500,
      // First Input Delay (ms)
      fid: 100,
      // Cumulative Layout Shift
      cls: 0.1,
      // Time to Interactive (ms)
      tti: 3500,
    },
    // 번들 크기 제한
    bundleSize: {
      // 초기 JavaScript 번들 크기 (KB)
      initial: 500,
      // 전체 번들 크기 (KB)
      total: 2000,
      // CSS 크기 (KB)
      css: 100,
    },
    // API 성능
    api: {
      // 응답 시간 (ms)
      responseTime: 200,
      // 처리량 (requests/second)
      throughput: 100,
      // 에러율 (%)
      errorRate: 1,
    },
  },

  // 보안 임계값
  security: {
    // 취약점 허용 수준
    vulnerabilities: {
      critical: 0,
      high: 0,
      medium: 5,
      low: 10,
    },
    // 보안 헤더 점수
    securityHeaders: 85,
    // SSL/TLS 점수
    sslScore: 90,
    // OWASP ZAP 스캔 점수
    zapScore: 85,
  },

  // 접근성 임계값
  accessibility: {
    // axe-core 규칙 준수율
    compliance: 95,
    // WCAG 2.1 AA 준수율
    wcag: 95,
    // 색상 대비 최소값
    colorContrast: 4.5,
    // 키보드 네비게이션 커버리지
    keyboardNavigation: 100,
  },

  // 코드 품질 임계값
  codeQuality: {
    // ESLint 경고/오류
    linting: {
      errors: 0,
      warnings: 10,
    },
    // TypeScript 컴파일 오류
    typeErrors: 0,
    // 코드 복잡도 (Cyclomatic Complexity)
    complexity: {
      max: 10,
      average: 5,
    },
    // 중복 코드 비율 (%)
    duplication: 3,
    // 기술 부채 비율 (분/일)
    technicalDebt: 5,
    // 유지보수성 지수 (0-100)
    maintainabilityIndex: 70,
  },

  // 테스트 품질 임계값
  testQuality: {
    // 테스트 실행 결과
    execution: {
      passRate: 100,
      flaky: 0,
    },
    // 테스트 속도 (초)
    speed: {
      unit: 30,
      integration: 120,
      e2e: 300,
    },
    // 테스트 안정성
    stability: {
      // 연속 실패 허용 횟수
      maxConsecutiveFailures: 2,
      // 성공률 최소값 (%)
      successRate: 98,
    },
  },

  // 배포 준비도 체크
  deploymentReadiness: {
    // 필수 체크 항목
    required: [
      'build-success',
      'tests-pass',
      'security-scan-pass',
      'performance-check-pass',
      'accessibility-check-pass',
    ],
    // 선택적 체크 항목 (경고만 발생)
    optional: [
      'documentation-updated',
      'changelog-updated',
      'migration-scripts-ready',
    ],
  },

  // 환경별 임계값 오버라이드
  environments: {
    development: {
      // 개발 환경에서는 좀 더 관대한 임계값
      coverage: {
        global: {
          statements: 75,
          branches: 70,
          functions: 75,
          lines: 75,
        },
      },
      performance: {
        lighthouse: {
          performance: 70,
          accessibility: 85,
          bestPractices: 75,
          seo: 70,
        },
      },
    },
    staging: {
      // 스테이징 환경은 프로덕션과 동일한 기준 적용
    },
    production: {
      // 프로덕션 환경에서는 더 엄격한 기준
      security: {
        vulnerabilities: {
          critical: 0,
          high: 0,
          medium: 2,
          low: 5,
        },
      },
      performance: {
        lighthouse: {
          performance: 95,
          accessibility: 98,
          bestPractices: 95,
          seo: 90,
        },
      },
    },
  },

  // 알림 설정
  notifications: {
    // Slack 웹훅 URL (환경 변수에서 가져옴)
    slack: {
      webhookUrl: process.env.SLACK_WEBHOOK_URL,
      channels: {
        critical: '#alerts-critical',
        warnings: '#alerts-warnings',
        success: '#deployments',
      },
    },
    // 이메일 알림 설정
    email: {
      recipients: {
        critical: ['team-lead@company.com', 'devops@company.com'],
        warnings: ['developers@company.com'],
        success: ['stakeholders@company.com'],
      },
    },
  },

  // 보고서 설정
  reporting: {
    // 아티팩트 보존 기간 (일)
    retentionDays: 30,
    // 보고서 형식
    formats: ['html', 'json', 'junit', 'cobertura'],
    // 대시보드 업데이트 활성화
    dashboard: true,
  },
};

// 환경별 설정 병합 함수
export function getQualityGatesForEnvironment(environment = 'development') {
  const baseConfig = { ...qualityGates };
  const envOverrides = qualityGates.environments[environment] || {};
  
  // 깊은 병합 수행
  return mergeDeep(baseConfig, envOverrides);
}

// 깊은 객체 병합 유틸리티
function mergeDeep(target, source) {
  const output = Object.assign({}, target);
  
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = mergeDeep(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  
  return output;
}

function isObject(item) {
  return item && typeof item === 'object' && !Array.isArray(item);
}

export default qualityGates;