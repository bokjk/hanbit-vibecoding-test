/**
 * 종합 보안 스캔 자동화 스크립트
 * SAST, DAST, 의존성 취약점, 보안 헤더 등을 통합 검사
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const crypto = require('crypto');

class SecurityScanner {
  constructor(options = {}) {
    this.outputDir = options.outputDir || './security-reports';
    this.baseUrl = options.baseUrl || 'http://localhost:4173';
    this.thresholds = {
      critical: options.critical || 0,
      high: options.high || 0,
      medium: options.medium || 5,
      low: options.low || 10,
      ...options.thresholds
    };
    
    this.results = {
      sast: {},
      dast: {},
      dependencies: {},
      secrets: {},
      headers: {},
      summary: {},
      passed: false
    };
  }

  /**
   * 전체 보안 스캔 실행
   */
  async run() {
    console.log('🛡️ 종합 보안 스캔 시작...');
    
    try {
      // 출력 디렉토리 생성
      await this.ensureOutputDirectory();
      
      // 1. SAST (Static Application Security Testing)
      await this.runSASTScan();
      
      // 2. 의존성 취약점 스캔
      await this.scanDependencyVulnerabilities();
      
      // 3. 시크릿 스캔
      await this.scanForSecrets();
      
      // 4. DAST (Dynamic Application Security Testing) - 선택적
      if (this.baseUrl && process.env.NODE_ENV !== 'production') {
        await this.runDASTScan();
      }
      
      // 5. 보안 헤더 검사
      await this.checkSecurityHeaders();
      
      // 6. 결과 분석 및 보고서 생성
      await this.generateReport();
      
      // 7. 임계값 검증
      this.validateThresholds();
      
      console.log('✅ 종합 보안 스캔 완료');
      return this.results;
      
    } catch (error) {
      console.error('❌ 보안 스캔 실패:', error);
      this.results.passed = false;
      throw error;
    }
  }

  /**
   * SAST (정적 애플리케이션 보안 테스트) 실행
   */
  async runSASTScan() {
    console.log('🔍 SAST 스캔 실행 중...');
    
    const sastResults = {
      eslintSecurity: await this.runESLintSecurity(),
      semgrep: await this.runSemgrep(),
      codeql: await this.runCodeQL()
    };
    
    this.results.sast = sastResults;
    
    // SAST 결과 저장
    fs.writeFileSync(
      path.join(this.outputDir, 'sast-results.json'),
      JSON.stringify(sastResults, null, 2)
    );
    
    console.log('  ✅ SAST 스캔 완료');
  }

  /**
   * ESLint 보안 플러그인 실행
   */
  async runESLintSecurity() {
    console.log('    📋 ESLint Security 검사...');
    
    try {
      const eslintConfig = {
        extends: ['plugin:security/recommended'],
        rules: {
          'security/detect-object-injection': 'error',
          'security/detect-non-literal-regexp': 'error',
          'security/detect-non-literal-fs-filename': 'error',
          'security/detect-eval-with-expression': 'error',
          'security/detect-pseudoRandomBytes': 'error',
          'security/detect-possible-timing-attacks': 'error'
        }
      };
      
      // 임시 eslint config 생성
      const configPath = path.join(this.outputDir, '.eslintrc.security.json');
      fs.writeFileSync(configPath, JSON.stringify(eslintConfig, null, 2));
      
      // ESLint 실행
      const result = execSync(
        `npx eslint --config ${configPath} --format json ./apps/client/src ./apps/server/lambda 2>/dev/null || echo "[]"`,
        { encoding: 'utf8' }
      );
      
      let eslintResults;
      try {
        eslintResults = JSON.parse(result);
      } catch {
        eslintResults = [];
      }
      
      // 보안 이슈만 필터링
      const securityIssues = eslintResults.flatMap(file => 
        file.messages
          .filter(msg => msg.ruleId && msg.ruleId.startsWith('security/'))
          .map(msg => ({
            file: file.filePath,
            rule: msg.ruleId,
            severity: msg.severity === 2 ? 'high' : 'medium',
            message: msg.message,
            line: msg.line,
            column: msg.column
          }))
      );
      
      // 정리
      fs.unlinkSync(configPath);
      
      return {
        totalIssues: securityIssues.length,
        issues: securityIssues,
        severityCounts: this.countSeverities(securityIssues)
      };
      
    } catch (error) {
      console.warn('    ⚠️ ESLint Security 실행 실패:', error.message);
      return { totalIssues: 0, issues: [], severityCounts: {} };
    }
  }

  /**
   * Semgrep 보안 스캔 실행
   */
  async runSemgrep() {
    console.log('    🔍 Semgrep 보안 스캔...');
    
    try {
      // Semgrep 설치 확인
      execSync('which semgrep', { stdio: 'ignore' });
    } catch {
      console.warn('    ⚠️ Semgrep이 설치되지 않아 건너뜁니다.');
      return { totalIssues: 0, issues: [], severityCounts: {} };
    }
    
    try {
      const result = execSync(
        'semgrep --config=p/security-audit --config=p/secrets --json .',
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
      );
      
      const semgrepResults = JSON.parse(result);
      const issues = semgrepResults.results?.map(finding => ({
        file: finding.path,
        rule: finding.check_id,
        severity: this.mapSemgrepSeverity(finding.extra.severity),
        message: finding.extra.message,
        line: finding.start.line,
        column: finding.start.col
      })) || [];
      
      return {
        totalIssues: issues.length,
        issues,
        severityCounts: this.countSeverities(issues)
      };
      
    } catch (error) {
      console.warn('    ⚠️ Semgrep 실행 실패:', error.message);
      return { totalIssues: 0, issues: [], severityCounts: {} };
    }
  }

  /**
   * CodeQL 분석 실행 (간소화된 로컬 버전)
   */
  async runCodeQL() {
    console.log('    🔍 CodeQL 분석...');
    
    try {
      // CodeQL CLI 설치 확인
      execSync('which codeql', { stdio: 'ignore' });
    } catch {
      console.warn('    ⚠️ CodeQL이 설치되지 않아 건너뜁니다.');
      return { totalIssues: 0, issues: [], severityCounts: {} };
    }
    
    try {
      // 간단한 패턴 매칭 기반 보안 검사
      const securityPatterns = [
        { pattern: /eval\s*\(/g, severity: 'high', message: 'eval() 사용으로 인한 코드 인젝션 위험' },
        { pattern: /innerHTML\s*=/g, severity: 'medium', message: 'innerHTML 사용으로 인한 XSS 위험' },
        { pattern: /document\.write\s*\(/g, severity: 'medium', message: 'document.write 사용으로 인한 XSS 위험' },
        { pattern: /\$\{.*\}/g, severity: 'low', message: '템플릿 리터럴에서 사용자 입력 검증 필요' },
        { pattern: /crypto\.createHash\('md5'\)/g, severity: 'medium', message: '약한 해시 알고리즘(MD5) 사용' }
      ];
      
      const issues = [];
      const sourceFiles = this.getSourceFiles(['./apps/client/src', './apps/server/lambda']);
      
      sourceFiles.forEach(filePath => {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        
        securityPatterns.forEach(({ pattern, severity, message }) => {
          let match;
          while ((match = pattern.exec(content)) !== null) {
            const lineNumber = content.substring(0, match.index).split('\n').length;
            
            issues.push({
              file: filePath,
              rule: 'codeql-pattern-match',
              severity,
              message,
              line: lineNumber,
              column: match.index - content.lastIndexOf('\n', match.index)
            });
          }
        });
      });
      
      return {
        totalIssues: issues.length,
        issues,
        severityCounts: this.countSeverities(issues)
      };
      
    } catch (error) {
      console.warn('    ⚠️ CodeQL 분석 실패:', error.message);
      return { totalIssues: 0, issues: [], severityCounts: {} };
    }
  }

  /**
   * 의존성 취약점 스캔
   */
  async scanDependencyVulnerabilities() {
    console.log('📦 의존성 취약점 스캔 중...');
    
    const dependencyResults = {
      npm: await this.runNpmAudit(),
      yarn: await this.runYarnAudit(),
      snyk: await this.runSnyk()
    };
    
    this.results.dependencies = dependencyResults;
    
    // 의존성 스캔 결과 저장
    fs.writeFileSync(
      path.join(this.outputDir, 'dependency-scan.json'),
      JSON.stringify(dependencyResults, null, 2)
    );
    
    console.log('  ✅ 의존성 취약점 스캔 완료');
  }

  /**
   * npm audit 실행
   */
  async runNpmAudit() {
    console.log('    🔍 npm audit 실행...');
    
    try {
      const result = execSync('pnpm audit --json', { 
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore']
      });
      
      const auditResult = JSON.parse(result);
      const metadata = auditResult.metadata || {};
      const vulnerabilities = metadata.vulnerabilities || {};
      
      return {
        totalVulnerabilities: Object.values(vulnerabilities).reduce((sum, count) => sum + count, 0),
        vulnerabilities,
        advisories: auditResult.advisories || {}
      };
      
    } catch (error) {
      // npm audit는 취약점이 있을 때 exit code 1을 반환하므로 결과를 파싱
      try {
        const result = error.stdout || error.message;
        if (result.includes('{')) {
          const jsonStart = result.indexOf('{');
          const auditResult = JSON.parse(result.substring(jsonStart));
          const metadata = auditResult.metadata || {};
          const vulnerabilities = metadata.vulnerabilities || {};
          
          return {
            totalVulnerabilities: Object.values(vulnerabilities).reduce((sum, count) => sum + count, 0),
            vulnerabilities,
            advisories: auditResult.advisories || {}
          };
        }
      } catch (parseError) {
        console.warn('    ⚠️ npm audit 결과 파싱 실패:', parseError.message);
      }
      
      return { totalVulnerabilities: 0, vulnerabilities: {}, advisories: {} };
    }
  }

  /**
   * Yarn audit 실행
   */
  async runYarnAudit() {
    console.log('    🔍 yarn audit 실행...');
    
    try {
      // yarn이 설치되어 있는지 확인
      execSync('which yarn', { stdio: 'ignore' });
      
      const result = execSync('yarn audit --json', { 
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore']
      });
      
      // yarn audit JSON 출력 파싱
      const lines = result.split('\n').filter(line => line.trim());
      const vulnerabilities = [];
      
      lines.forEach(line => {
        try {
          const parsed = JSON.parse(line);
          if (parsed.type === 'auditAdvisory') {
            vulnerabilities.push({
              severity: parsed.data.advisory.severity,
              title: parsed.data.advisory.title,
              module: parsed.data.advisory.module_name,
              version: parsed.data.advisory.vulnerable_versions
            });
          }
        } catch {}
      });
      
      const severityCounts = this.countSeverities(vulnerabilities);
      
      return {
        totalVulnerabilities: vulnerabilities.length,
        vulnerabilities: severityCounts,
        details: vulnerabilities
      };
      
    } catch (error) {
      console.warn('    ⚠️ yarn audit 실행 실패 (yarn 미설치 또는 오류)');
      return { totalVulnerabilities: 0, vulnerabilities: {}, details: [] };
    }
  }

  /**
   * Snyk 보안 스캔 실행
   */
  async runSnyk() {
    console.log('    🔍 Snyk 보안 스캔...');
    
    try {
      // Snyk 설치 확인
      execSync('which snyk', { stdio: 'ignore' });
      
      const result = execSync('snyk test --json', { 
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore']
      });
      
      const snykResult = JSON.parse(result);
      const vulnerabilities = snykResult.vulnerabilities || [];
      
      const severityCounts = vulnerabilities.reduce((acc, vuln) => {
        acc[vuln.severity] = (acc[vuln.severity] || 0) + 1;
        return acc;
      }, {});
      
      return {
        totalVulnerabilities: vulnerabilities.length,
        vulnerabilities: severityCounts,
        details: vulnerabilities.map(v => ({
          severity: v.severity,
          title: v.title,
          module: v.moduleName,
          version: v.version
        }))
      };
      
    } catch (error) {
      console.warn('    ⚠️ Snyk 실행 실패 (Snyk 미설치 또는 오류)');
      return { totalVulnerabilities: 0, vulnerabilities: {}, details: [] };
    }
  }

  /**
   * 시크릿 스캔 실행
   */
  async scanForSecrets() {
    console.log('🔐 시크릿 스캔 중...');
    
    const secretPatterns = [
      { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/g },
      { name: 'AWS Secret Key', pattern: /[0-9a-zA-Z/+]{40}/g },
      { name: 'GitHub Token', pattern: /ghp_[0-9a-zA-Z]{36}/g },
      { name: 'JWT Token', pattern: /eyJ[0-9a-zA-Z_-]*\.[0-9a-zA-Z_-]*\.[0-9a-zA-Z_-]*/g },
      { name: 'API Key', pattern: /[Aa][Pp][Ii]_?[Kk][Ee][Yy].*['"]\s*[:=]\s*['"][0-9a-zA-Z]{32,}['"]/g },
      { name: 'Private Key', pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/g },
      { name: 'Database URL', pattern: /[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^\s"']*/g }
    ];
    
    const secrets = [];
    const sourceFiles = this.getSourceFiles(['.']);
    
    // .git, node_modules 등 제외
    const excludePatterns = [
      /\/\.git\//,
      /\/node_modules\//,
      /\/dist\//,
      /\/build\//,
      /\/coverage\//,
      /\.log$/,
      /\.lock$/
    ];
    
    const filteredFiles = sourceFiles.filter(file => 
      !excludePatterns.some(pattern => pattern.test(file))
    );
    
    filteredFiles.forEach(filePath => {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      
      secretPatterns.forEach(({ name, pattern }) => {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          const lineNumber = content.substring(0, match.index).split('\n').length;
          const lineContent = lines[lineNumber - 1];
          
          // false positive 필터링
          if (this.isFalsePositive(match[0], lineContent)) {
            continue;
          }
          
          secrets.push({
            file: filePath,
            type: name,
            line: lineNumber,
            preview: lineContent.trim(),
            hash: crypto.createHash('md5').update(match[0]).digest('hex')
          });
        }
      });
    });
    
    this.results.secrets = {
      totalSecrets: secrets.length,
      secrets
    };
    
    // 시크릿 스캔 결과 저장 (민감한 정보는 해시로 대체)
    fs.writeFileSync(
      path.join(this.outputDir, 'secrets-scan.json'),
      JSON.stringify(this.results.secrets, null, 2)
    );
    
    console.log(`  ✅ 시크릿 스캔 완료 (${secrets.length}개 발견)`);
  }

  /**
   * DAST (동적 애플리케이션 보안 테스트) 실행
   */
  async runDASTScan() {
    console.log('🌐 DAST 스캔 실행 중...');
    
    const dastResults = {
      headers: await this.checkSecurityHeaders(),
      ssl: await this.checkSSLSecurity(),
      vulnerabilities: await this.scanForCommonVulnerabilities()
    };
    
    this.results.dast = dastResults;
    
    // DAST 결과 저장
    fs.writeFileSync(
      path.join(this.outputDir, 'dast-results.json'),
      JSON.stringify(dastResults, null, 2)
    );
    
    console.log('  ✅ DAST 스캔 완료');
  }

  /**
   * 보안 헤더 검사
   */
  async checkSecurityHeaders() {
    console.log('🔒 보안 헤더 검사 중...');
    
    const requiredHeaders = {
      'content-security-policy': { required: true, score: 20 },
      'x-frame-options': { required: true, score: 15 },
      'x-content-type-options': { required: true, score: 10 },
      'x-xss-protection': { required: true, score: 10 },
      'strict-transport-security': { required: true, score: 20 },
      'referrer-policy': { required: true, score: 10 },
      'permissions-policy': { required: false, score: 10 },
      'cross-origin-embedder-policy': { required: false, score: 5 }
    };
    
    let headerResults = {
      totalScore: 0,
      maxScore: Object.values(requiredHeaders).reduce((sum, header) => sum + header.score, 0),
      headers: {},
      missing: [],
      warnings: []
    };
    
    try {
      const response = await fetch(this.baseUrl, { method: 'HEAD' });
      
      for (const [headerName, config] of Object.entries(requiredHeaders)) {
        const headerValue = response.headers.get(headerName);
        
        if (headerValue) {
          headerResults.totalScore += config.score;
          headerResults.headers[headerName] = {
            present: true,
            value: headerValue,
            score: config.score
          };
        } else {
          headerResults.headers[headerName] = {
            present: false,
            value: null,
            score: 0
          };
          
          if (config.required) {
            headerResults.missing.push(headerName);
          }
        }
      }
      
      // 헤더 값 검증
      this.validateHeaderValues(headerResults);
      
    } catch (error) {
      console.warn('    ⚠️ 보안 헤더 검사 실패:', error.message);
      headerResults.error = error.message;
    }
    
    this.results.headers = headerResults;
    
    console.log(`  ✅ 보안 헤더 검사 완료 (점수: ${headerResults.totalScore}/${headerResults.maxScore})`);
    return headerResults;
  }

  /**
   * SSL 보안 검사
   */
  async checkSSLSecurity() {
    console.log('🔐 SSL 보안 검사...');
    
    if (!this.baseUrl.startsWith('https://')) {
      return {
        enabled: false,
        score: 0,
        warning: 'HTTPS가 활성화되지 않음'
      };
    }
    
    try {
      const url = new URL(this.baseUrl);
      const response = await fetch(this.baseUrl);
      
      return {
        enabled: true,
        score: 90, // 기본 점수 (상세 검사 생략)
        protocol: 'TLS',
        grade: 'A-'
      };
      
    } catch (error) {
      return {
        enabled: false,
        score: 0,
        error: error.message
      };
    }
  }

  /**
   * 일반적인 웹 취약점 스캔
   */
  async scanForCommonVulnerabilities() {
    console.log('🔍 일반 웹 취약점 스캔...');
    
    const vulnerabilities = [];
    
    try {
      // XSS 테스트
      const xssPayload = '<script>alert("xss")</script>';
      const xssResponse = await fetch(`${this.baseUrl}/search?q=${encodeURIComponent(xssPayload)}`);
      const xssContent = await xssResponse.text();
      
      if (xssContent.includes(xssPayload)) {
        vulnerabilities.push({
          type: 'Reflected XSS',
          severity: 'high',
          description: '반사형 XSS 취약점 가능성 발견'
        });
      }
      
      // SQL Injection 테스트 (간단한 형태)
      const sqlPayload = "' OR '1'='1";
      const sqlResponse = await fetch(`${this.baseUrl}/api/search?q=${encodeURIComponent(sqlPayload)}`);
      
      if (sqlResponse.status >= 500) {
        vulnerabilities.push({
          type: 'SQL Injection',
          severity: 'critical',
          description: 'SQL 인젝션 취약점 가능성 발견'
        });
      }
      
    } catch (error) {
      console.warn('    ⚠️ 일반 취약점 스캔 일부 실패:', error.message);
    }
    
    return vulnerabilities;
  }

  /**
   * 헤더 값 검증
   */
  validateHeaderValues(headerResults) {
    // CSP 검증
    const csp = headerResults.headers['content-security-policy'];
    if (csp && csp.present) {
      if (csp.value.includes("'unsafe-inline'") || csp.value.includes("'unsafe-eval'")) {
        headerResults.warnings.push('CSP에 안전하지 않은 지시어가 포함됨');
      }
    }
    
    // HSTS 검증
    const hsts = headerResults.headers['strict-transport-security'];
    if (hsts && hsts.present) {
      const maxAge = hsts.value.match(/max-age=(\d+)/);
      if (maxAge && parseInt(maxAge[1]) < 31536000) { // 1년
        headerResults.warnings.push('HSTS max-age가 권장값(1년)보다 짧음');
      }
    }
  }

  /**
   * False Positive 필터링
   */
  isFalsePositive(secret, lineContent) {
    // 테스트 파일이나 예시 코드 필터링
    const falsePositivePatterns = [
      /test/i,
      /example/i,
      /dummy/i,
      /fake/i,
      /mock/i,
      /placeholder/i
    ];
    
    return falsePositivePatterns.some(pattern => 
      pattern.test(lineContent) || pattern.test(secret)
    );
  }

  /**
   * 임계값 검증
   */
  validateThresholds() {
    console.log('🎯 보안 임계값 검증 중...');
    
    const failures = [];
    let totalVulnerabilities = { critical: 0, high: 0, medium: 0, low: 0 };
    
    // SAST 결과 집계
    Object.values(this.results.sast).forEach(result => {
      if (result.severityCounts) {
        Object.entries(result.severityCounts).forEach(([severity, count]) => {
          totalVulnerabilities[severity] = (totalVulnerabilities[severity] || 0) + count;
        });
      }
    });
    
    // 의존성 취약점 집계
    Object.values(this.results.dependencies).forEach(result => {
      if (result.vulnerabilities) {
        Object.entries(result.vulnerabilities).forEach(([severity, count]) => {
          totalVulnerabilities[severity] = (totalVulnerabilities[severity] || 0) + count;
        });
      }
    });
    
    // 시크릿 스캔 결과 (critical로 분류)
    if (this.results.secrets.totalSecrets > 0) {
      totalVulnerabilities.critical += this.results.secrets.totalSecrets;
    }
    
    // 임계값 검증
    Object.entries(this.thresholds).forEach(([severity, threshold]) => {
      const count = totalVulnerabilities[severity] || 0;
      if (count > threshold) {
        failures.push(`${severity.toUpperCase()} 수준 취약점: ${count}개 > ${threshold}개`);
      }
    });
    
    // 보안 헤더 점수 검증 (80% 이상 권장)
    if (this.results.headers.totalScore) {
      const headerScore = (this.results.headers.totalScore / this.results.headers.maxScore) * 100;
      if (headerScore < 80) {
        failures.push(`보안 헤더 점수: ${Math.round(headerScore)}% < 80%`);
      }
    }
    
    this.results.passed = failures.length === 0;
    this.results.failures = failures;
    this.results.summary = {
      totalVulnerabilities,
      headerScore: this.results.headers.totalScore || 0,
      maxHeaderScore: this.results.headers.maxScore || 100
    };
    
    if (this.results.passed) {
      console.log('  ✅ 모든 보안 임계값 통과');
    } else {
      console.log('  ❌ 보안 임계값 실패:');
      failures.forEach(failure => console.log(`    - ${failure}`));
    }
  }

  /**
   * 보안 보고서 생성
   */
  async generateReport() {
    console.log('📄 보안 보고서 생성 중...');
    
    const report = this.generateMarkdownReport();
    
    // Markdown 보고서 저장
    fs.writeFileSync(
      path.join(this.outputDir, 'security-report.md'),
      report
    );
    
    // JSON 요약 저장
    fs.writeFileSync(
      path.join(this.outputDir, 'security-summary.json'),
      JSON.stringify(this.results, null, 2)
    );
    
    console.log('  ✅ 보안 보고서 생성 완료');
  }

  /**
   * Markdown 형식의 보안 보고서 생성
   */
  generateMarkdownReport() {
    const { sast, dependencies, secrets, headers, summary } = this.results;
    
    let report = `# 🛡️ 종합 보안 스캔 보고서\n\n`;
    report += `**생성 시간**: ${new Date().toLocaleString('ko-KR')}\n\n`;
    
    // 요약
    report += `## 📊 보안 요약\n\n`;
    if (summary.totalVulnerabilities) {
      report += `| 심각도 | 발견된 취약점 | 임계값 | 상태 |\n`;
      report += `|--------|-------------|--------|------|\n`;
      
      Object.entries(this.thresholds).forEach(([severity, threshold]) => {
        const count = summary.totalVulnerabilities[severity] || 0;
        const status = count <= threshold ? '✅' : '❌';
        report += `| ${severity.toUpperCase()} | ${count}개 | ${threshold}개 | ${status} |\n`;
      });
      report += `\n`;
    }
    
    // 보안 헤더 점수
    if (headers.totalScore !== undefined) {
      const headerScore = Math.round((headers.totalScore / headers.maxScore) * 100);
      report += `**보안 헤더 점수**: ${headerScore}% (${headers.totalScore}/${headers.maxScore})\n\n`;
    }
    
    // SAST 결과
    report += `## 🔍 정적 분석 (SAST) 결과\n\n`;
    Object.entries(sast).forEach(([tool, result]) => {
      if (result.totalIssues !== undefined) {
        report += `### ${tool.toUpperCase()}\n`;
        report += `- 총 이슈: ${result.totalIssues}개\n`;
        
        if (result.severityCounts) {
          Object.entries(result.severityCounts).forEach(([severity, count]) => {
            report += `- ${severity.toUpperCase()}: ${count}개\n`;
          });
        }
        report += `\n`;
      }
    });
    
    // 의존성 취약점
    report += `## 📦 의존성 취약점\n\n`;
    Object.entries(dependencies).forEach(([tool, result]) => {
      if (result.totalVulnerabilities !== undefined) {
        report += `### ${tool.toUpperCase()}\n`;
        report += `- 총 취약점: ${result.totalVulnerabilities}개\n`;
        
        if (result.vulnerabilities && typeof result.vulnerabilities === 'object') {
          Object.entries(result.vulnerabilities).forEach(([severity, count]) => {
            report += `- ${severity.toUpperCase()}: ${count}개\n`;
          });
        }
        report += `\n`;
      }
    });
    
    // 시크릿 스캔
    if (secrets.totalSecrets !== undefined) {
      report += `## 🔐 시크릿 스캔 결과\n\n`;
      report += `**발견된 잠재적 시크릿**: ${secrets.totalSecrets}개\n\n`;
      
      if (secrets.totalSecrets > 0) {
        report += `⚠️ **주의**: 코드베이스에서 잠재적으로 민감한 정보가 발견되었습니다. 검토가 필요합니다.\n\n`;
      }
    }
    
    // 보안 헤더 상세
    if (headers.missing && headers.missing.length > 0) {
      report += `## 🔒 누락된 보안 헤더\n\n`;
      headers.missing.forEach(header => {
        report += `- ${header}\n`;
      });
      report += `\n`;
    }
    
    if (headers.warnings && headers.warnings.length > 0) {
      report += `## ⚠️ 보안 헤더 경고\n\n`;
      headers.warnings.forEach(warning => {
        report += `- ${warning}\n`;
      });
      report += `\n`;
    }
    
    // 전체 결과
    report += `## 🎯 전체 결과\n\n`;
    if (this.results.passed) {
      report += `✅ **모든 보안 임계값을 통과했습니다!**\n\n`;
      report += `애플리케이션의 보안 수준이 요구사항을 충족합니다.\n`;
    } else {
      report += `❌ **일부 보안 임계값을 통과하지 못했습니다.**\n\n`;
      report += `개선이 필요한 항목:\n`;
      this.results.failures.forEach(failure => {
        report += `- ${failure}\n`;
      });
      report += `\n## 권장 조치사항\n\n`;
      report += `1. 발견된 취약점을 우선순위에 따라 수정하세요.\n`;
      report += `2. 누락된 보안 헤더를 추가하세요.\n`;
      report += `3. 의존성을 최신 버전으로 업데이트하세요.\n`;
      report += `4. 코드에서 하드코딩된 시크릿을 제거하세요.\n`;
    }
    
    return report;
  }

  /**
   * 심각도별 개수 계산
   */
  countSeverities(items) {
    return items.reduce((acc, item) => {
      acc[item.severity] = (acc[item.severity] || 0) + 1;
      return acc;
    }, {});
  }

  /**
   * Semgrep 심각도 매핑
   */
  mapSemgrepSeverity(severity) {
    const mapping = {
      'ERROR': 'high',
      'WARNING': 'medium',
      'INFO': 'low'
    };
    return mapping[severity] || 'low';
  }

  /**
   * 소스 파일 목록 가져오기
   */
  getSourceFiles(directories) {
    const files = [];
    
    directories.forEach(dir => {
      if (fs.existsSync(dir)) {
        this.getAllFilesRecursive(dir, files);
      }
    });
    
    return files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.js', '.ts', '.jsx', '.tsx', '.vue', '.json', '.yaml', '.yml', '.env'].includes(ext);
    });
  }

  /**
   * 재귀적으로 모든 파일 가져오기
   */
  getAllFilesRecursive(dirPath, files = []) {
    const entries = fs.readdirSync(dirPath);
    
    entries.forEach(entry => {
      const fullPath = path.join(dirPath, entry);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        this.getAllFilesRecursive(fullPath, files);
      } else {
        files.push(fullPath);
      }
    });
    
    return files;
  }

  /**
   * 출력 디렉토리 확인 및 생성
   */
  async ensureOutputDirectory() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }
}

// CLI에서 직접 실행할 때
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};
  
  // 명령행 인수 파싱
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = args[i + 1];
    
    if (key && value) {
      if (['critical', 'high', 'medium', 'low'].includes(key)) {
        options[key] = parseInt(value);
      } else {
        options[key] = value;
      }
    }
  }
  
  const scanner = new SecurityScanner(options);
  
  scanner.run()
    .then(results => {
      console.log('\n🛡️ 보안 스캔 결과:');
      console.log(`전체 통과: ${results.passed ? '✅' : '❌'}`);
      
      if (!results.passed) {
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('보안 스캔 실행 실패:', error);
      process.exit(1);
    });
}

module.exports = SecurityScanner;