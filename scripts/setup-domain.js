#!/usr/bin/env node

/**
 * 도메인 설정 및 SSL 인증서 자동화 스크립트
 * AWS Route 53, CloudFront, Certificate Manager를 통한 도메인 설정
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

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

/**
 * AWS CLI 설치 및 구성 확인
 */
function checkAwsCli() {
  logSection('AWS CLI 확인');
  
  try {
    const version = execSync('aws --version', { encoding: 'utf-8' });
    logSuccess(`AWS CLI 설치됨: ${version.trim()}`);
    
    // AWS 자격 증명 확인
    try {
      const identity = execSync('aws sts get-caller-identity', { encoding: 'utf-8' });
      const identityData = JSON.parse(identity);
      logSuccess(`AWS 계정: ${identityData.Account}`);
      logSuccess(`AWS 사용자: ${identityData.Arn}`);
      return true;
    } catch (error) {
      logError('AWS 자격 증명이 구성되지 않았습니다');
      logInfo('다음 명령으로 AWS 자격 증명을 설정하세요:');
      logInfo('aws configure');
      return false;
    }
  } catch (error) {
    logError('AWS CLI가 설치되지 않았습니다');
    logInfo('AWS CLI 설치: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html');
    return false;
  }
}

/**
 * 도메인 설정 정보 입력
 */
function getDomainConfig() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    const config = {};
    
    logSection('도메인 설정 정보 입력');
    
    rl.question('도메인 이름을 입력하세요 (예: todo-app.com): ', (domain) => {
      config.domain = domain.trim();
      
      rl.question('서브도메인을 사용하시겠습니까? (y/N): ', (useSubdomain) => {
        config.useSubdomain = useSubdomain.toLowerCase() === 'y';
        
        if (config.useSubdomain) {
          rl.question('서브도메인을 입력하세요 (예: app): ', (subdomain) => {
            config.subdomain = subdomain.trim();
            config.fullDomain = `${config.subdomain}.${config.domain}`;
            rl.close();
            resolve(config);
          });
        } else {
          config.fullDomain = config.domain;
          rl.close();
          resolve(config);
        }
      });
    });
  });
}

/**
 * Route 53 호스팅 영역 생성 또는 확인
 */
function setupHostedZone(domain) {
  logSection('Route 53 호스팅 영역 설정');
  
  try {
    // 기존 호스팅 영역 확인
    const listCommand = `aws route53 list-hosted-zones-by-name --dns-name ${domain}`;
    const zones = JSON.parse(execSync(listCommand, { encoding: 'utf-8' }));
    
    const existingZone = zones.HostedZones.find(zone => 
      zone.Name === `${domain}.` && !zone.Config?.PrivateZone
    );
    
    if (existingZone) {
      logSuccess(`기존 호스팅 영역 발견: ${existingZone.Id}`);
      return existingZone.Id.replace('/hostedzone/', '');
    }
    
    // 새 호스팅 영역 생성
    logInfo('새 호스팅 영역을 생성합니다...');
    const createCommand = `aws route53 create-hosted-zone --name ${domain} --caller-reference ${Date.now()}`;
    const result = JSON.parse(execSync(createCommand, { encoding: 'utf-8' }));
    
    const hostedZoneId = result.HostedZone.Id.replace('/hostedzone/', '');
    logSuccess(`호스팅 영역 생성됨: ${hostedZoneId}`);
    
    // 네임서버 정보 출력
    const nsRecords = result.DelegationSet.NameServers;
    logInfo('도메인 등록기관에서 다음 네임서버를 설정하세요:');
    nsRecords.forEach((ns, index) => {
      logInfo(`${index + 1}. ${ns}`);
    });
    
    return hostedZoneId;
  } catch (error) {
    logError(`호스팅 영역 설정 실패: ${error.message}`);
    throw error;
  }
}

/**
 * SSL 인증서 생성 (Certificate Manager)
 */
function createSslCertificate(domain, subdomains = []) {
  logSection('SSL 인증서 생성');
  
  try {
    const allDomains = [domain, ...subdomains];
    const domainList = allDomains.join(' ');
    
    logInfo(`인증서 생성 중: ${domainList}`);
    
    const requestCommand = `aws acm request-certificate \
      --domain-name ${domain} \
      ${subdomains.length > 0 ? `--subject-alternative-names ${subdomains.join(' ')}` : ''} \
      --validation-method DNS \
      --region us-east-1`;
    
    const result = JSON.parse(execSync(requestCommand, { encoding: 'utf-8' }));
    const certificateArn = result.CertificateArn;
    
    logSuccess(`인증서 요청됨: ${certificateArn}`);
    logWarning('인증서 검증을 위해 DNS 레코드를 추가해야 합니다');
    
    // 검증 레코드 정보 가져오기
    setTimeout(() => {
      try {
        const describeCommand = `aws acm describe-certificate --certificate-arn ${certificateArn} --region us-east-1`;
        const certDetails = JSON.parse(execSync(describeCommand, { encoding: 'utf-8' }));
        
        logInfo('다음 DNS 검증 레코드를 Route 53에 추가하세요:');
        certDetails.Certificate.DomainValidationOptions.forEach((validation, index) => {
          logInfo(`${index + 1}. 도메인: ${validation.DomainName}`);
          logInfo(`   레코드 이름: ${validation.ResourceRecord.Name}`);
          logInfo(`   레코드 값: ${validation.ResourceRecord.Value}`);
          logInfo(`   레코드 타입: ${validation.ResourceRecord.Type}`);
        });
      } catch (error) {
        logWarning('검증 레코드 정보를 즉시 가져올 수 없습니다. 잠시 후 다시 시도하세요.');
      }
    }, 5000);
    
    return certificateArn;
  } catch (error) {
    logError(`SSL 인증서 생성 실패: ${error.message}`);
    throw error;
  }
}

/**
 * CloudFront 배포 생성
 */
function createCloudFrontDistribution(domain, certificateArn, s3BucketDomain) {
  logSection('CloudFront 배포 생성');
  
  const distributionConfig = {
    CallerReference: `${domain}-${Date.now()}`,
    Comment: `CloudFront distribution for ${domain}`,
    DefaultCacheBehavior: {
      TargetOriginId: 'S3Origin',
      ViewerProtocolPolicy: 'redirect-to-https',
      TrustedSigners: {
        Enabled: false,
        Quantity: 0
      },
      ForwardedValues: {
        QueryString: false,
        Cookies: {
          Forward: 'none'
        }
      },
      MinTTL: 0,
      DefaultTTL: 86400,
      MaxTTL: 31536000
    },
    Origins: {
      Quantity: 1,
      Items: [
        {
          Id: 'S3Origin',
          DomainName: s3BucketDomain,
          S3OriginConfig: {
            OriginAccessIdentity: ''
          }
        }
      ]
    },
    Enabled: true,
    Aliases: {
      Quantity: 1,
      Items: [domain]
    },
    ViewerCertificate: {
      ACMCertificateArn: certificateArn,
      SSLSupportMethod: 'sni-only',
      MinimumProtocolVersion: 'TLSv1.2_2021'
    },
    PriceClass: 'PriceClass_100',
    DefaultRootObject: 'index.html',
    CustomErrorResponses: {
      Quantity: 1,
      Items: [
        {
          ErrorCode: 404,
          ResponsePagePath: '/index.html',
          ResponseCode: '200',
          ErrorCachingMinTTL: 300
        }
      ]
    }
  };

  try {
    const configFile = `/tmp/cloudfront-config-${Date.now()}.json`;
    fs.writeFileSync(configFile, JSON.stringify(distributionConfig, null, 2));
    
    const createCommand = `aws cloudfront create-distribution --distribution-config file://${configFile}`;
    const result = JSON.parse(execSync(createCommand, { encoding: 'utf-8' }));
    
    const distributionId = result.Distribution.Id;
    const distributionDomain = result.Distribution.DomainName;
    
    logSuccess(`CloudFront 배포 생성됨: ${distributionId}`);
    logSuccess(`배포 도메인: ${distributionDomain}`);
    
    // 설정 파일 정리
    fs.unlinkSync(configFile);
    
    return {
      distributionId,
      distributionDomain
    };
  } catch (error) {
    logError(`CloudFront 배포 생성 실패: ${error.message}`);
    throw error;
  }
}

/**
 * Route 53 A 레코드 생성
 */
function createARecord(hostedZoneId, domain, cloudFrontDomain) {
  logSection('Route 53 A 레코드 생성');
  
  const changeSet = {
    Changes: [
      {
        Action: 'UPSERT',
        ResourceRecordSet: {
          Name: domain,
          Type: 'A',
          AliasTarget: {
            DNSName: cloudFrontDomain,
            EvaluateTargetHealth: false,
            HostedZoneId: 'Z2FDTNDATAQYW2' // CloudFront 호스팅 영역 ID
          }
        }
      }
    ]
  };

  try {
    const configFile = `/tmp/route53-change-${Date.now()}.json`;
    fs.writeFileSync(configFile, JSON.stringify(changeSet, null, 2));
    
    const changeCommand = `aws route53 change-resource-record-sets --hosted-zone-id ${hostedZoneId} --change-batch file://${configFile}`;
    const result = JSON.parse(execSync(changeCommand, { encoding: 'utf-8' }));
    
    logSuccess(`A 레코드 생성됨: ${domain} -> ${cloudFrontDomain}`);
    logSuccess(`변경 ID: ${result.ChangeInfo.Id}`);
    
    // 설정 파일 정리
    fs.unlinkSync(configFile);
    
    return result.ChangeInfo.Id;
  } catch (error) {
    logError(`A 레코드 생성 실패: ${error.message}`);
    throw error;
  }
}

/**
 * 배포 상태 확인
 */
function checkDistributionStatus(distributionId) {
  logSection('배포 상태 확인');
  
  try {
    const getCommand = `aws cloudfront get-distribution --id ${distributionId}`;
    const result = JSON.parse(execSync(getCommand, { encoding: 'utf-8' }));
    
    const status = result.Distribution.Status;
    logInfo(`배포 상태: ${status}`);
    
    if (status === 'Deployed') {
      logSuccess('배포가 완료되었습니다!');
      return true;
    } else {
      logWarning('배포가 아직 진행 중입니다. 완료까지 최대 15분이 소요될 수 있습니다.');
      return false;
    }
  } catch (error) {
    logError(`배포 상태 확인 실패: ${error.message}`);
    return false;
  }
}

/**
 * 설정 정보를 파일로 저장
 */
function saveConfiguration(config) {
  logSection('설정 정보 저장');
  
  const configData = {
    timestamp: new Date().toISOString(),
    domain: config.domain,
    fullDomain: config.fullDomain,
    hostedZoneId: config.hostedZoneId,
    certificateArn: config.certificateArn,
    distributionId: config.distributionId,
    distributionDomain: config.distributionDomain,
    status: 'configured'
  };

  try {
    const configDir = 'config';
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    const configFile = path.join(configDir, 'domain-config.json');
    fs.writeFileSync(configFile, JSON.stringify(configData, null, 2));
    
    logSuccess(`설정 정보 저장됨: ${configFile}`);
    
    // 환경 변수 파일 업데이트
    updateEnvironmentFile(config);
  } catch (error) {
    logError(`설정 정보 저장 실패: ${error.message}`);
  }
}

/**
 * 환경 변수 파일 업데이트
 */
function updateEnvironmentFile(config) {
  const envFile = '.env.production';
  let envContent = '';
  
  if (fs.existsSync(envFile)) {
    envContent = fs.readFileSync(envFile, 'utf-8');
  }
  
  // 도메인 관련 환경 변수 추가/업데이트
  const domainVars = [
    `VITE_DOMAIN=${config.fullDomain}`,
    `VITE_API_BASE_URL=https://api.${config.domain}`,
    `VITE_CDN_URL=https://${config.distributionDomain}`,
  ];
  
  for (const varLine of domainVars) {
    const [key] = varLine.split('=');
    const regex = new RegExp(`^${key}=.*$`, 'm');
    
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, varLine);
    } else {
      envContent += `\n${varLine}`;
    }
  }
  
  fs.writeFileSync(envFile, envContent.trim() + '\n');
  logSuccess(`환경 변수 파일 업데이트됨: ${envFile}`);
}

/**
 * 최종 확인 및 안내
 */
function printFinalInstructions(config) {
  logSection('설정 완료 및 다음 단계');
  
  logSuccess('도메인 설정이 완료되었습니다!');
  
  log('\n📋 설정 요약:', 'bright');
  log(`   도메인: ${config.fullDomain}`, 'cyan');
  log(`   호스팅 영역 ID: ${config.hostedZoneId}`, 'cyan');
  log(`   SSL 인증서 ARN: ${config.certificateArn}`, 'cyan');
  log(`   CloudFront 배포 ID: ${config.distributionId}`, 'cyan');
  log(`   CloudFront 도메인: ${config.distributionDomain}`, 'cyan');
  
  log('\n🔄 다음 단계:', 'bright');
  log('1. SSL 인증서 DNS 검증 완료 (위에 표시된 DNS 레코드 추가)');
  log('2. CloudFront 배포 완료 대기 (최대 15분)');
  log('3. 도메인 등록기관에서 네임서버 설정 (위에 표시된 네임서버)');
  log('4. DNS 전파 대기 (최대 48시간)');
  log('5. 브라우저에서 도메인 접속 테스트');
  
  log('\n⚙️  유용한 명령어:', 'bright');
  log(`aws acm describe-certificate --certificate-arn ${config.certificateArn} --region us-east-1`);
  log(`aws cloudfront get-distribution --id ${config.distributionId}`);
  log(`aws route53 list-resource-record-sets --hosted-zone-id ${config.hostedZoneId}`);
  
  log('\n🌐 도메인 상태 확인:', 'bright');
  log(`https://www.whatsmydns.net/#A/${config.fullDomain}`);
  log(`https://www.ssllabs.com/ssltest/analyze.html?d=${config.fullDomain}`);
}

/**
 * 메인 실행 함수
 */
async function main() {
  log('🌐 도메인 설정 및 SSL 인증서 자동화를 시작합니다...', 'bright');
  
  try {
    // AWS CLI 확인
    if (!checkAwsCli()) {
      process.exit(1);
    }
    
    // 도메인 설정 정보 입력
    const domainConfig = await getDomainConfig();
    log(`\n설정할 도메인: ${domainConfig.fullDomain}`, 'cyan');
    
    // S3 버킷 도메인 (예시)
    const s3BucketDomain = `${domainConfig.domain.replace('.', '-')}-static.s3.amazonaws.com`;
    
    // 단계별 실행
    const hostedZoneId = setupHostedZone(domainConfig.domain);
    const certificateArn = createSslCertificate(domainConfig.fullDomain);
    
    logWarning('SSL 인증서 검증을 위해 잠시 대기 중...');
    logInfo('실제 운영 환경에서는 DNS 검증이 완료된 후 다음 단계를 진행하세요.');
    
    // 실제로는 인증서 검증 완료를 기다려야 함
    // await waitForCertificateValidation(certificateArn);
    
    const distribution = createCloudFrontDistribution(
      domainConfig.fullDomain,
      certificateArn,
      s3BucketDomain
    );
    
    createARecord(hostedZoneId, domainConfig.fullDomain, distribution.distributionDomain);
    
    // 설정 정보 저장
    const finalConfig = {
      ...domainConfig,
      hostedZoneId,
      certificateArn,
      distributionId: distribution.distributionId,
      distributionDomain: distribution.distributionDomain
    };
    
    saveConfiguration(finalConfig);
    printFinalInstructions(finalConfig);
    
  } catch (error) {
    logError(`도메인 설정 중 오류 발생: ${error.message}`);
    process.exit(1);
  }
}

// 스크립트 실행
if (require.main === module) {
  main().catch(error => {
    console.error('실행 중 오류:', error);
    process.exit(1);
  });
}

module.exports = {
  main,
  checkAwsCli,
  setupHostedZone,
  createSslCertificate,
  createCloudFrontDistribution,
  createARecord,
};