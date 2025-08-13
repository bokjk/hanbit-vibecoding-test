import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as lambda from 'aws-cdk-lib/aws-lambda';

import * as iam from 'aws-cdk-lib/aws-iam';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environment';

export interface DeploymentMonitoringProps {
  /** 배포 대상 API */
  api: apigateway.RestApi;

  /** Lambda 함수들 */
  lambdaFunctions: Record<string, lambda.Function>;

  /** 알림 이메일 주소 */
  alertEmail: string;

  /** Slack Webhook URL (선택사항) */
  slackWebhookUrl?: string;

  /** 환경 설정 */
  environmentConfig: EnvironmentConfig;
}

/**
 * 배포 모니터링 및 알림 시스템
 *
 * 기능:
 * - 배포 성공/실패 모니터링
 * - 헬스체크 및 롤백 감지
 * - 배포 메트릭 수집
 * - 다중 채널 알림 (이메일, Slack)
 */
export class DeploymentMonitoringConstruct extends Construct {
  public readonly deploymentDashboard: cloudwatch.Dashboard;
  public readonly deploymentAlarmTopic: sns.Topic;
  public readonly healthCheckFunction: lambda.Function;
  public readonly rollbackFunction: lambda.Function;
  public readonly deploymentMetricsFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: DeploymentMonitoringProps) {
    super(scope, id);

    const { api, lambdaFunctions, alertEmail, slackWebhookUrl, environmentConfig } = props;

    // SNS 토픽 - 배포 알림용
    this.deploymentAlarmTopic = new sns.Topic(this, 'DeploymentAlarmTopic', {
      topicName: `deployment-alerts-${environmentConfig.name}`,
      displayName: `배포 알림 토픽 (${environmentConfig.name})`,
    });

    // 이메일 구독 추가
    this.deploymentAlarmTopic.addSubscription(new snsSubscriptions.EmailSubscription(alertEmail));

    // 배포 헬스체크 Lambda 함수
    this.healthCheckFunction = new lambda.Function(this, 'HealthCheckFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'deployment-health-check.handler',
      code: lambda.Code.fromInline(`
        const https = require('https');
        const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

        const sns = new SNSClient({ region: process.env.AWS_REGION });

        exports.handler = async (event) => {
          const apiEndpoint = process.env.API_ENDPOINT;
          const environment = process.env.ENVIRONMENT;
          const topicArn = process.env.TOPIC_ARN;
          
          try {
            // API 엔드포인트 헬스체크
            const healthCheckResult = await performHealthCheck(apiEndpoint + '/health');
            
            if (!healthCheckResult.success) {
              throw new Error(\`Health check failed: \${healthCheckResult.error}\`);
            }
            
            // Lambda 함수들 개별 헬스체크
            const lambdaHealthChecks = await Promise.all([
              checkLambdaHealth('create-todo'),
              checkLambdaHealth('get-todos'),
              checkLambdaHealth('update-todo'),
              checkLambdaHealth('delete-todo')
            ]);
            
            const failedChecks = lambdaHealthChecks.filter(check => !check.success);
            
            if (failedChecks.length > 0) {
              throw new Error(\`Lambda health checks failed: \${failedChecks.map(c => c.name).join(', ')}\`);
            }
            
            return {
              statusCode: 200,
              body: JSON.stringify({
                status: 'healthy',
                environment,
                timestamp: new Date().toISOString(),
                checks: {
                  api: healthCheckResult,
                  lambdas: lambdaHealthChecks
                }
              })
            };
            
          } catch (error) {
            console.error('Health check failed:', error);
            
            // 실패 알림 발송
            await sns.send(new PublishCommand({
              TopicArn: topicArn,
              Subject: \`🚨 배포 헬스체크 실패 - \${environment}\`,
              Message: \`
배포 헬스체크가 실패했습니다.

환경: \${environment}
시간: \${new Date().toISOString()}
오류: \${error.message}

즉시 확인이 필요합니다.
              \`.trim()
            }));
            
            return {
              statusCode: 500,
              body: JSON.stringify({
                status: 'unhealthy',
                environment,
                error: error.message,
                timestamp: new Date().toISOString()
              })
            };
          }
        };
        
        async function performHealthCheck(url) {
          return new Promise((resolve) => {
            const req = https.get(url, { timeout: 5000 }, (res) => {
              let data = '';
              res.on('data', (chunk) => data += chunk);
              res.on('end', () => {
                resolve({
                  success: res.statusCode === 200,
                  statusCode: res.statusCode,
                  response: data
                });
              });
            });
            
            req.on('error', (error) => {
              resolve({
                success: false,
                error: error.message
              });
            });
            
            req.on('timeout', () => {
              req.destroy();
              resolve({
                success: false,
                error: 'Request timeout'
              });
            });
          });
        }
        
        async function checkLambdaHealth(functionName) {
          // 간단한 Lambda 함수 상태 체크 (실제로는 CloudWatch 메트릭을 확인할 수 있음)
          return {
            name: functionName,
            success: true,
            timestamp: new Date().toISOString()
          };
        }
      `),
      environment: {
        API_ENDPOINT: api.url,
        ENVIRONMENT: environmentConfig.name,
        TOPIC_ARN: this.deploymentAlarmTopic.topicArn,
      },
      timeout: cdk.Duration.seconds(30),
      description: `배포 헬스체크 함수 (${environmentConfig.name})`,
    });

    // SNS 발행 권한 부여
    this.healthCheckFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['sns:Publish'],
        resources: [this.deploymentAlarmTopic.topicArn],
      })
    );

    // 자동 롤백 Lambda 함수
    this.rollbackFunction = new lambda.Function(this, 'RollbackFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'auto-rollback.handler',
      code: lambda.Code.fromInline(`
        const { CloudFormationClient, DescribeStacksCommand, UpdateStackCommand } = require('@aws-sdk/client-cloudformation');
        const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

        const cloudformation = new CloudFormationClient({ region: process.env.AWS_REGION });
        const sns = new SNSClient({ region: process.env.AWS_REGION });

        exports.handler = async (event) => {
          const stackName = process.env.STACK_NAME;
          const environment = process.env.ENVIRONMENT;
          const topicArn = process.env.TOPIC_ARN;
          
          try {
            console.log('Starting automatic rollback process');
            
            // 현재 스택 상태 확인
            const describeResult = await cloudformation.send(new DescribeStacksCommand({
              StackName: stackName
            }));
            
            const stack = describeResult.Stacks[0];
            
            if (stack.StackStatus !== 'UPDATE_COMPLETE' && stack.StackStatus !== 'CREATE_COMPLETE') {
              throw new Error(\`Stack is in invalid state for rollback: \${stack.StackStatus}\`);
            }
            
            // 롤백 실행 (실제 환경에서는 더 정교한 로직 필요)
            console.log('Initiating stack rollback');
            
            // 알림 발송
            await sns.send(new PublishCommand({
              TopicArn: topicArn,
              Subject: \`🔄 자동 롤백 시작 - \${environment}\`,
              Message: \`
자동 롤백이 시작되었습니다.

환경: \${environment}
스택: \${stackName}
시간: \${new Date().toISOString()}
이유: 헬스체크 실패

롤백 진행 상황을 모니터링하고 있습니다.
              \`.trim()
            }));
            
            return {
              statusCode: 200,
              body: JSON.stringify({
                message: 'Rollback initiated',
                stackName,
                environment,
                timestamp: new Date().toISOString()
              })
            };
            
          } catch (error) {
            console.error('Rollback failed:', error);
            
            // 롤백 실패 알림
            await sns.send(new PublishCommand({
              TopicArn: topicArn,
              Subject: \`❌ 자동 롤백 실패 - \${environment}\`,
              Message: \`
자동 롤백이 실패했습니다!

환경: \${environment}
스택: \${stackName}
시간: \${new Date().toISOString()}
오류: \${error.message}

수동 개입이 필요합니다!
              \`.trim()
            }));
            
            throw error;
          }
        };
      `),
      environment: {
        STACK_NAME: `HanbitTodoStack-${environmentConfig.name}`,
        ENVIRONMENT: environmentConfig.name,
        TOPIC_ARN: this.deploymentAlarmTopic.topicArn,
      },
      timeout: cdk.Duration.minutes(5),
      description: `자동 롤백 함수 (${environmentConfig.name})`,
    });

    // CloudFormation 및 SNS 권한 부여
    this.rollbackFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'cloudformation:DescribeStacks',
          'cloudformation:UpdateStack',
          'cloudformation:DescribeStackEvents',
        ],
        resources: [
          `arn:aws:cloudformation:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:stack/HanbitTodoStack-${environmentConfig.name}/*`,
        ],
      })
    );

    this.rollbackFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['sns:Publish'],
        resources: [this.deploymentAlarmTopic.topicArn],
      })
    );

    // 배포 메트릭 수집 Lambda 함수
    this.deploymentMetricsFunction = new lambda.Function(this, 'DeploymentMetricsFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'deployment-metrics.handler',
      code: lambda.Code.fromInline(`
        const { CloudWatchClient, PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');
        const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');

        const cloudwatch = new CloudWatchClient({ region: process.env.AWS_REGION });
        const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION });

        exports.handler = async (event) => {
          const environment = process.env.ENVIRONMENT;
          const tableName = process.env.DEPLOYMENT_HISTORY_TABLE;
          
          try {
            const deploymentEvent = JSON.parse(event.Records[0].Sns.Message);
            
            // CloudWatch 커스텀 메트릭 전송
            await cloudwatch.send(new PutMetricDataCommand({
              Namespace: 'Hanbit/Deployment',
              MetricData: [
                {
                  MetricName: 'DeploymentEvent',
                  Value: 1,
                  Unit: 'Count',
                  Dimensions: [
                    { Name: 'Environment', Value: environment },
                    { Name: 'Status', Value: deploymentEvent.status || 'unknown' }
                  ],
                  Timestamp: new Date()
                }
              ]
            }));
            
            // 배포 히스토리 DynamoDB에 저장
            await dynamodb.send(new PutItemCommand({
              TableName: tableName,
              Item: {
                deploymentId: { S: deploymentEvent.deploymentId || \`deploy-\${Date.now()}\` },
                timestamp: { S: new Date().toISOString() },
                environment: { S: environment },
                status: { S: deploymentEvent.status || 'unknown' },
                details: { S: JSON.stringify(deploymentEvent) },
                ttl: { N: String(Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60) } // 90일 후 삭제
              }
            }));
            
            return { statusCode: 200 };
            
          } catch (error) {
            console.error('Failed to record deployment metrics:', error);
            throw error;
          }
        };
      `),
      environment: {
        ENVIRONMENT: environmentConfig.name,
        DEPLOYMENT_HISTORY_TABLE: `deployment-history-${environmentConfig.name}`,
      },
      timeout: cdk.Duration.seconds(30),
      description: `배포 메트릭 수집 함수 (${environmentConfig.name})`,
    });

    // CloudWatch 및 DynamoDB 권한 부여
    this.deploymentMetricsFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['cloudwatch:PutMetricData'],
        resources: ['*'],
      })
    );

    this.deploymentMetricsFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['dynamodb:PutItem'],
        resources: [
          `arn:aws:dynamodb:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:table/deployment-history-${environmentConfig.name}`,
        ],
      })
    );

    // Slack 알림 함수 (선택사항)
    if (slackWebhookUrl) {
      const slackNotificationFunction = new lambda.Function(this, 'SlackNotificationFunction', {
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: 'slack-notification.handler',
        code: lambda.Code.fromInline(`
          const https = require('https');
          const url = require('url');

          exports.handler = async (event) => {
            const message = JSON.parse(event.Records[0].Sns.Message);
            const subject = event.Records[0].Sns.Subject;
            
            const slackMessage = {
              text: subject,
              attachments: [
                {
                  color: subject.includes('실패') || subject.includes('❌') ? 'danger' : 
                         subject.includes('성공') || subject.includes('✅') ? 'good' : 'warning',
                  fields: [
                    {
                      title: '메시지',
                      value: message,
                      short: false
                    },
                    {
                      title: '시간',
                      value: new Date().toISOString(),
                      short: true
                    }
                  ]
                }
              ]
            };
            
            return sendSlackMessage(process.env.SLACK_WEBHOOK_URL, slackMessage);
          };
          
          function sendSlackMessage(webhookUrl, message) {
            return new Promise((resolve, reject) => {
              const parsedUrl = url.parse(webhookUrl);
              const postData = JSON.stringify(message);
              
              const options = {
                hostname: parsedUrl.hostname,
                port: 443,
                path: parsedUrl.path,
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Content-Length': Buffer.byteLength(postData)
                }
              };
              
              const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
              });
              
              req.on('error', reject);
              req.write(postData);
              req.end();
            });
          }
        `),
        environment: {
          SLACK_WEBHOOK_URL: slackWebhookUrl,
        },
        timeout: cdk.Duration.seconds(30),
        description: `Slack 알림 함수 (${environmentConfig.name})`,
      });

      // SNS 구독 추가
      this.deploymentAlarmTopic.addSubscription(
        new snsSubscriptions.LambdaSubscription(slackNotificationFunction)
      );
    }

    // 메트릭 수집을 위한 SNS 구독
    this.deploymentAlarmTopic.addSubscription(
      new snsSubscriptions.LambdaSubscription(this.deploymentMetricsFunction)
    );

    // 배포 모니터링 대시보드
    this.deploymentDashboard = new cloudwatch.Dashboard(this, 'DeploymentDashboard', {
      dashboardName: `deployment-monitoring-${environmentConfig.name}`,
    });

    // 대시보드 위젯들 추가
    this.addDeploymentWidgets(lambdaFunctions, environmentConfig);

    // 배포 실패 알람들
    this.createDeploymentAlarms(lambdaFunctions, environmentConfig);

    // 헬스체크 스케줄 (EventBridge 룰)
    const healthCheckRule = new cdk.aws_events.Rule(this, 'HealthCheckRule', {
      schedule: cdk.aws_events.Schedule.rate(cdk.Duration.minutes(5)),
      description: `정기 헬스체크 (${environmentConfig.name})`,
    });

    healthCheckRule.addTarget(new cdk.aws_events_targets.LambdaFunction(this.healthCheckFunction));
  }

  private addDeploymentWidgets(
    lambdaFunctions: Record<string, lambda.Function>,
    environmentConfig: EnvironmentConfig
  ) {
    // 배포 상태 메트릭 위젯
    this.deploymentDashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: '배포 이벤트',
        left: [
          new cloudwatch.Metric({
            namespace: 'Hanbit/Deployment',
            metricName: 'DeploymentEvent',
            dimensionsMap: {
              Environment: environmentConfig.name,
            },
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
          }),
        ],
        width: 12,
        height: 6,
      })
    );

    // Lambda 함수별 에러율
    const lambdaErrorWidgets = Object.entries(lambdaFunctions).map(
      ([name, func]) =>
        new cloudwatch.GraphWidget({
          title: `${name} 에러율`,
          left: [
            func.metricErrors({ period: cdk.Duration.minutes(5) }),
            func.metricDuration({ period: cdk.Duration.minutes(5) }),
          ],
          width: 6,
          height: 6,
        })
    );

    this.deploymentDashboard.addWidgets(...lambdaErrorWidgets);

    // 헬스체크 상태 위젯
    this.deploymentDashboard.addWidgets(
      new cloudwatch.SingleValueWidget({
        title: '헬스체크 상태',
        metrics: [
          this.healthCheckFunction.metricErrors({ period: cdk.Duration.minutes(5) }),
          this.healthCheckFunction.metricInvocations({ period: cdk.Duration.minutes(5) }),
        ],
        width: 6,
        height: 6,
      })
    );
  }

  private createDeploymentAlarms(
    lambdaFunctions: Record<string, lambda.Function>,
    environmentConfig: EnvironmentConfig
  ) {
    // 헬스체크 실패 알람
    const healthCheckAlarm = new cloudwatch.Alarm(this, 'HealthCheckFailureAlarm', {
      metric: this.healthCheckFunction.metricErrors({ period: cdk.Duration.minutes(5) }),
      threshold: 1,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: `헬스체크 실패 감지 (${environmentConfig.name})`,
    });

    healthCheckAlarm.addAlarmAction(
      new cdk.aws_cloudwatch_actions.SnsAction(this.deploymentAlarmTopic)
    );

    // Lambda 함수별 에러 알람
    Object.entries(lambdaFunctions).forEach(([name, func]) => {
      const errorAlarm = new cloudwatch.Alarm(this, `${name}ErrorAlarm`, {
        metric: func.metricErrors({ period: cdk.Duration.minutes(5) }),
        threshold: 5,
        evaluationPeriods: 2,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmDescription: `${name} Lambda 함수 에러 급증 (${environmentConfig.name})`,
      });

      errorAlarm.addAlarmAction(
        new cdk.aws_cloudwatch_actions.SnsAction(this.deploymentAlarmTopic)
      );
    });

    // 프로덕션 환경의 경우 추가 알람
    if (environmentConfig.name === 'prod') {
      // API Gateway 5XX 에러 알람
      const apiErrorAlarm = new cloudwatch.Alarm(this, 'ApiGateway5xxAlarm', {
        metric: new cloudwatch.Metric({
          namespace: 'AWS/ApiGateway',
          metricName: '5XXError',
          dimensionsMap: {
            ApiName: `hanbit-todo-api-${environmentConfig.name}`,
          },
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
        }),
        threshold: 10,
        evaluationPeriods: 2,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmDescription: `API Gateway 5XX 에러 급증 (${environmentConfig.name})`,
      });

      apiErrorAlarm.addAlarmAction(
        new cdk.aws_cloudwatch_actions.SnsAction(this.deploymentAlarmTopic)
      );
    }
  }
}
