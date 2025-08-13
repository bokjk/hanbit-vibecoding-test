#!/usr/bin/env node

/**
 * 사용자 수용 테스트 (UAT) 통합 실행 스크립트
 * 모든 UAT 테스트를 순차적으로 실행하고 종합 리포트 생성
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class UATTestSuite {
  constructor(options = {}) {
    this.outputDir = options.outputDir || './uat-reports';
    this.environment = options.environment || 'development';
    this.baseUrl = options.baseUrl || 'http://localhost:4173';
    this.verbose = options.verbose || false;
    this.parallel = options.parallel || false;
    this.skipBrowsers = options.skipBrowsers || [];
    
    this.results = {
      userAcceptance: null,
      crossBrowser: null,
      mobileResponsive: null,
      accessibilityAdvanced: null,
      overall: {
        passed: false,
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        skippedTests: 0,
        duration: 0
      },
      startTime: null,
      endTime: null
    };

    // 색상 코드
    this.colors = {
      reset: '\x1b[0m',
      bright: '\x1b[1m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      cyan: '\x1b[36m'
    };
  }

  /**
   * 색상이 포함된 로그 출력
   */
  log(message, color = 'reset') {
    const colorCode = this.colors[color] || this.colors.reset;
    console.log(`${colorCode}${message}${this.colors.reset}`);
  }

  /**
   * UAT 테스트 스위트 전체 실행
   */
  async run() {
    this.results.startTime = new Date();
    this.log('\n🎯 사용자 수용 테스트 (UAT) 시작...', 'cyan');
    this.log(`📍 환경: ${this.environment}`, 'blue');
    this.log(`🌐 대상 URL: ${this.baseUrl}`, 'blue');
    
    try {
      // 출력 디렉토리 생성
      await this.ensureDirectories();
      
      // 개발 서버 상태 확인
      await this.checkDevServer();
      
      // UAT 테스트 실행
      if (this.parallel) {
        await this.runTestsInParallel();
      } else {
        await this.runTestsSequentially();
      }
      
      // 결과 분석 및 리포트 생성
      await this.analyzeResults();
      await this.generateReport();
      
      this.results.endTime = new Date();
      this.results.overall.duration = this.results.endTime - this.results.startTime;
      
      this.log('\n✅ UAT 테스트 완료!', 'green');
      this.log(`⏱️ 총 실행 시간: ${Math.round(this.results.overall.duration / 1000)}초`, 'blue');
      this.log(`📊 결과: ${this.results.overall.passedTests}/${this.results.overall.totalTests} 테스트 통과`, 
               this.results.overall.passed ? 'green' : 'red');
      
      return this.results;
      
    } catch (error) {
      this.log(`\n❌ UAT 테스트 실행 실패: ${error.message}`, 'red');
      throw error;
    }
  }

  /**
   * 개발 서버 상태 확인
   */
  async checkDevServer() {
    this.log('\n🔍 개발 서버 상태 확인 중...', 'yellow');
    
    try {
      const response = await fetch(this.baseUrl);
      if (!response.ok) {
        throw new Error(`서버 응답 오류: ${response.status}`);
      }
      this.log('✅ 개발 서버 정상 동작', 'green');
    } catch (error) {
      this.log('❌ 개발 서버 연결 실패', 'red');
      this.log('💡 개발 서버를 먼저 시작해주세요: npm run dev', 'yellow');
      throw new Error('개발 서버가 실행되지 않았습니다.');
    }
  }

  /**
   * 테스트 순차 실행
   */
  async runTestsSequentially() {
    const testSuites = [
      {
        name: '사용자 시나리오 테스트',
        file: 'user-acceptance.spec.ts',
        key: 'userAcceptance'
      },
      {
        name: '크로스 브라우저 테스트',
        file: 'cross-browser.spec.ts',
        key: 'crossBrowser',
        skip: this.skipBrowsers.includes('all')
      },
      {
        name: '모바일 반응형 테스트',
        file: 'mobile-responsive.spec.ts',
        key: 'mobileResponsive'
      },
      {
        name: '접근성 고급 테스트',
        file: 'accessibility-advanced.spec.ts',
        key: 'accessibilityAdvanced'
      }
    ];

    for (const suite of testSuites) {
      if (suite.skip) {
        this.log(`\n⏭️ ${suite.name} 건너뛰기`, 'yellow');
        continue;
      }

      await this.runSingleTestSuite(suite);
    }
  }

  /**
   * 테스트 병렬 실행
   */
  async runTestsInParallel() {
    this.log('\n⚡ 병렬 테스트 실행 모드', 'magenta');
    
    const testSuites = [
      {
        name: '사용자 시나리오 테스트',
        file: 'user-acceptance.spec.ts',
        key: 'userAcceptance'
      },
      {
        name: '모바일 반응형 테스트',
        file: 'mobile-responsive.spec.ts',
        key: 'mobileResponsive'
      },
      {
        name: '접근성 고급 테스트',
        file: 'accessibility-advanced.spec.ts',
        key: 'accessibilityAdvanced'
      }
    ].filter(suite => !suite.skip);

    // 크로스 브라우저 테스트는 리소스가 많이 필요하므로 별도 실행
    if (!this.skipBrowsers.includes('all')) {
      await this.runSingleTestSuite({
        name: '크로스 브라우저 테스트',
        file: 'cross-browser.spec.ts',
        key: 'crossBrowser'
      });
    }

    // 나머지 테스트들 병렬 실행
    const promises = testSuites.map(suite => this.runSingleTestSuite(suite));
    await Promise.all(promises);
  }

  /**
   * 개별 테스트 스위트 실행
   */
  async runSingleTestSuite(suite) {
    this.log(`\n🧪 ${suite.name} 실행 중...`, 'yellow');
    
    const startTime = Date.now();
    const outputFile = path.join(this.outputDir, `${suite.key}-results.json`);
    
    try {
      // Playwright 테스트 실행
      const command = `npx playwright test apps/client/e2e/${suite.file}`;
      const options = {
        cwd: process.cwd(),
        stdio: this.verbose ? 'inherit' : 'pipe',
        env: {
          ...process.env,
          BASE_URL: this.baseUrl,
          CI: 'true'
        }
      };

      this.log(`  🔧 명령어: ${command}`, 'blue');
      
      const output = execSync(command, options);
      const duration = Date.now() - startTime;
      
      // 결과 파싱 및 저장
      const result = {
        name: suite.name,
        passed: true,
        duration,
        output: output?.toString() || '',
        timestamp: new Date().toISOString()
      };
      
      this.results[suite.key] = result;
      
      // JSON 파일로 저장
      fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
      
      this.log(`  ✅ ${suite.name} 완료 (${Math.round(duration / 1000)}초)`, 'green');
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      const result = {
        name: suite.name,
        passed: false,
        duration,
        error: error.message,
        output: error.stdout?.toString() || error.stderr?.toString() || '',
        timestamp: new Date().toISOString()
      };
      
      this.results[suite.key] = result;
      
      // JSON 파일로 저장
      fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
      
      this.log(`  ❌ ${suite.name} 실패 (${Math.round(duration / 1000)}초)`, 'red');
      
      if (this.verbose) {
        this.log(`  📄 에러 내용: ${error.message}`, 'red');
      }
    }
  }

  /**
   * 결과 분석
   */
  async analyzeResults() {
    this.log('\n📈 테스트 결과 분석 중...', 'yellow');
    
    const testResults = [
      this.results.userAcceptance,
      this.results.crossBrowser,
      this.results.mobileResponsive,
      this.results.accessibilityAdvanced
    ].filter(Boolean);

    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;
    
    testResults.forEach(result => {
      if (result) {
        totalTests++;
        if (result.passed) {
          passedTests++;
        } else {
          failedTests++;
        }
      }
    });

    this.results.overall = {
      passed: failedTests === 0,
      totalTests,
      passedTests,
      failedTests,
      skippedTests: this.skipBrowsers.includes('all') ? 1 : 0,
      duration: this.results.endTime ? this.results.endTime - this.results.startTime : 0,
      passRate: totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0
    };

    this.log(`  📊 전체 통과율: ${this.results.overall.passRate}%`, 
             this.results.overall.passRate >= 90 ? 'green' : 'yellow');
  }

  /**
   * 종합 리포트 생성
   */
  async generateReport() {
    this.log('\n📄 종합 리포트 생성 중...', 'yellow');
    
    const reportContent = this.generateMarkdownReport();
    const reportPath = path.join(this.outputDir, 'uat-comprehensive-report.md');
    
    fs.writeFileSync(reportPath, reportContent, 'utf8');
    
    // JSON 결과도 저장
    const jsonPath = path.join(this.outputDir, 'uat-results.json');
    fs.writeFileSync(jsonPath, JSON.stringify(this.results, null, 2), 'utf8');
    
    this.log(`  ✅ 리포트 생성 완료: ${reportPath}`, 'green');
    this.log(`  📋 JSON 결과: ${jsonPath}`, 'blue');
  }

  /**
   * Markdown 리포트 생성
   */
  generateMarkdownReport() {
    const { overall } = this.results;
    
    let report = `# 🎯 사용자 수용 테스트 (UAT) 종합 보고서\n\n`;
    report += `**생성 시간**: ${new Date().toLocaleString('ko-KR')}\n`;
    report += `**환경**: ${this.environment}\n`;
    report += `**대상 URL**: ${this.baseUrl}\n`;
    report += `**실행 시간**: ${Math.round(overall.duration / 1000)}초\n\n`;
    
    // 전체 요약
    report += `## 📊 전체 요약\n\n`;
    report += `- **전체 상태**: ${overall.passed ? '✅ 통과' : '❌ 실패'}\n`;
    report += `- **통과율**: ${overall.passRate}% (${overall.passedTests}/${overall.totalTests})\n`;
    report += `- **통과 테스트**: ${overall.passedTests}개\n`;
    report += `- **실패 테스트**: ${overall.failedTests}개\n`;
    report += `- **건너뛴 테스트**: ${overall.skippedTests}개\n\n`;
    
    // 테스트 스위트별 결과
    report += `## 📋 테스트 스위트별 결과\n\n`;
    report += `| 테스트 스위트 | 상태 | 실행 시간 | 비고 |\n`;
    report += `|-------------|------|----------|------|\n`;
    
    const suites = [
      { key: 'userAcceptance', name: '사용자 시나리오 테스트' },
      { key: 'crossBrowser', name: '크로스 브라우저 테스트' },
      { key: 'mobileResponsive', name: '모바일 반응형 테스트' },
      { key: 'accessibilityAdvanced', name: '접근성 고급 테스트' }
    ];

    suites.forEach(suite => {
      const result = this.results[suite.key];
      if (result) {
        const status = result.passed ? '✅ 통과' : '❌ 실패';
        const duration = `${Math.round(result.duration / 1000)}초`;
        const note = result.passed ? '-' : '확인 필요';
        
        report += `| ${suite.name} | ${status} | ${duration} | ${note} |\n`;
      } else {
        report += `| ${suite.name} | ⏭️ 건너뜀 | - | 설정으로 제외 |\n`;
      }
    });
    
    report += `\n`;
    
    // 상세 결과
    report += `## 📝 상세 테스트 결과\n\n`;
    
    suites.forEach(suite => {
      const result = this.results[suite.key];
      if (result) {
        report += `### ${suite.name}\n`;
        report += `- **상태**: ${result.passed ? '✅ 통과' : '❌ 실패'}\n`;
        report += `- **실행 시간**: ${Math.round(result.duration / 1000)}초\n`;
        report += `- **실행 일시**: ${new Date(result.timestamp).toLocaleString('ko-KR')}\n`;
        
        if (!result.passed && result.error) {
          report += `- **에러 내용**: \`${result.error}\`\n`;
        }
        
        report += `\n`;
      }
    });
    
    // 권장사항
    report += `## 💡 권장사항\n\n`;
    const recommendations = this.generateRecommendations();
    recommendations.forEach(rec => {
      report += `- ${rec}\n`;
    });
    
    // 다음 단계
    report += `\n## 🚀 다음 단계\n\n`;
    if (overall.passed) {
      report += `✅ **모든 UAT 테스트가 통과했습니다!**\n\n`;
      report += `다음 단계로 진행할 수 있습니다:\n`;
      report += `- 문서화 완성 (API 문서, 사용자 가이드 등)\n`;
      report += `- 프로덕션 배포 준비\n`;
      report += `- 최종 품질 검증\n`;
    } else {
      report += `❌ **일부 테스트가 실패했습니다.**\n\n`;
      report += `다음 작업이 필요합니다:\n`;
      
      suites.forEach(suite => {
        const result = this.results[suite.key];
        if (result && !result.passed) {
          report += `- ${suite.name} 문제 해결\n`;
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
    const { overall } = this.results;
    
    if (overall.passRate === 100) {
      recommendations.push('🎉 모든 UAT 테스트가 성공했습니다! 품질이 우수합니다.');
      recommendations.push('📚 사용자 문서화를 완성하고 배포를 준비하세요.');
      recommendations.push('🔄 정기적인 UAT 테스트를 통해 품질을 유지하세요.');
    } else {
      if (overall.passRate >= 80) {
        recommendations.push('⚠️ 대부분의 테스트가 통과했지만 일부 개선이 필요합니다.');
      } else {
        recommendations.push('🚨 많은 테스트가 실패했습니다. 우선적으로 해결이 필요합니다.');
      }
      
      if (this.results.userAcceptance && !this.results.userAcceptance.passed) {
        recommendations.push('👥 핵심 사용자 시나리오를 다시 검토하세요.');
      }
      
      if (this.results.crossBrowser && !this.results.crossBrowser.passed) {
        recommendations.push('🌐 브라우저 호환성 문제를 해결하세요.');
      }
      
      if (this.results.mobileResponsive && !this.results.mobileResponsive.passed) {
        recommendations.push('📱 모바일 반응형 디자인을 개선하세요.');
      }
      
      if (this.results.accessibilityAdvanced && !this.results.accessibilityAdvanced.passed) {
        recommendations.push('♿ 웹 접근성 기준을 충족하도록 수정하세요.');
      }
    }
    
    recommendations.push('📊 테스트 결과를 팀과 공유하고 개선 계획을 세우세요.');
    recommendations.push('🔧 실패한 테스트는 개별적으로 디버깅하여 원인을 파악하세요.');
    
    return recommendations;
  }

  /**
   * 디렉토리 생성
   */
  async ensureDirectories() {
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
  args.forEach((arg, index) => {
    if (arg.startsWith('--')) {
      const key = arg.replace('--', '');
      const value = args[index + 1] && !args[index + 1].startsWith('--') ? args[index + 1] : true;
      
      if (key === 'verbose' || key === 'parallel') {
        options[key] = true;
      } else if (key === 'skip-browsers') {
        options.skipBrowsers = value === true ? ['all'] : value.split(',');
      } else if (value !== true) {
        options[key.replace('-', '')] = value;
      }
    }
  });
  
  const suite = new UATTestSuite(options);
  
  suite.run()
    .then(results => {
      console.log('\n🎯 UAT 테스트 최종 결과:');
      console.log(`전체 상태: ${results.overall.passed ? '✅ 통과' : '❌ 실패'}`);
      console.log(`통과율: ${results.overall.passRate}% (${results.overall.passedTests}/${results.overall.totalTests})`);
      console.log(`실행 시간: ${Math.round(results.overall.duration / 1000)}초`);
      
      const reportPath = path.resolve(suite.outputDir, 'uat-comprehensive-report.md');
      console.log(`📄 상세 리포트: ${reportPath}`);
      
      if (!results.overall.passed) {
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('UAT 테스트 실행 실패:', error.message);
      process.exit(1);
    });
}

module.exports = UATTestSuite;