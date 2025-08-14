#!/usr/bin/env node

/**
 * 모니터링 및 알람 설정 스크립트
 * CloudWatch, AWS SNS를 통한 종합적인 모니터링 시스템 구축
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
 * 모니터링 설정 정보
 */
const MONITORING_CONFIG = {
  // CloudWatch 알람 임계값
  thresholds: {
    errorRate: 5,          // 5% 이상 에러율
    responseTime: 5000,    // 5초 이상 응답시간
    availability: 95,      // 95% 이하 가용성
    cpuUtilization: 80,    // 80% 이상 CPU 사용률
    memoryUtilization: 85, // 85% 이상 메모리 사용률
    diskUtilization: 90,   // 90% 이상 디스크 사용률
  },
  
  // 알람 대상
  notifications: {
    critical: [],  // 크리티컬 알람 수신자
    warning: [],   // 경고 알람 수신자
    info: [],      // 정보 알람 수신자
  },
  
  // 모니터링 대상 리소스
  resources: {
    cloudfront: null,    // CloudFront 배포 ID
    s3: null,           // S3 버킷명
    lambda: [],         // Lambda 함수들
    apigateway: null,   // API Gateway ID
  }
};

/**
 * SNS 토픽 생성
 */
function createSNSTopics() {
  logSection('SNS 알림 토픽 생성');
  
  const topics = ['critical-alerts', 'warning-alerts', 'info-alerts'];
  const createdTopics = {};
  
  for (const topicName of topics) {
    try {
      const createCommand = `aws sns create-topic --name todo-app-${topicName}`;
      const result = JSON.parse(execSync(createCommand, { encoding: 'utf-8' }));
      createdTopics[topicName] = result.TopicArn;
      logSuccess(`SNS 토픽 생성됨: ${topicName}`);
      logInfo(`토픽 ARN: ${result.TopicArn}`);
    } catch (error) {
      logError(`SNS 토픽 생성 실패 (${topicName}): ${error.message}`);
    }
  }
  
  return createdTopics;
}

/**
 * 이메일 구독 설정
 */
function setupEmailSubscriptions(topics, emails) {
  logSection('이메일 알림 구독 설정');
  
  for (const [topicName, topicArn] of Object.entries(topics)) {
    for (const email of emails) {
      try {
        const subscribeCommand = `aws sns subscribe --topic-arn ${topicArn} --protocol email --notification-endpoint ${email}`;
        execSync(subscribeCommand);
        logSuccess(`이메일 구독 설정됨: ${email} -> ${topicName}`);
        logInfo('이메일로 전송된 구독 확인 링크를 클릭하세요');
      } catch (error) {
        logError(`이메일 구독 설정 실패 (${email}): ${error.message}`);
      }
    }
  }
}

/**
 * CloudFront 모니터링 설정
 */
function setupCloudFrontMonitoring(distributionId, snsTopics) {
  logSection('CloudFront 모니터링 설정');
  
  const alarms = [
    {
      name: 'CloudFront-HighErrorRate',
      description: 'CloudFront 에러율 높음',
      metricName: '4xxErrorRate',
      threshold: MONITORING_CONFIG.thresholds.errorRate,
      comparisonOperator: 'GreaterThanThreshold',
      treatMissingData: 'notBreaching',
      snsTopicArn: snsTopics['critical-alerts']
    },
    {
      name: 'CloudFront-5xxErrors',
      description: 'CloudFront 서버 에러',
      metricName: '5xxErrorRate',
      threshold: 1,
      comparisonOperator: 'GreaterThanThreshold',
      treatMissingData: 'notBreaching',
      snsTopicArn: snsTopics['critical-alerts']
    },
    {
      name: 'CloudFront-LowCacheHitRate',
      description: 'CloudFront 캐시 히트율 낮음',
      metricName: 'CacheHitRate',
      threshold: 80,
      comparisonOperator: 'LessThanThreshold',
      treatMissingData: 'notBreaching',
      snsTopicArn: snsTopics['warning-alerts']
    }
  ];

  for (const alarm of alarms) {
    try {
      const alarmConfig = {
        AlarmName: `todo-app-${alarm.name}`,
        AlarmDescription: alarm.description,
        MetricName: alarm.metricName,
        Namespace: 'AWS/CloudFront',
        Statistic: 'Average',
        Dimensions: [
          {
            Name: 'DistributionId',
            Value: distributionId
          }
        ],
        Period: 300,
        EvaluationPeriods: 2,
        Threshold: alarm.threshold,
        ComparisonOperator: alarm.comparisonOperator,
        TreatMissingData: alarm.treatMissingData,
        AlarmActions: [alarm.snsTopicArn]
      };

      const configFile = `/tmp/alarm-${alarm.name}-${Date.now()}.json`;
      fs.writeFileSync(configFile, JSON.stringify(alarmConfig, null, 2));
      
      const createCommand = `aws cloudwatch put-metric-alarm --cli-input-json file://${configFile}`;
      execSync(createCommand);
      
      logSuccess(`CloudFront 알람 생성됨: ${alarm.name}`);
      fs.unlinkSync(configFile);
    } catch (error) {
      logError(`CloudFront 알람 생성 실패 (${alarm.name}): ${error.message}`);
    }
  }
}

/**
 * Lambda 함수 모니터링 설정
 */
function setupLambdaMonitoring(functionNames, snsTopics) {
  logSection('Lambda 함수 모니터링 설정');
  
  for (const functionName of functionNames) {
    const alarms = [
      {
        name: `Lambda-${functionName}-Errors`,
        description: `Lambda 함수 에러: ${functionName}`,
        metricName: 'Errors',
        threshold: 5,
        comparisonOperator: 'GreaterThanThreshold',
        snsTopicArn: snsTopics['critical-alerts']
      },
      {
        name: `Lambda-${functionName}-Duration`,
        description: `Lambda 함수 실행 시간: ${functionName}`,
        metricName: 'Duration',
        threshold: 30000, // 30초
        comparisonOperator: 'GreaterThanThreshold',
        snsTopicArn: snsTopics['warning-alerts']
      },
      {
        name: `Lambda-${functionName}-Throttles`,
        description: `Lambda 함수 스로틀링: ${functionName}`,
        metricName: 'Throttles',
        threshold: 0,
        comparisonOperator: 'GreaterThanThreshold',
        snsTopicArn: snsTopics['critical-alerts']
      }
    ];

    for (const alarm of alarms) {
      try {
        const alarmConfig = {
          AlarmName: `todo-app-${alarm.name}`,
          AlarmDescription: alarm.description,
          MetricName: alarm.metricName,
          Namespace: 'AWS/Lambda',
          Statistic: 'Sum',
          Dimensions: [
            {
              Name: 'FunctionName',
              Value: functionName
            }
          ],
          Period: 300,
          EvaluationPeriods: 1,
          Threshold: alarm.threshold,
          ComparisonOperator: alarm.comparisonOperator,
          TreatMissingData: 'notBreaching',
          AlarmActions: [alarm.snsTopicArn]
        };

        const configFile = `/tmp/alarm-${alarm.name}-${Date.now()}.json`;
        fs.writeFileSync(configFile, JSON.stringify(alarmConfig, null, 2));
        
        const createCommand = `aws cloudwatch put-metric-alarm --cli-input-json file://${configFile}`;
        execSync(createCommand);
        
        logSuccess(`Lambda 알람 생성됨: ${alarm.name}`);
        fs.unlinkSync(configFile);
      } catch (error) {
        logError(`Lambda 알람 생성 실패 (${alarm.name}): ${error.message}`);
      }
    }
  }
}

/**
 * 커스텀 메트릭 생성
 */
function setupCustomMetrics() {
  logSection('커스텀 메트릭 설정');
  
  // 애플리케이션 레벨 메트릭을 위한 CloudWatch 로그 그룹
  try {
    const logGroupName = '/aws/lambda/todo-app-metrics';
    const createLogGroupCommand = `aws logs create-log-group --log-group-name ${logGroupName}`;
    execSync(createLogGroupCommand);
    logSuccess(`CloudWatch 로그 그룹 생성됨: ${logGroupName}`);
    
    // 로그 보존 기간 설정 (30일)
    const retentionCommand = `aws logs put-retention-policy --log-group-name ${logGroupName} --retention-in-days 30`;
    execSync(retentionCommand);
    logSuccess('로그 보존 기간 설정됨: 30일');
    
  } catch (error) {
    if (error.message.includes('ResourceAlreadyExistsException')) {
      logWarning('CloudWatch 로그 그룹이 이미 존재합니다');
    } else {
      logError(`CloudWatch 로그 그룹 생성 실패: ${error.message}`);
    }
  }
  
  // 메트릭 필터 생성
  const metricFilters = [
    {
      filterName: 'UserRegistrations',
      filterPattern: '[timestamp, requestId, level="INFO", message="USER_REGISTERED", ...]',
      metricTransformation: {
        metricName: 'UserRegistrations',
        metricNamespace: 'TodoApp/Business',
        metricValue: '1'
      }
    },
    {
      filterName: 'TodoCreations',
      filterPattern: '[timestamp, requestId, level="INFO", message="TODO_CREATED", ...]',
      metricTransformation: {
        metricName: 'TodoCreations',
        metricNamespace: 'TodoApp/Business',
        metricValue: '1'
      }
    },
    {
      filterName: 'APIErrors',
      filterPattern: '[timestamp, requestId, level="ERROR", ...]',
      metricTransformation: {
        metricName: 'APIErrors',
        metricNamespace: 'TodoApp/Application',
        metricValue: '1'
      }
    }
  ];

  for (const filter of metricFilters) {
    try {
      const filterConfig = {
        logGroupName: '/aws/lambda/todo-app-metrics',
        filterName: filter.filterName,
        filterPattern: filter.filterPattern,
        metricTransformations: [filter.metricTransformation]
      };

      const configFile = `/tmp/metric-filter-${filter.filterName}-${Date.now()}.json`;
      fs.writeFileSync(configFile, JSON.stringify(filterConfig, null, 2));
      
      const createCommand = `aws logs put-metric-filter --cli-input-json file://${configFile}`;
      execSync(createCommand);
      
      logSuccess(`메트릭 필터 생성됨: ${filter.filterName}`);
      fs.unlinkSync(configFile);
    } catch (error) {
      logError(`메트릭 필터 생성 실패 (${filter.filterName}): ${error.message}`);
    }
  }
}

/**
 * 대시보드 생성
 */
function createDashboard(distributionId, functionNames) {
  logSection('CloudWatch 대시보드 생성');
  
  const widgets = [
    // CloudFront 메트릭
    {
      type: 'metric',
      x: 0, y: 0, width: 12, height: 6,
      properties: {
        metrics: [
          ['AWS/CloudFront', 'Requests', 'DistributionId', distributionId],
          ['.', '4xxErrorRate', '.', '.'],
          ['.', '5xxErrorRate', '.', '.'],
          ['.', 'CacheHitRate', '.', '.']
        ],
        view: 'timeSeries',
        stacked: false,
        region: 'us-east-1',
        title: 'CloudFront 메트릭',
        period: 300
      }
    },
    
    // Lambda 메트릭
    {
      type: 'metric',
      x: 12, y: 0, width: 12, height: 6,
      properties: {
        metrics: functionNames.flatMap(fname => [
          ['AWS/Lambda', 'Invocations', 'FunctionName', fname],
          ['.', 'Errors', '.', fname],
          ['.', 'Duration', '.', fname]
        ]),
        view: 'timeSeries',
        stacked: false,
        region: 'us-east-1',
        title: 'Lambda 함수 메트릭',
        period: 300
      }
    },
    
    // 커스텀 비즈니스 메트릭
    {
      type: 'metric',
      x: 0, y: 6, width: 12, height: 6,
      properties: {
        metrics: [
          ['TodoApp/Business', 'UserRegistrations'],
          ['.', 'TodoCreations'],
          ['TodoApp/Application', 'APIErrors']
        ],
        view: 'timeSeries',
        stacked: false,
        region: 'us-east-1',
        title: '비즈니스 메트릭',
        period: 300,
        stat: 'Sum'
      }
    },
    
    // 알람 상태
    {
      type: 'metric',
      x: 12, y: 6, width: 12, height: 6,
      properties: {
        metrics: [
          ['AWS/CloudWatch', 'AlarmStatusTotal', 'AlarmName', 'todo-app-CloudFront-HighErrorRate'],
          ['.', '.', '.', 'todo-app-CloudFront-5xxErrors']
        ],
        view: 'singleValue',
        region: 'us-east-1',
        title: '알람 상태'
      }
    }
  ];

  const dashboardBody = {
    widgets: widgets
  };

  try {
    const createCommand = `aws cloudwatch put-dashboard --dashboard-name "TodoApp-Production" --dashboard-body '${JSON.stringify(dashboardBody)}'`;
    execSync(createCommand);
    logSuccess('CloudWatch 대시보드 생성됨: TodoApp-Production');
    logInfo('대시보드 URL: https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=TodoApp-Production');
  } catch (error) {
    logError(`대시보드 생성 실패: ${error.message}`);
  }
}

/**
 * 헬스체크 설정
 */
function setupHealthChecks(domain) {
  logSection('Route 53 헬스체크 설정');
  
  try {
    const healthCheckConfig = {
      Type: 'HTTPS',
      ResourcePath: '/health',
      FullyQualifiedDomainName: domain,
      Port: 443,
      RequestInterval: 30,
      FailureThreshold: 3
    };

    const configFile = `/tmp/healthcheck-${Date.now()}.json`;
    fs.writeFileSync(configFile, JSON.stringify(healthCheckConfig, null, 2));
    
    const createCommand = `aws route53 create-health-check --caller-reference ${Date.now()} --health-check-config file://${configFile}`;
    const result = JSON.parse(execSync(createCommand, { encoding: 'utf-8' }));
    
    const healthCheckId = result.HealthCheck.Id;
    logSuccess(`헬스체크 생성됨: ${healthCheckId}`);
    
    // 헬스체크 알람 생성
    const alarmConfig = {
      AlarmName: 'todo-app-HealthCheck-Failed',
      AlarmDescription: '웹사이트 헬스체크 실패',
      MetricName: 'HealthCheckStatus',
      Namespace: 'AWS/Route53',
      Statistic: 'Minimum',
      Dimensions: [
        {
          Name: 'HealthCheckId',
          Value: healthCheckId
        }
      ],
      Period: 60,
      EvaluationPeriods: 2,
      Threshold: 1,
      ComparisonOperator: 'LessThanThreshold',
      TreatMissingData: 'breaching'
    };

    const alarmFile = `/tmp/healthcheck-alarm-${Date.now()}.json`;
    fs.writeFileSync(alarmFile, JSON.stringify(alarmConfig, null, 2));
    
    const createAlarmCommand = `aws cloudwatch put-metric-alarm --cli-input-json file://${alarmFile}`;
    execSync(createAlarmCommand);
    
    logSuccess('헬스체크 알람 생성됨');
    
    // 설정 파일 정리
    fs.unlinkSync(configFile);
    fs.unlinkSync(alarmFile);
    
    return healthCheckId;
  } catch (error) {
    logError(`헬스체크 설정 실패: ${error.message}`);
    return null;
  }
}

/**
 * 모니터링 설정을 파일로 저장
 */
function saveMonitoringConfig(config) {
  logSection('모니터링 설정 저장');
  
  try {
    const configDir = 'config';
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    const monitoringConfig = {
      timestamp: new Date().toISOString(),
      snsTopics: config.snsTopics,
      dashboardUrl: `https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=TodoApp-Production`,
      healthCheckId: config.healthCheckId,
      alarms: {
        critical: [
          'todo-app-CloudFront-HighErrorRate',
          'todo-app-CloudFront-5xxErrors',
          'todo-app-HealthCheck-Failed'
        ],
        warning: [
          'todo-app-CloudFront-LowCacheHitRate'
        ]
      },
      metrics: {
        business: ['UserRegistrations', 'TodoCreations'],
        application: ['APIErrors'],
        infrastructure: ['CloudFront', 'Lambda']
      }
    };
    
    const configFile = path.join(configDir, 'monitoring-config.json');
    fs.writeFileSync(configFile, JSON.stringify(monitoringConfig, null, 2));
    
    logSuccess(`모니터링 설정 저장됨: ${configFile}`);
  } catch (error) {
    logError(`모니터링 설정 저장 실패: ${error.message}`);
  }
}

/**
 * 설정 정보 입력
 */
function getMonitoringConfig() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    const config = {};
    
    logSection('모니터링 설정 정보 입력');
    
    rl.question('CloudFront 배포 ID를 입력하세요: ', (distributionId) => {
      config.distributionId = distributionId.trim();
      
      rl.question('도메인을 입력하세요 (예: todo-app.com): ', (domain) => {
        config.domain = domain.trim();
        
        rl.question('알림 수신 이메일을 입력하세요 (쉼표로 구분): ', (emails) => {
          config.emails = emails.split(',').map(email => email.trim()).filter(email => email);
          
          rl.question('Lambda 함수명을 입력하세요 (쉼표로 구분, 없으면 Enter): ', (functions) => {
            config.lambdaFunctions = functions ? functions.split(',').map(f => f.trim()).filter(f => f) : [];
            
            rl.close();
            resolve(config);
          });
        });
      });
    });
  });
}

/**
 * 최종 안내 메시지
 */
function printFinalInstructions(config) {
  logSection('모니터링 설정 완료');
  
  logSuccess('모니터링 시스템이 성공적으로 구축되었습니다!');
  
  log('\n📊 설정된 모니터링 요소:', 'bright');
  log(`   CloudWatch 대시보드: TodoApp-Production`, 'cyan');
  log(`   SNS 토픽: ${Object.keys(config.snsTopics).length}개`, 'cyan');
  log(`   알람: CloudFront, Lambda, 헬스체크`, 'cyan');
  log(`   커스텀 메트릭: 비즈니스 및 애플리케이션 메트릭`, 'cyan');
  
  log('\n📧 알림 설정:', 'bright');
  log('   이메일로 전송된 구독 확인 링크를 반드시 클릭하세요');
  log('   크리티컬 알람: 즉시 대응 필요');
  log('   경고 알람: 24시간 내 검토');
  
  log('\n🔗 유용한 링크:', 'bright');
  log(`   대시보드: https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=TodoApp-Production`);
  log(`   알람: https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#alarmsV2:`);
  log(`   로그: https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups`);
  
  log('\n⚙️  모니터링 모범 사례:', 'bright');
  log('   1. 정기적인 대시보드 확인 (일 1회)');
  log('   2. 알람 임계값 주기적 검토 (월 1회)');
  log('   3. 로그 분석을 통한 트렌드 파악');
  log('   4. 성능 저하 징후 조기 발견');
  log('   5. 사용자 피드백과 메트릭 연관성 분석');
}

/**
 * 메인 실행 함수
 */
async function main() {
  log('📊 모니터링 및 알람 설정을 시작합니다...', 'bright');
  
  try {
    // AWS CLI 확인
    try {
      execSync('aws --version', { stdio: 'pipe' });
    } catch (error) {
      logError('AWS CLI가 설치되지 않았거나 구성되지 않았습니다');
      process.exit(1);
    }
    
    // 설정 정보 입력
    const userConfig = await getMonitoringConfig();
    
    // SNS 토픽 생성
    const snsTopics = createSNSTopics();
    
    // 이메일 구독 설정
    if (userConfig.emails.length > 0) {
      setupEmailSubscriptions(snsTopics, userConfig.emails);
    } else {
      logWarning('이메일이 설정되지 않았습니다. 알림을 받으려면 나중에 SNS 구독을 설정하세요.');
    }
    
    // CloudFront 모니터링
    if (userConfig.distributionId) {
      setupCloudFrontMonitoring(userConfig.distributionId, snsTopics);
    }
    
    // Lambda 모니터링
    if (userConfig.lambdaFunctions.length > 0) {
      setupLambdaMonitoring(userConfig.lambdaFunctions, snsTopics);
    }
    
    // 커스텀 메트릭 설정
    setupCustomMetrics();
    
    // 대시보드 생성
    createDashboard(userConfig.distributionId, userConfig.lambdaFunctions);
    
    // 헬스체크 설정
    const healthCheckId = setupHealthChecks(userConfig.domain);
    
    // 설정 저장
    const finalConfig = {
      ...userConfig,
      snsTopics,
      healthCheckId
    };
    
    saveMonitoringConfig(finalConfig);
    printFinalInstructions(finalConfig);
    
  } catch (error) {
    logError(`모니터링 설정 중 오류 발생: ${error.message}`);
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
  createSNSTopics,
  setupCloudFrontMonitoring,
  setupLambdaMonitoring,
  setupCustomMetrics,
  createDashboard,
  setupHealthChecks,
};