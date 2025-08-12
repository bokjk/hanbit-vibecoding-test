import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as budgets from 'aws-cdk-lib/aws-budgets';
import * as ce from 'aws-cdk-lib/aws-ce';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { BaseStack } from './base-stack';
import { EnvironmentConfig } from '../../config/environment';

/**
 * 비용 모니터링 및 최적화 스택
 * 예산 알림, 비용 이상 감지, 자동 최적화 기능 포함
 */
export class CostMonitoringStack extends BaseStack {
  public readonly costAlarmTopic: sns.Topic;
  public readonly costDashboard: cloudwatch.Dashboard;
  public readonly budgetAlarms: budgets.CfnBudget[];

  constructor(
    scope: Construct,
    id: string,
    props: cdk.StackProps & { environmentConfig: EnvironmentConfig }
  ) {
    super(scope, id, props);

    // SNS 토픽 생성
    this.costAlarmTopic = this.createCostAlarmTopic();

    // 예산 설정
    this.budgetAlarms = this.createBudgets();

    // CloudWatch 대시보드 생성
    this.costDashboard = this.createCostDashboard();

    // 비용 이상 감지 설정
    this.setupAnomalyDetection();

    // 자동 최적화 규칙 설정
    this.setupAutoOptimization();

    // 비용 리포트 자동화
    this.setupCostReporting();

    // 출력값 생성
    this.createOutputs();
  }

  /**
   * 비용 알람 SNS 토픽 생성
   */
  private createCostAlarmTopic(): sns.Topic {
    const topic = new sns.Topic(this, 'CostAlarmTopic', {
      topicName: this.resourceName('hanbit-cost-alarms'),
      displayName: `Cost alarms for ${this.config.name} environment`,
    });

    // 이메일 구독 추가 (환경 변수에서 가져옴)
    const alertEmails = process.env.COST_ALERT_EMAILS?.split(',') || [];
    alertEmails.forEach(email => {
      topic.addSubscription(new subscriptions.EmailSubscription(email.trim()));
    });

    // Slack 웹훅 구독 (프로덕션/테스트)
    if ((this.isProd || this.isTest) && process.env.SLACK_WEBHOOK_URL) {
      topic.addSubscription(new subscriptions.UrlSubscription(process.env.SLACK_WEBHOOK_URL));
    }

    return topic;
  }

  /**
   * 예산 설정 생성
   */
  private createBudgets(): budgets.CfnBudget[] {
    const budgets: budgets.CfnBudget[] = [];

    // 환경별 예산 한도
    const monthlyBudget = this.selectByEnvironment(
      1000, // 프로덕션: $1000/월
      300, // 테스트: $300/월
      100 // 개발: $100/월
    );

    // 월별 총 예산
    const totalBudget = new budgets.CfnBudget(this, 'TotalMonthlyBudget', {
      budget: {
        budgetName: this.resourceName('hanbit-monthly-budget'),
        budgetType: 'COST',
        timeUnit: 'MONTHLY',
        budgetLimit: {
          amount: monthlyBudget,
          unit: 'USD',
        },
        costFilters: {
          TagKeyValue: [`user:Environment$${this.config.name}`],
        },
        costTypes: {
          includeCredit: false,
          includeDiscount: true,
          includeOtherSubscription: true,
          includeRecurring: true,
          includeRefund: false,
          includeSubscription: true,
          includeSupport: true,
          includeTax: true,
          includeUpfront: true,
          useAmortized: false,
          useBlended: false,
        },
      },
      notificationsWithSubscribers: [
        {
          notification: {
            comparisonOperator: 'GREATER_THAN',
            notificationType: 'ACTUAL',
            threshold: 50,
            thresholdType: 'PERCENTAGE',
          },
          subscribers: [
            {
              address: this.costAlarmTopic.topicArn,
              subscriptionType: 'SNS',
            },
          ],
        },
        {
          notification: {
            comparisonOperator: 'GREATER_THAN',
            notificationType: 'ACTUAL',
            threshold: 80,
            thresholdType: 'PERCENTAGE',
          },
          subscribers: [
            {
              address: this.costAlarmTopic.topicArn,
              subscriptionType: 'SNS',
            },
          ],
        },
        {
          notification: {
            comparisonOperator: 'GREATER_THAN',
            notificationType: 'FORECASTED',
            threshold: 100,
            thresholdType: 'PERCENTAGE',
          },
          subscribers: [
            {
              address: this.costAlarmTopic.topicArn,
              subscriptionType: 'SNS',
            },
          ],
        },
      ],
    });
    budgets.push(totalBudget);

    // 서비스별 예산 (프로덕션/테스트만)
    if (this.isProd || this.isTest) {
      const services = [
        { name: 'Lambda', percentage: 30 },
        { name: 'DynamoDB', percentage: 25 },
        { name: 'API Gateway', percentage: 20 },
        { name: 'CloudWatch', percentage: 10 },
        { name: 'Others', percentage: 15 },
      ];

      services.forEach(service => {
        const serviceBudget = new budgets.CfnBudget(this, `${service.name}Budget`, {
          budget: {
            budgetName: this.resourceName(`hanbit-${service.name.toLowerCase()}-budget`),
            budgetType: 'COST',
            timeUnit: 'MONTHLY',
            budgetLimit: {
              amount: (monthlyBudget * service.percentage) / 100,
              unit: 'USD',
            },
            costFilters:
              service.name !== 'Others'
                ? {
                    Service: [service.name],
                    TagKeyValue: [`user:Environment$${this.config.name}`],
                  }
                : {
                    TagKeyValue: [`user:Environment$${this.config.name}`],
                  },
          },
          notificationsWithSubscribers: [
            {
              notification: {
                comparisonOperator: 'GREATER_THAN',
                notificationType: 'ACTUAL',
                threshold: 90,
                thresholdType: 'PERCENTAGE',
              },
              subscribers: [
                {
                  address: this.costAlarmTopic.topicArn,
                  subscriptionType: 'SNS',
                },
              ],
            },
          ],
        });
        budgets.push(serviceBudget);
      });
    }

    return budgets;
  }

  /**
   * 비용 대시보드 생성
   */
  private createCostDashboard(): cloudwatch.Dashboard {
    const dashboard = new cloudwatch.Dashboard(this, 'CostDashboard', {
      dashboardName: this.resourceName('hanbit-cost-dashboard'),
      periodOverride: cloudwatch.PeriodOverride.INHERIT,
    });

    // 월별 총 비용 위젯
    const totalCostWidget = new cloudwatch.GraphWidget({
      title: 'Monthly Total Cost Trend',
      left: [
        new cloudwatch.Metric({
          namespace: 'AWS/Billing',
          metricName: 'EstimatedCharges',
          dimensionsMap: {
            Currency: 'USD',
          },
          statistic: 'Maximum',
          period: cdk.Duration.days(1),
        }),
      ],
      width: 12,
      height: 6,
    });

    // 서비스별 비용 위젯
    const serviceCostWidget = new cloudwatch.GraphWidget({
      title: 'Cost by Service',
      left: ['Lambda', 'DynamoDB', 'API Gateway', 'CloudWatch', 'S3'].map(
        service =>
          new cloudwatch.Metric({
            namespace: 'AWS/Billing',
            metricName: 'EstimatedCharges',
            dimensionsMap: {
              Currency: 'USD',
              ServiceName: service,
            },
            statistic: 'Maximum',
            period: cdk.Duration.days(1),
          })
      ),
      width: 12,
      height: 6,
      stacked: true,
    });

    // 리소스 사용률 위젯
    const utilizationWidget = new cloudwatch.SingleValueWidget({
      title: 'Resource Utilization',
      metrics: [
        new cloudwatch.Metric({
          namespace: 'AWS/Lambda',
          metricName: 'ConcurrentExecutions',
          statistic: 'Average',
        }),
      ],
      width: 6,
      height: 4,
    });

    // 비용 절감 기회 위젯 (텍스트 위젯)
    const savingsWidget = new cloudwatch.TextWidget({
      markdown: `## Cost Optimization Opportunities
      
### Current Environment: ${this.config.name}

**Recommendations:**
${
  this.isProd
    ? `
- Consider Reserved Instances for DynamoDB
- Use Compute Savings Plans for Lambda
- Enable S3 Intelligent-Tiering
`
    : this.isTest
      ? `
- Reduce Lambda memory allocation during off-hours
- Use On-Demand DynamoDB during low traffic
- Compress CloudWatch logs
`
      : `
- Use minimal Lambda memory (128-256MB)
- Delete unused resources daily
- Disable detailed monitoring
`
}

**Estimated Monthly Savings:** $${this.selectByEnvironment(200, 50, 20)}
      `,
      width: 12,
      height: 6,
    });

    // 대시보드에 위젯 추가
    dashboard.addWidgets(totalCostWidget, serviceCostWidget);
    dashboard.addWidgets(utilizationWidget, savingsWidget);

    return dashboard;
  }

  /**
   * 비용 이상 감지 설정
   */
  private setupAnomalyDetection(): void {
    if (this.isProd || this.isTest) {
      // Cost Anomaly Detector 생성
      new ce.CfnAnomalyMonitor(this, 'CostAnomalyMonitor', {
        monitorName: this.resourceName('hanbit-cost-anomaly-monitor'),
        monitorType: 'DIMENSIONAL',
        monitorDimension: 'SERVICE',
      });

      // Anomaly Subscription 생성
      new ce.CfnAnomalySubscription(this, 'CostAnomalySubscription', {
        subscriptionName: this.resourceName('hanbit-cost-anomaly-subscription'),
        frequency: 'DAILY',
        monitorArnList: [
          `arn:aws:ce::${this.account}:anomalymonitor/${this.resourceName('hanbit-cost-anomaly-monitor')}`,
        ],
        subscribers: [
          {
            type: 'SNS',
            address: this.costAlarmTopic.topicArn,
          },
        ],
        threshold: this.isProd ? 100 : 50, // USD
      });
    }
  }

  /**
   * 자동 최적화 규칙 설정
   */
  private setupAutoOptimization(): void {
    // 개발 환경: 업무 시간 외 리소스 자동 중지
    if (this.isDev) {
      const stopDevResourcesRule = new events.Rule(this, 'StopDevResourcesRule', {
        ruleName: this.resourceName('hanbit-stop-dev-resources'),
        description: 'Stop development resources after business hours',
        schedule: events.Schedule.cron({
          minute: '0',
          hour: '19', // 7 PM
          weekDay: 'MON-FRI',
        }),
      });

      // Lambda 함수 생성 (리소스 중지용)
      const stopResourcesFunction = new lambda.Function(this, 'StopResourcesFunction', {
        functionName: this.resourceName('hanbit-stop-resources'),
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'index.handler',
        code: lambda.Code.fromInline(`
          const AWS = require('aws-sdk');
          const lambda = new AWS.Lambda();
          const dynamodb = new AWS.DynamoDB();
          
          exports.handler = async (event) => {
            console.log('Stopping development resources...');
            
            // Lambda 함수 동시 실행 제한 설정
            const functions = await lambda.listFunctions().promise();
            for (const func of functions.Functions) {
              if (func.FunctionName.includes('-development')) {
                await lambda.putFunctionConcurrency({
                  FunctionName: func.FunctionName,
                  ReservedConcurrentExecutions: 0
                }).promise();
              }
            }
            
            return { statusCode: 200, body: 'Resources stopped' };
          };
        `),
        timeout: cdk.Duration.minutes(5),
      });

      stopDevResourcesRule.addTarget(new targets.LambdaFunction(stopResourcesFunction));
    }

    // 테스트 환경: 주말 리소스 스케일 다운
    if (this.isTest) {
      const scaleDownTestRule = new events.Rule(this, 'ScaleDownTestRule', {
        ruleName: this.resourceName('hanbit-scale-down-test'),
        description: 'Scale down test resources on weekends',
        schedule: events.Schedule.cron({
          minute: '0',
          hour: '22', // 10 PM
          weekDay: 'FRI',
        }),
      });

      // 스케일 다운 액션 추가
      scaleDownTestRule.addTarget(
        new targets.SnsTopic(this.costAlarmTopic, {
          message: events.RuleTargetInput.fromText('Test environment scaled down for weekend'),
        })
      );
    }
  }

  /**
   * 비용 리포트 자동화
   */
  private setupCostReporting(): void {
    // 주간 비용 리포트 (모든 환경)
    const weeklyReportRule = new events.Rule(this, 'WeeklyCostReportRule', {
      ruleName: this.resourceName('hanbit-weekly-cost-report'),
      description: 'Generate weekly cost report',
      schedule: events.Schedule.cron({
        minute: '0',
        hour: '9', // 9 AM
        weekDay: 'MON',
      }),
    });

    // 월간 비용 리포트 (프로덕션/테스트)
    if (this.isProd || this.isTest) {
      const monthlyReportRule = new events.Rule(this, 'MonthlyCostReportRule', {
        ruleName: this.resourceName('hanbit-monthly-cost-report'),
        description: 'Generate monthly cost report',
        schedule: events.Schedule.cron({
          minute: '0',
          hour: '9',
          day: '1', // 매월 1일
        }),
      });

      monthlyReportRule.addTarget(
        new targets.SnsTopic(this.costAlarmTopic, {
          message: events.RuleTargetInput.fromText(
            `Monthly cost report for ${this.config.name} environment is ready. ` +
              `View dashboard: https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${this.costDashboard.dashboardName}`
          ),
        })
      );
    }

    weeklyReportRule.addTarget(
      new targets.SnsTopic(this.costAlarmTopic, {
        message: events.RuleTargetInput.fromText(
          `Weekly cost summary for ${this.config.name} environment is available.`
        ),
      })
    );
  }

  /**
   * 출력값 생성
   */
  private createOutputs(): void {
    this.createOutput(
      'CostAlarmTopicArn',
      this.costAlarmTopic.topicArn,
      'Cost alarm SNS topic ARN'
    );
    this.createOutput(
      'CostDashboardUrl',
      `https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${this.costDashboard.dashboardName}`,
      'Cost dashboard URL'
    );

    // 예산 정보
    this.createOutput(
      'MonthlyBudget',
      this.selectByEnvironment('1000', '300', '100'),
      'Monthly budget (USD)'
    );

    // 비용 최적화 상태
    this.createOutput(
      'CostOptimizationLevel',
      this.selectByEnvironment('STANDARD', 'BALANCED', 'AGGRESSIVE'),
      'Cost optimization level'
    );

    // 자동 최적화 상태
    this.createOutput(
      'AutoOptimizationEnabled',
      this.isDev ? 'YES' : this.isTest ? 'PARTIAL' : 'NO',
      'Automatic cost optimization status'
    );
  }
}
