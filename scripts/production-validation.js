#!/usr/bin/env node

/**
 * 프로덕션 배포 전 검증 스크립트
 * 모든 필수 요소들이 배포 준비 상태인지 확인합니다.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 색상 출력을 위한 유틸리티
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  log(`\n${'='.repeat(50)}`, 'cyan');
  log(`${title}`, 'bright');
  log(`${'='.repeat(50)}`, 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

// 검증 결과 추적
const validationResults = {
  passed: [],
  failed: [],
  warnings: [],
};

function addResult(type, message) {
  validationResults[type].push(message);
}

/**
 * 파일 존재 여부 확인
 */
function checkFileExists(filePath, description) {
  const fullPath = path.resolve(filePath);
  if (fs.existsSync(fullPath)) {
    logSuccess(`${description}: ${filePath}`);
    addResult('passed', description);
    return true;
  } else {
    logError(`${description} 누락: ${filePath}`);
    addResult('failed', description);
    return false;
  }
}

/**
 * 명령어 실행 및 결과 확인
 */
function runCommand(command, description, options = {}) {
  try {
    log(`실행 중: ${command}`, 'blue');
    const result = execSync(command, {
      encoding: 'utf-8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options,
    });
    
    if (!options.silent) {
      logSuccess(`${description} 성공`);
    }
    addResult('passed', description);
    return result;
  } catch (error) {
    logError(`${description} 실패: ${error.message}`);
    addResult('failed', description);
    return null;
  }
}

/**
 * package.json 검증
 */
function validatePackageJson() {
  logSection('Package.json 검증');
  
  const packagePath = 'package.json';
  if (!checkFileExists(packagePath, 'Package.json')) {
    return false;
  }

  try {
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
    
    // 필수 필드 확인
    const requiredFields = ['name', 'version', 'scripts'];
    for (const field of requiredFields) {
      if (packageJson[field]) {
        logSuccess(`필수 필드 존재: ${field}`);
      } else {
        logError(`필수 필드 누락: ${field}`);
        addResult('failed', `Package.json ${field} 필드`);
      }
    }

    // 필수 스크립트 확인
    const requiredScripts = ['build', 'test', 'lint', 'type-check'];
    for (const script of requiredScripts) {
      if (packageJson.scripts && packageJson.scripts[script]) {
        logSuccess(`필수 스크립트 존재: ${script}`);
      } else {
        logWarning(`권장 스크립트 누락: ${script}`);
        addResult('warnings', `Package.json ${script} 스크립트`);
      }
    }

    return true;
  } catch (error) {
    logError(`Package.json 파싱 오류: ${error.message}`);
    addResult('failed', 'Package.json 파싱');
    return false;
  }
}

/**
 * 의존성 설치 확인
 */
function validateDependencies() {
  logSection('의존성 검증');
  
  if (checkFileExists('node_modules', 'Node modules 디렉토리')) {
    logSuccess('의존성이 설치되어 있습니다');
  } else {
    logWarning('의존성을 설치해야 합니다');
    addResult('warnings', '의존성 설치');
    
    // 의존성 설치 시도
    log('의존성을 설치하고 있습니다...', 'yellow');
    runCommand('pnpm install', '의존성 설치');
  }

  // Lock 파일 확인
  checkFileExists('pnpm-lock.yaml', 'pnpm lock 파일');
}

/**
 * 타입 검사
 */
function validateTypes() {
  logSection('TypeScript 타입 검증');
  
  // TypeScript 설정 파일 확인
  const tsConfigs = [
    'apps/client/tsconfig.json',
    'apps/server/tsconfig.json',
    'packages/types/tsconfig.json',
  ];

  let hasTypeScript = false;
  for (const config of tsConfigs) {
    if (checkFileExists(config, `TypeScript 설정 (${config})`)) {
      hasTypeScript = true;
    }
  }

  if (hasTypeScript) {
    // 타입 검사 실행
    runCommand('pnpm type-check', 'TypeScript 타입 검사');
  } else {
    logWarning('TypeScript 설정 파일이 없습니다');
    addResult('warnings', 'TypeScript 설정');
  }
}

/**
 * 린트 검사
 */
function validateLinting() {
  logSection('ESLint 검증');
  
  // ESLint 설정 파일 확인
  const eslintConfigs = ['.eslintrc.json', '.eslintrc.js', 'eslint.config.js'];
  let hasEslint = false;
  
  for (const config of eslintConfigs) {
    if (fs.existsSync(config)) {
      checkFileExists(config, 'ESLint 설정');
      hasEslint = true;
      break;
    }
  }

  if (hasEslint) {
    // 린트 검사 실행
    runCommand('pnpm lint', 'ESLint 검사');
  } else {
    logWarning('ESLint 설정 파일이 없습니다');
    addResult('warnings', 'ESLint 설정');
  }
}

/**
 * 테스트 실행
 */
function validateTests() {
  logSection('테스트 검증');
  
  // 테스트 파일 존재 확인
  const testDirs = ['src/__tests__', 'tests', 'e2e'];
  let hasTests = false;
  
  for (const dir of testDirs) {
    if (fs.existsSync(dir)) {
      logSuccess(`테스트 디렉토리 발견: ${dir}`);
      hasTests = true;
    }
  }

  if (hasTests) {
    // 테스트 실행
    runCommand('pnpm test --run', '단위 테스트 실행');
  } else {
    logWarning('테스트 파일이 없습니다');
    addResult('warnings', '테스트 파일');
  }
}

/**
 * 빌드 검증
 */
function validateBuild() {
  logSection('빌드 검증');
  
  // 빌드 실행
  const buildResult = runCommand('pnpm build', '프로덕션 빌드');
  
  if (buildResult !== null) {
    // 빌드 출력물 확인
    const buildDirs = ['dist', 'build', 'apps/client/dist'];
    let hasBuildOutput = false;
    
    for (const dir of buildDirs) {
      if (fs.existsSync(dir)) {
        logSuccess(`빌드 출력물 확인: ${dir}`);
        hasBuildOutput = true;
        
        // 빌드 크기 정보
        try {
          const stats = fs.statSync(dir);
          if (stats.isDirectory()) {
            const files = fs.readdirSync(dir);
            logSuccess(`빌드 파일 수: ${files.length}개`);
          }
        } catch (error) {
          // 무시
        }
        break;
      }
    }
    
    if (!hasBuildOutput) {
      logWarning('빌드 출력물을 찾을 수 없습니다');
      addResult('warnings', '빌드 출력물');
    }
  }
}

/**
 * 환경 변수 검증
 */
function validateEnvironment() {
  logSection('환경 변수 검증');
  
  // 환경 파일 확인
  const envFiles = ['.env.example', '.env.local', '.env.production'];
  
  for (const envFile of envFiles) {
    if (fs.existsSync(envFile)) {
      checkFileExists(envFile, `환경 변수 파일 (${envFile})`);
    }
  }

  // 필수 환경 변수 확인 (예시)
  const requiredEnvVars = [
    'VITE_API_BASE_URL',
    'VITE_AUTH_DOMAIN',
  ];

  for (const envVar of requiredEnvVars) {
    if (process.env[envVar]) {
      logSuccess(`환경 변수 설정됨: ${envVar}`);
    } else {
      logWarning(`환경 변수 누락: ${envVar}`);
      addResult('warnings', `환경 변수 ${envVar}`);
    }
  }
}

/**
 * 보안 검사
 */
function validateSecurity() {
  logSection('보안 검증');
  
  // 민감한 파일들이 .gitignore에 있는지 확인
  if (fs.existsSync('.gitignore')) {
    const gitignore = fs.readFileSync('.gitignore', 'utf-8');
    const sensitivePatterns = ['.env', 'node_modules', 'dist', '*.log'];
    
    for (const pattern of sensitivePatterns) {
      if (gitignore.includes(pattern)) {
        logSuccess(`GitIgnore 규칙 확인: ${pattern}`);
      } else {
        logWarning(`GitIgnore 규칙 누락: ${pattern}`);
        addResult('warnings', `GitIgnore ${pattern}`);
      }
    }
  }

  // npm audit 실행
  runCommand('pnpm audit --audit-level moderate', '보안 취약점 검사', { silent: true });
}

/**
 * 문서 검증
 */
function validateDocumentation() {
  logSection('문서 검증');
  
  const docFiles = [
    'README.md',
    'docs/api/openapi.yaml',
    'docs/guides/user-guide.md',
    'docs/guides/developer-guide.md',
    'docs/guides/operations-manual.md',
  ];

  for (const docFile of docFiles) {
    checkFileExists(docFile, `문서 파일 (${docFile})`);
  }
}

/**
 * 최종 결과 출력
 */
function printResults() {
  logSection('검증 결과 요약');
  
  log(`\n통과한 검사: ${validationResults.passed.length}개`, 'green');
  for (const item of validationResults.passed.slice(0, 5)) {
    log(`  ✅ ${item}`, 'green');
  }
  if (validationResults.passed.length > 5) {
    log(`  ... 외 ${validationResults.passed.length - 5}개`, 'green');
  }

  if (validationResults.warnings.length > 0) {
    log(`\n경고사항: ${validationResults.warnings.length}개`, 'yellow');
    for (const item of validationResults.warnings.slice(0, 5)) {
      log(`  ⚠️  ${item}`, 'yellow');
    }
    if (validationResults.warnings.length > 5) {
      log(`  ... 외 ${validationResults.warnings.length - 5}개`, 'yellow');
    }
  }

  if (validationResults.failed.length > 0) {
    log(`\n실패한 검사: ${validationResults.failed.length}개`, 'red');
    for (const item of validationResults.failed) {
      log(`  ❌ ${item}`, 'red');
    }
  }

  // 전체 결과 판정
  log('\n' + '='.repeat(50), 'cyan');
  if (validationResults.failed.length === 0) {
    if (validationResults.warnings.length === 0) {
      log('🎉 모든 검증을 통과했습니다! 프로덕션 배포 준비 완료', 'green');
      process.exit(0);
    } else {
      log('✅ 기본 검증을 통과했지만 경고사항이 있습니다', 'yellow');
      log('경고사항을 검토한 후 배포를 진행하세요', 'yellow');
      process.exit(0);
    }
  } else {
    log('❌ 검증에 실패했습니다. 문제를 해결한 후 다시 시도하세요', 'red');
    process.exit(1);
  }
}

/**
 * 메인 실행 함수
 */
async function main() {
  log('🚀 프로덕션 배포 검증을 시작합니다...', 'bright');
  log(`실행 시간: ${new Date().toISOString()}`, 'blue');
  
  // 모든 검증 단계 실행
  validatePackageJson();
  validateDependencies();
  validateTypes();
  validateLinting();
  validateTests();
  validateBuild();
  validateEnvironment();
  validateSecurity();
  validateDocumentation();
  
  // 결과 출력
  printResults();
}

// 스크립트 실행
if (require.main === module) {
  main().catch(error => {
    console.error('검증 중 오류 발생:', error);
    process.exit(1);
  });
}

module.exports = {
  main,
  validatePackageJson,
  validateDependencies,
  validateTypes,
  validateLinting,
  validateTests,
  validateBuild,
  validateEnvironment,
  validateSecurity,
  validateDocumentation,
};