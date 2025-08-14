import { CloudWatchClient, PutDashboardCommand } from '@aws-sdk/client-cloudwatch';

/**
 * 환경별 대시보드 설정
 */
interface DashboardConfig {
  environment: 'dev' | 'prod';
  region: string;
  functionPrefix: string;
  apiName: string;
  tableName: string;
  thresholds: {
    responseTime: number;
    errorRate: number;
    throttleThreshold: number;
  };
  alarmThresholds: {
    errorCount: number;
    responseTimeP99: number;
    throttleCount: number;
  };
}

/**
 * 환경별 기본 설정
 */
const DEFAULT_CONFIGS: Record<string, DashboardConfig> = {
  dev: {
    environment: 'dev',
    region: 'us-east-1',
    functionPrefix: 'TodoApp-Dev',
    apiName: 'TodoApp-Dev-API',
    tableName: 'TodoApp-Dev-Todos',
    thresholds: {
      responseTime: 5000, // 개발 환경은 더 관대한 임계값
      errorRate: 5,
      throttleThreshold: 10
    },
    alarmThresholds: {
      errorCount: 50,
      responseTimeP99: 10000,
      throttleCount: 20
    }
  },
  prod: {
    environment: 'prod',
    region: 'us-east-1',
    functionPrefix: 'TodoApp',
    apiName: 'TodoApp-API',
    tableName: 'TodoApp-Todos',
    thresholds: {
      responseTime: 3000, // 프로덕션 환경은 엄격한 임계값
      errorRate: 1,
      throttleThreshold: 5
    },
    alarmThresholds: {
      errorCount: 10,
      responseTimeP99: 5000,
      throttleCount: 5
    }
  }
};

/**
 * 대시보드 위젯 정의 인터페이스
 */
interface DashboardWidget {
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  properties: any;
}

/**
 * CloudWatch Dashboard 동적 생성기
 */
export class DashboardGenerator {
  private cloudWatchClient: CloudWatchClient;
  private config: DashboardConfig;

  constructor(environment: 'dev' | 'prod' = 'prod', customConfig?: Partial<DashboardConfig>) {
    this.config = {
      ...DEFAULT_CONFIGS[environment],
      ...customConfig
    };
    
    this.cloudWatchClient = new CloudWatchClient({
      region: this.config.region
    });
  }

  /**
   * Lambda 함수 성능 위젯 생성
   */
  private createLambdaPerformanceWidget(): DashboardWidget {
    const functions = ['CreateTodo', 'ListTodos', 'UpdateTodo', 'DeleteTodo', 'Login'];
    const metrics = functions.map(func => [
      'AWS/Lambda', 'Duration', 'FunctionName', `${this.config.functionPrefix}-${func}`
    ]);

    return {
      type: 'metric',
      x: 0,
      y: 0,
      width: 12,
      height: 6,
      properties: {
        metrics,
        period: 300,
        stat: 'Average',
        region: this.config.region,
        title: `Lambda 응답 시간 (평균) - ${this.config.environment.toUpperCase()}`,
        view: 'timeSeries',
        stacked: false,
        yAxis: {
          left: {
            min: 0,
            max: this.config.thresholds.responseTime
          }
        },
        annotations: {
          horizontal: [
            {
              label: `임계값 (${this.config.thresholds.responseTime}ms)`,
              value: this.config.thresholds.responseTime
            }
          ]
        }
      }
    };
  }

  /**
   * Lambda 에러 위젯 생성
   */
  private createLambdaErrorWidget(): DashboardWidget {
    const functions = ['CreateTodo', 'ListTodos', 'UpdateTodo', 'DeleteTodo', 'Login'];
    const metrics = functions.map(func => [
      'AWS/Lambda', 'Errors', 'FunctionName', `${this.config.functionPrefix}-${func}`
    ]);

    return {
      type: 'metric',
      x: 12,
      y: 0,
      width: 12,
      height: 6,
      properties: {
        metrics,
        period: 300,
        stat: 'Sum',
        region: this.config.region,
        title: `Lambda 에러 발생 횟수 - ${this.config.environment.toUpperCase()}`,
        view: 'timeSeries',
        stacked: false,
        yAxis: {
          left: {
            min: 0
          }
        },
        annotations: {
          horizontal: [
            {
              label: `경고 임계값 (${this.config.alarmThresholds.errorCount})`,
              value: this.config.alarmThresholds.errorCount
            }
          ]
        }
      }
    };
  }

  /**
   * API Gateway 위젯 생성
   */
  private createApiGatewayWidget(): DashboardWidget {
    return {
      type: 'metric',
      x: 0,
      y: 6,
      width: 12,
      height: 6,
      properties: {
        metrics: [
          ['AWS/ApiGateway', 'Latency', 'ApiName', this.config.apiName],
          ['.', 'IntegrationLatency', '.', '.']
        ],
        period: 300,
        stat: 'Average',
        region: this.config.region,
        title: `API Gateway 지연 시간 - ${this.config.environment.toUpperCase()}`,
        view: 'timeSeries',
        stacked: false,
        annotations: {
          horizontal: [
            {
              label: `임계값 (${this.config.thresholds.responseTime}ms)`,
              value: this.config.thresholds.responseTime
            }
          ]
        }
      }
    };
  }

  /**
   * DynamoDB 성능 위젯 생성
   */
  private createDynamoDBWidget(): DashboardWidget {
    return {
      type: 'metric',
      x: 12,
      y: 6,
      width: 12,
      height: 6,
      properties: {
        metrics: [
          ['AWS/DynamoDB', 'ConsumedReadCapacityUnits', 'TableName', this.config.tableName],
          ['.', 'ConsumedWriteCapacityUnits', '.', '.'],
          ['.', 'ThrottledRequests', '.', '.'],
          ['.', 'SystemErrors', '.', '.']
        ],
        period: 300,
        stat: 'Sum',
        region: this.config.region,
        title: `DynamoDB 메트릭 - ${this.config.environment.toUpperCase()}`,
        view: 'timeSeries',
        stacked: false
      }
    };
  }

  /**
   * 실시간 알람 상태 위젯 생성
   */
  private createAlarmStatusWidget(): DashboardWidget {
    return {
      type: 'metric',
      x: 0,
      y: 12,
      width: 24,
      height: 3,
      properties: {
        metrics: [
          [{ expression: `(m2/m1)*100`, label: '에러율 (%)' }],
          ['AWS/Lambda', 'Invocations', { id: 'm1', visible: false }],
          ['.', 'Errors', { id: 'm2', visible: false }]
        ],
        period: 300,
        stat: 'Sum',
        region: this.config.region,
        title: `실시간 시스템 상태 - ${this.config.environment.toUpperCase()}`,
        view: 'singleValue',
        sparkline: true,
        annotations: {
          horizontal: [
            {
              label: `에러율 임계값 (${this.config.thresholds.errorRate}%)`,
              value: this.config.thresholds.errorRate
            }
          ]
        }
      }
    };
  }

  /**
   * 에러 로그 위젯 생성
   */
  private createErrorLogWidget(): DashboardWidget {
    const functions = ['CreateTodo', 'ListTodos', 'UpdateTodo', 'DeleteTodo', 'Login'];
    const sources = functions.map(func => `/aws/lambda/${this.config.functionPrefix}-${func}`);
    
    return {
      type: 'log',
      x: 0,
      y: 15,
      width: 24,
      height: 6,
      properties: {
        query: sources.map(source => `SOURCE '${source}'`).join('\\n') + 
               '\\n| fields @timestamp, @message, @requestId' +
               '\\n| filter @message like /ERROR/ or @message like /WARN/' +
               '\\n| sort @timestamp desc' +
               '\\n| limit 50',
        region: this.config.region,
        title: `최근 에러 로그 - ${this.config.environment.toUpperCase()}`,
        view: 'table'
      }
    };
  }

  /**
   * X-Ray 서비스 맵 위젯 생성
   */
  private createXRayWidget(): DashboardWidget {
    return {
      type: 'custom',
      x: 0,
      y: 21,
      width: 24,
      height: 6,
      properties: {
        title: `X-Ray 서비스 맵 - ${this.config.environment.toUpperCase()}`,
        view: 'servicemap',
        region: this.config.region,
        period: 300
      }
    };
  }

  /**
   * 성능 트렌드 위젯 생성
   */
  private createPerformanceTrendWidget(): DashboardWidget {
    const functions = ['CreateTodo', 'ListTodos', 'UpdateTodo', 'DeleteTodo'];
    const sources = functions.map(func => `/aws/lambda/${this.config.functionPrefix}-${func}`);

    return {
      type: 'log',
      x: 0,
      y: 27,
      width: 24,
      height: 6,
      properties: {
        query: sources.map(source => `SOURCE '${source}'`).join('\\n') +
               '\\n| fields @timestamp, @duration, @requestId' +
               '\\n| filter @type = "REPORT"' +
               '\\n| stats avg(@duration) as avgDuration, max(@duration) as maxDuration, count() as requests by bin(5m)' +
               '\\n| sort @timestamp desc',
        region: this.config.region,
        title: `성능 트렌드 분석 - ${this.config.environment.toUpperCase()}`,
        view: 'table'
      }
    };
  }

  /**
   * 전체 대시보드 생성
   */
  public async createDashboard(dashboardName?: string): Promise<string> {
    const name = dashboardName || `TodoApp-${this.config.environment.toUpperCase()}-Operations`;
    
    const widgets: DashboardWidget[] = [
      this.createLambdaPerformanceWidget(),
      this.createLambdaErrorWidget(),
      this.createApiGatewayWidget(),
      this.createDynamoDBWidget(),
      this.createAlarmStatusWidget(),
      this.createErrorLogWidget(),
      this.createXRayWidget(),
      this.createPerformanceTrendWidget()
    ];

    const dashboardBody = {
      widgets
    };

    const command = new PutDashboardCommand({
      DashboardName: name,
      DashboardBody: JSON.stringify(dashboardBody)
    });

    try {
      const result = await this.cloudWatchClient.send(command);
      console.log(`✅ 대시보드 '${name}' 생성 완료`);
      console.log(`🔗 URL: https://${this.config.region}.console.aws.amazon.com/cloudwatch/home?region=${this.config.region}#dashboards:name=${name}`);
      return name;
    } catch (error) {
      console.error('❌ 대시보드 생성 실패:', error);
      throw error;
    }
  }

  /**
   * 대시보드 업데이트
   */
  public async updateDashboard(dashboardName: string): Promise<void> {
    console.log(`🔄 대시보드 '${dashboardName}' 업데이트 중...`);
    await this.createDashboard(dashboardName);
  }

  /**
   * 환경별 대시보드 일괄 생성
   */
  public static async createAllEnvironmentDashboards(): Promise<void> {
    const environments: Array<'dev' | 'prod'> = ['dev', 'prod'];
    
    for (const env of environments) {
      const generator = new DashboardGenerator(env);
      await generator.createDashboard();
      
      // 환경별 특화 대시보드도 생성
      await generator.createDashboard(`TodoApp-${env.toUpperCase()}-Detailed`);
    }
  }

  /**
   * 메트릭 필터 설정
   */
  public getMetricFilters() {
    return {
      errorRate: {
        filterName: `TodoApp-${this.config.environment}-ErrorRate`,
        filterPattern: '[timestamp, requestId, level="ERROR", ...]',
        metricTransformations: [{
          metricName: 'ErrorCount',
          metricNamespace: `TodoApp/${this.config.environment}`,
          metricValue: '1'
        }]
      },
      responseTime: {
        filterName: `TodoApp-${this.config.environment}-ResponseTime`,
        filterPattern: '[timestamp, requestId, level, message, duration]',
        metricTransformations: [{
          metricName: 'ResponseTime',
          metricNamespace: `TodoApp/${this.config.environment}`,
          metricValue: '$duration'
        }]
      },
      businessMetrics: {
        filterName: `TodoApp-${this.config.environment}-BusinessMetrics`,
        filterPattern: '[timestamp, requestId, level, message="BUSINESS_METRIC", operation, count]',
        metricTransformations: [{
          metricName: 'BusinessOperations',
          metricNamespace: `TodoApp/${this.config.environment}`,
          metricValue: '$count',
          defaultValue: 0
        }]
      }
    };
  }

  /**
   * 알람 설정 반환
   */
  public getAlarmConfigurations() {
    return {
      highErrorRate: {
        alarmName: `TodoApp-${this.config.environment}-HighErrorRate`,
        threshold: this.config.thresholds.errorRate,
        comparisonOperator: 'GreaterThanThreshold',
        evaluationPeriods: 2,
        period: 300
      },
      highResponseTime: {
        alarmName: `TodoApp-${this.config.environment}-HighResponseTime`,
        threshold: this.config.alarmThresholds.responseTimeP99,
        comparisonOperator: 'GreaterThanThreshold',
        evaluationPeriods: 2,
        period: 300
      },
      throttling: {
        alarmName: `TodoApp-${this.config.environment}-Throttling`,
        threshold: this.config.alarmThresholds.throttleCount,
        comparisonOperator: 'GreaterThanThreshold',
        evaluationPeriods: 1,
        period: 300
      }
    };
  }
}

/**
 * 대시보드 설정 유틸리티 함수들
 */
export const DashboardUtils = {
  /**
   * 환경 변수에서 설정 추출
   */
  getConfigFromEnvironment(): DashboardConfig {
    const environment = (process.env.ENVIRONMENT || 'prod') as 'dev' | 'prod';
    const baseConfig = DEFAULT_CONFIGS[environment];
    
    return {
      ...baseConfig,
      region: process.env.AWS_REGION || baseConfig.region,
      functionPrefix: process.env.FUNCTION_PREFIX || baseConfig.functionPrefix,
      apiName: process.env.API_NAME || baseConfig.apiName,
      tableName: process.env.TABLE_NAME || baseConfig.tableName
    };
  },

  /**
   * 커스텀 위젯 생성 헬퍼
   */
  createCustomMetricWidget(
    title: string,
    metrics: any[],
    position: { x: number; y: number; width: number; height: number },
    options: any = {}
  ): DashboardWidget {
    return {
      type: 'metric',
      ...position,
      properties: {
        metrics,
        period: 300,
        stat: 'Average',
        region: 'us-east-1',
        title,
        view: 'timeSeries',
        stacked: false,
        ...options
      }
    };
  },

  /**
   * 로그 위젯 생성 헬퍼
   */
  createLogWidget(
    title: string,
    query: string,
    position: { x: number; y: number; width: number; height: number }
  ): DashboardWidget {
    return {
      type: 'log',
      ...position,
      properties: {
        query,
        region: 'us-east-1',
        title,
        view: 'table'
      }
    };
  }
};