/**
 * 품질 게이트 통합 실행 스크립트
 * 모든 품질 검사를 순차적으로 실행하고 결과를 통합
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const PerformanceBenchmark = require('./performance-benchmark.js');
const SecurityScanner = require('./security-scanner.js');
const AccessibilityTester = require('./accessibility-tester.js');
const QualityDashboard = require('./quality-dashboard.js');

class QualitySuite {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'http://localhost:4173';
    this.outputDir = options.outputDir || './quality-reports';
    this.dashboardDir = options.dashboardDir || './dashboard';
    this.environment = options.environment || 'development';
    this.skipTests = options.skipTests || false;
    this.verbose = options.verbose || false;
    
    this.results = {
      coverage: null,
      performance: null,
      security: null,
      accessibility: null,
      codeQuality: null,
      overall: {
        passed: false,
        score: 0,
        grade: 'F'
      },
      startTime: null,
      endTime: null,
      duration: null
    };
  }

  /**
   * 전체 품질 검사 스위트 실행
   */
  async run() {
    this.results.startTime = new Date();
    console.log('🎯 품질 게이트 통합 검사 시작...');
    console.log(`📍 환경: ${this.environment}`);
    console.log(`🌐 대상 URL: ${this.baseUrl}`);
    
    try {
      // 출력 디렉토리 생성
      await this.ensureDirectories();
      
      // 1. 기본 품질 검사 (린트, 타입 체크)
      await this.runCodeQualityChecks();
      
      // 2. 테스트 커버리지 (옵션)
      if (!this.skipTests) {
        await this.runCoverageTests();
      }
      
      // 3. 성능 벤치마크
      await this.runPerformanceBenchmark();
      
      // 4. 보안 스캔
      await this.runSecurityScan();
      
      // 5. 접근성 테스트
      await this.runAccessibilityTests();
      
      // 6. 결과 통합 및 분석
      await this.analyzeResults();
      
      // 7. 대시보드 생성
      await this.generateDashboard();
      
      // 8. 최종 보고서 생성
      await this.generateFinalReport();
      
      this.results.endTime = new Date();
      this.results.duration = this.results.endTime - this.results.startTime;
      
      console.log('✅ 품질 게이트 통합 검사 완료');
      console.log(`⏱️ 실행 시간: ${Math.round(this.results.duration / 1000)}초`);
      
      return this.results;
      
    } catch (error) {
      console.error('❌ 품질 검사 실패:', error);
      this.results.overall.passed = false;
      throw error;
    }
  }

  /**
   * 코드 품질 검사 실행
   */
  async runCodeQualityChecks() {
    console.log('\n📋 코드 품질 검사 실행 중...');
    
    const checks = {
      lint: false,
      typeCheck: false,
      format: false
    };
    
    try {
      // ESLint 검사
      console.log('  🔍 ESLint 검사...');
      execSync('pnpm lint:all', { stdio: this.verbose ? 'inherit' : 'pipe' });
      checks.lint = true;
      console.log('    ✅ ESLint 통과');
    } catch (error) {
      console.log('    ❌ ESLint 실패');
      if (this.verbose) console.error(error.message);
    }
    
    try {
      // TypeScript 타입 검사
      console.log('  🔍 TypeScript 타입 검사...');
      execSync('pnpm type-check:all', { stdio: this.verbose ? 'inherit' : 'pipe' });
      checks.typeCheck = true;
      console.log('    ✅ 타입 체크 통과');
    } catch (error) {
      console.log('    ❌ 타입 체크 실패');
      if (this.verbose) console.error(error.message);
    }
    
    try {
      // 포맷 검사
      console.log('  🔍 코드 포맷 검사...');
      execSync('pnpm format:all --check', { stdio: this.verbose ? 'inherit' : 'pipe' });
      checks.format = true;
      console.log('    ✅ 포맷 검사 통과');
    } catch (error) {
      console.log('    ❌ 포맷 검사 실패');
      if (this.verbose) console.error(error.message);
    }
    
    // 결과 저장
    const passedChecks = Object.values(checks).filter(Boolean).length;
    const totalChecks = Object.keys(checks).length;
    const score = Math.round((passedChecks / totalChecks) * 100);
    
    this.results.codeQuality = {
      passed: passedChecks === totalChecks,
      score,
      details: checks,
      timestamp: new Date().toISOString()
    };
    
    // 결과 저장
    fs.writeFileSync(
      path.join(this.outputDir, 'code-quality.json'),
      JSON.stringify(this.results.codeQuality, null, 2)
    );
  }

  /**
   * 커버리지 테스트 실행
   */
  async runCoverageTests() {
    console.log('\n📊 커버리지 테스트 실행 중...');
    
    const coverage = {
      client: null,
      server: null,
      overall: 0
    };
    
    try {
      // 클라이언트 테스트 + 커버리지
      console.log('  🧪 클라이언트 테스트...');
      execSync('pnpm --filter @vive/client test:coverage', { 
        stdio: this.verbose ? 'inherit' : 'pipe' 
      });
      
      // 커버리지 결과 읽기
      const clientCoveragePath = path.join('apps/client/coverage/coverage-summary.json');
      if (fs.existsSync(clientCoveragePath)) {
        const clientCoverage = JSON.parse(fs.readFileSync(clientCoveragePath, 'utf8'));
        coverage.client = clientCoverage.total;
        console.log(`    ✅ 클라이언트 커버리지: ${coverage.client.lines.pct}%`);
      }
      
    } catch (error) {
      console.log('    ❌ 클라이언트 테스트 실패');
      if (this.verbose) console.error(error.message);
    }
    
    try {
      // 서버 테스트 + 커버리지
      console.log('  🧪 서버 테스트...');
      execSync('pnpm --filter @vive/server test:coverage --run', { 
        stdio: this.verbose ? 'inherit' : 'pipe' 
      });
      
      // 커버리지 결과 읽기
      const serverCoveragePath = path.join('apps/server/coverage/coverage-summary.json');
      if (fs.existsSync(serverCoveragePath)) {
        const serverCoverage = JSON.parse(fs.readFileSync(serverCoveragePath, 'utf8'));
        coverage.server = serverCoverage.total;
        console.log(`    ✅ 서버 커버리지: ${coverage.server.lines.pct}%`);
      }
      
    } catch (error) {
      console.log('    ❌ 서버 테스트 실패');
      if (this.verbose) console.error(error.message);
    }
    
    // 전체 커버리지 계산
    if (coverage.client && coverage.server) {
      coverage.overall = Math.round(
        (coverage.client.lines.pct + coverage.server.lines.pct) / 2
      );
    } else if (coverage.client) {
      coverage.overall = coverage.client.lines.pct;
    } else if (coverage.server) {
      coverage.overall = coverage.server.lines.pct;
    }
    
    this.results.coverage = {
      passed: coverage.overall >= 85, // 임계값 85%
      score: coverage.overall,
      details: coverage,
      timestamp: new Date().toISOString()
    };
    
    // 결과 저장
    fs.writeFileSync(
      path.join(this.outputDir, 'coverage-summary.json'),
      JSON.stringify(this.results.coverage, null, 2)
    );
    
    // 커버리지 파일 복사
    this.copyCoverageFiles();
  }

  /**
   * 성능 벤치마크 실행
   */
  async runPerformanceBenchmark() {
    console.log('\n⚡ 성능 벤치마크 실행 중...');
    
    try {
      const benchmark = new PerformanceBenchmark({
        baseUrl: this.baseUrl,
        outputDir: this.outputDir,
        performance: 90,
        accessibility: 95,
        bestPractices: 90,
        seo: 85,
        bundleSize: 500,
        apiResponseTime: 200
      });
      
      const results = await benchmark.run();
      
      this.results.performance = {
        passed: results.passed,
        score: this.calculatePerformanceScore(results),
        details: results,
        timestamp: new Date().toISOString()
      };
      
      console.log(`  ✅ 성능 점수: ${this.results.performance.score}`);
      
    } catch (error) {
      console.log('  ❌ 성능 벤치마크 실패');
      if (this.verbose) console.error(error.message);
      
      this.results.performance = {
        passed: false,
        score: 0,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 보안 스캔 실행
   */
  async runSecurityScan() {
    console.log('\n🛡️ 보안 스캔 실행 중...');
    
    try {
      const scanner = new SecurityScanner({
        baseUrl: this.baseUrl,
        outputDir: this.outputDir,
        critical: 0,
        high: 0,
        medium: 5,
        low: 10
      });
      
      const results = await scanner.run();
      
      this.results.security = {
        passed: results.passed,
        score: this.calculateSecurityScore(results),
        details: results,
        timestamp: new Date().toISOString()
      };
      
      console.log(`  ✅ 보안 점수: ${this.results.security.score}`);
      
    } catch (error) {
      console.log('  ❌ 보안 스캔 실패');
      if (this.verbose) console.error(error.message);
      
      this.results.security = {
        passed: false,
        score: 0,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 접근성 테스트 실행
   */
  async runAccessibilityTests() {
    console.log('\n♿ 접근성 테스트 실행 중...');
    
    try {
      const tester = new AccessibilityTester({
        baseUrl: this.baseUrl,
        outputDir: this.outputDir,
        wcagLevel: 'AA',
        wcagVersion: '2.1',
        compliance: 95,
        critical: 0,
        serious: 2,
        moderate: 5,
        minor: 10
      });
      
      const results = await tester.run();
      
      this.results.accessibility = {
        passed: results.passed,
        score: results.summary.overallCompliance,
        details: results,
        timestamp: new Date().toISOString()
      };
      
      console.log(`  ✅ 접근성 점수: ${this.results.accessibility.score}`);
      
    } catch (error) {
      console.log('  ❌ 접근성 테스트 실패');
      if (this.verbose) console.error(error.message);
      
      this.results.accessibility = {
        passed: false,
        score: 0,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 결과 분석
   */
  async analyzeResults() {
    console.log('\n📈 결과 분석 중...');
    
    const metrics = [
      { name: 'codeQuality', weight: 0.1, threshold: 80 },
      { name: 'coverage', weight: 0.25, threshold: 85 },
      { name: 'performance', weight: 0.25, threshold: 90 },
      { name: 'security', weight: 0.25, threshold: 85 },
      { name: 'accessibility', weight: 0.15, threshold: 95 }
    ];
    
    let totalScore = 0;
    let totalWeight = 0;
    let passedMetrics = 0;
    
    metrics.forEach(({ name, weight, threshold }) => {
      const result = this.results[name];
      if (result && result.score !== undefined && result.score !== null) {
        totalScore += result.score * weight;
        totalWeight += weight;
        
        if (result.passed || result.score >= threshold) {
          passedMetrics++;
        }
      }
    });
    
    const overallScore = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
    const passRate = Math.round((passedMetrics / metrics.length) * 100);
    
    // 등급 계산
    let grade = 'F';
    if (overallScore >= 95) grade = 'A+';
    else if (overallScore >= 90) grade = 'A';
    else if (overallScore >= 85) grade = 'B+';
    else if (overallScore >= 80) grade = 'B';
    else if (overallScore >= 75) grade = 'C+';
    else if (overallScore >= 70) grade = 'C';
    else if (overallScore >= 65) grade = 'D';
    
    this.results.overall = {
      passed: passedMetrics === metrics.length,
      score: overallScore,
      grade,
      passRate,
      passedMetrics,
      totalMetrics: metrics.length,
      breakdown: metrics.reduce((acc, { name, weight }) => {
        const result = this.results[name];
        acc[name] = {
          score: result?.score || 0,
          passed: result?.passed || false,
          weight: Math.round(weight * 100)
        };
        return acc;
      }, {}),
      timestamp: new Date().toISOString()
    };
    
    console.log(`  📊 전체 점수: ${overallScore} (${grade})`);
    console.log(`  📈 통과율: ${passRate}% (${passedMetrics}/${metrics.length})`);
  }

  /**
   * 대시보드 생성
   */
  async generateDashboard() {
    console.log('\n📊 품질 대시보드 생성 중...');
    
    try {
      const dashboard = new QualityDashboard({
        inputDir: this.outputDir,
        outputDir: this.dashboardDir,
        projectName: 'TODO 앱',
        version: '1.0.0',
        thresholds: {
          coverage: 85,
          performance: 90,
          security: 85,
          accessibility: 95,
          codeQuality: 80
        }
      });
      
      await dashboard.generate();
      
      console.log(`  ✅ 대시보드 생성 완료: ${path.resolve(this.dashboardDir, 'index.html')}`);
      
    } catch (error) {
      console.log('  ❌ 대시보드 생성 실패');
      if (this.verbose) console.error(error.message);
    }
  }

  /**
   * 최종 보고서 생성
   */
  async generateFinalReport() {
    console.log('\n📄 최종 보고서 생성 중...');
    
    const report = this.generateMarkdownReport();
    
    fs.writeFileSync(
      path.join(this.outputDir, 'quality-suite-report.md'),
      report
    );
    
    // JSON 결과도 저장
    fs.writeFileSync(
      path.join(this.outputDir, 'quality-suite-results.json'),
      JSON.stringify(this.results, null, 2)
    );
    
    console.log(`  ✅ 보고서 생성 완료: ${path.resolve(this.outputDir, 'quality-suite-report.md')}`);
  }

  /**
   * Markdown 보고서 생성
   */
  generateMarkdownReport() {
    const { overall, codeQuality, coverage, performance, security, accessibility } = this.results;
    
    let report = `# 🎯 품질 게이트 통합 검사 보고서\n\n`;
    report += `**생성 시간**: ${new Date().toLocaleString('ko-KR')}\n`;
    report += `**환경**: ${this.environment}\n`;
    report += `**실행 시간**: ${Math.round(this.results.duration / 1000)}초\n\n`;
    
    // 전체 요약
    report += `## 📊 전체 요약\n\n`;
    report += `- **전체 점수**: ${overall.score}점 (${overall.grade})\n`;
    report += `- **통과율**: ${overall.passRate}% (${overall.passedMetrics}/${overall.totalMetrics})\n`;
    report += `- **전체 상태**: ${overall.passed ? '✅ 통과' : '❌ 미달'}\n\n`;
    
    // 세부 메트릭
    report += `## 📋 세부 메트릭\n\n`;
    report += `| 메트릭 | 점수 | 상태 | 가중치 |\n`;
    report += `|--------|------|------|--------|\n`;
    
    const metricNames = {
      codeQuality: '코드 품질',
      coverage: '커버리지',
      performance: '성능',
      security: '보안',
      accessibility: '접근성'
    };
    
    Object.entries(overall.breakdown).forEach(([key, data]) => {
      const name = metricNames[key] || key;
      const status = data.passed ? '✅ 통과' : '❌ 미달';
      report += `| ${name} | ${data.score}점 | ${status} | ${data.weight}% |\n`;
    });
    
    report += `\n`;
    
    // 상세 결과
    if (codeQuality) {
      report += `### 📋 코드 품질\n`;
      report += `- **점수**: ${codeQuality.score}점\n`;
      report += `- **ESLint**: ${codeQuality.details.lint ? '✅' : '❌'}\n`;
      report += `- **타입 체크**: ${codeQuality.details.typeCheck ? '✅' : '❌'}\n`;
      report += `- **포맷**: ${codeQuality.details.format ? '✅' : '❌'}\n\n`;
    }
    
    if (coverage) {
      report += `### 📊 테스트 커버리지\n`;
      report += `- **전체 커버리지**: ${coverage.score}%\n`;
      if (coverage.details.client) {
        report += `- **클라이언트**: ${coverage.details.client.lines.pct}%\n`;
      }
      if (coverage.details.server) {
        report += `- **서버**: ${coverage.details.server.lines.pct}%\n`;
      }
      report += `\n`;
    }
    
    if (performance) {
      report += `### ⚡ 성능\n`;
      report += `- **성능 점수**: ${performance.score}점\n`;
      if (performance.details.lighthouse) {
        report += `- **Lighthouse**: ${performance.details.lighthouse.performance}점\n`;
      }
      report += `\n`;
    }
    
    if (security) {
      report += `### 🛡️ 보안\n`;
      report += `- **보안 점수**: ${security.score}점\n`;
      if (security.details.summary) {
        const vuln = security.details.summary.totalVulnerabilities;
        report += `- **취약점**: Critical(${vuln.critical || 0}), High(${vuln.high || 0}), Medium(${vuln.medium || 0}), Low(${vuln.low || 0})\n`;
      }
      report += `\n`;
    }
    
    if (accessibility) {
      report += `### ♿ 접근성\n`;
      report += `- **접근성 점수**: ${accessibility.score}점\n`;
      report += `- **WCAG 2.1 AA 준수**: ${accessibility.passed ? '✅' : '❌'}\n\n`;
    }
    
    // 권장사항
    report += `## 💡 권장사항\n\n`;
    const recommendations = this.generateRecommendations();
    recommendations.forEach(rec => {
      report += `- ${rec}\n`;
    });
    
    // 결론
    report += `\n## 🎯 결론\n\n`;
    if (overall.passed) {
      report += `✅ **모든 품질 기준을 충족했습니다!**\n\n`;
      report += `애플리케이션이 프로덕션 배포 준비가 완료되었습니다.\n`;
    } else {
      report += `❌ **일부 품질 기준을 충족하지 못했습니다.**\n\n`;
      report += `배포 전에 다음 항목들을 개선해주세요:\n`;
      
      Object.entries(overall.breakdown).forEach(([key, data]) => {
        if (!data.passed) {
          const name = metricNames[key] || key;
          report += `- ${name} 개선 필요\n`;
        }
      });
    }
    
    return report;
  }

  /**
   * 권장사항 생성
   */
  generateRecommendations() {
    const recommendations = [];
    const { overall, codeQuality, coverage, performance, security, accessibility } = this.results;
    
    if (!overall.passed) {
      recommendations.push(`전체 품질 점수를 80점 이상으로 향상시키세요. (현재: ${overall.score}점)`);
    }
    
    if (codeQuality && !codeQuality.passed) {
      if (!codeQuality.details.lint) {
        recommendations.push('ESLint 경고 및 오류를 수정하세요.');
      }
      if (!codeQuality.details.typeCheck) {
        recommendations.push('TypeScript 컴파일 오류를 해결하세요.');
      }
      if (!codeQuality.details.format) {
        recommendations.push('코드 포맷팅을 일관되게 적용하세요.');
      }
    }
    
    if (coverage && !coverage.passed) {
      recommendations.push(`테스트 커버리지를 85% 이상으로 높이세요. (현재: ${coverage.score}%)`);
    }
    
    if (performance && !performance.passed) {
      recommendations.push('성능 최적화를 통해 Lighthouse 점수를 개선하세요.');
      recommendations.push('번들 크기를 줄이고 API 응답 시간을 단축하세요.');
    }
    
    if (security && !security.passed) {
      recommendations.push('발견된 보안 취약점을 수정하세요.');
      recommendations.push('보안 헤더를 적절히 설정하세요.');
    }
    
    if (accessibility && !accessibility.passed) {
      recommendations.push('웹 접근성 기준(WCAG 2.1 AA)을 충족하도록 개선하세요.');
      recommendations.push('키보드 네비게이션과 스크린 리더 호환성을 개선하세요.');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('모든 품질 기준을 충족하고 있습니다! 계속 좋은 품질을 유지하세요. 🎉');
    }
    
    return recommendations;
  }

  /**
   * 성능 점수 계산
   */
  calculatePerformanceScore(results) {
    if (!results.lighthouse) return 0;
    
    const lighthouse = results.lighthouse.performance || 0;
    const bundleScore = results.bundleAnalysis?.totalSize ? 
      Math.max(0, 100 - Math.max(0, results.bundleAnalysis.totalSize - 500) / 5) : 100;
    const apiScore = results.apiPerformance?.averageResponseTime ?
      Math.max(0, 100 - Math.max(0, results.apiPerformance.averageResponseTime - 200) / 2) : 100;
    
    return Math.round(lighthouse * 0.6 + bundleScore * 0.2 + apiScore * 0.2);
  }

  /**
   * 보안 점수 계산
   */
  calculateSecurityScore(results) {
    if (!results.summary) return 0;
    
    let score = 100;
    const vuln = results.summary.totalVulnerabilities;
    
    // 취약점 점수 차감
    score -= (vuln.critical || 0) * 30;
    score -= (vuln.high || 0) * 20;
    score -= (vuln.medium || 0) * 10;
    score -= (vuln.low || 0) * 5;
    
    // 보안 헤더 점수 추가
    if (results.headers?.totalScore) {
      const headerScore = (results.headers.totalScore / results.headers.maxScore) * 30;
      score = Math.round((Math.max(0, score) * 0.7 + headerScore * 0.3));
    }
    
    return Math.max(0, score);
  }

  /**
   * 커버리지 파일 복사
   */
  copyCoverageFiles() {
    const sourceFiles = [
      { src: 'apps/client/coverage/coverage-summary.json', dest: 'coverage-client.json' },
      { src: 'apps/server/coverage/coverage-summary.json', dest: 'coverage-server.json' }
    ];
    
    sourceFiles.forEach(({ src, dest }) => {
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(this.outputDir, dest));
      }
    });
  }

  /**
   * 디렉토리 생성
   */
  async ensureDirectories() {
    const directories = [this.outputDir, this.dashboardDir];
    
    directories.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }
}

// CLI에서 직접 실행할 때
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};
  
  // 명령행 인수 파싱
  args.forEach((arg, index) => {
    if (arg.startsWith('--')) {
      const key = arg.replace('--', '');
      const value = args[index + 1] && !args[index + 1].startsWith('--') ? args[index + 1] : true;
      
      if (key === 'skip-tests' || key === 'verbose') {
        options[key.replace('-', '')] = true;
      } else if (value !== true) {
        options[key.replace('-', '')] = value;
      }
    }
  });
  
  const suite = new QualitySuite(options);
  
  suite.run()
    .then(results => {
      console.log('\n🎯 품질 게이트 통합 검사 결과:');
      console.log(`전체 점수: ${results.overall.score}점 (${results.overall.grade})`);
      console.log(`통과 상태: ${results.overall.passed ? '✅ 통과' : '❌ 미달'}`);
      console.log(`실행 시간: ${Math.round(results.duration / 1000)}초`);
      
      // 대시보드 링크 출력
      const dashboardPath = path.resolve('./dashboard/index.html');
      if (fs.existsSync(dashboardPath)) {
        console.log(`📊 대시보드: file://${dashboardPath}`);
      }
      
      if (!results.overall.passed) {
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('품질 게이트 통합 검사 실패:', error);
      process.exit(1);
    });
}

module.exports = QualitySuite;