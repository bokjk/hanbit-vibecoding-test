import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DatabaseConstruct } from './database-construct';
import { AuthConstruct } from './auth-construct';
import { LambdaConstruct } from './lambda-construct';
import { ApiConstruct } from './api-construct';
import { MonitoringConstruct } from './monitoring-construct';

/**
 * Hanbit TODO 앱의 메인 CDK 스택
 * DynamoDB, Lambda, API Gateway를 포함하는 서버리스 아키텍처
 */
export class HanbitStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB 테이블 생성
    const database = new DatabaseConstruct(this, 'Database');

    // 인증 스택 생성 (Cognito)
    const auth = new AuthConstruct(this, 'Auth', {
      todoTable: database.todoTable,
    });

    // Lambda 함수들 생성
    const lambda = new LambdaConstruct(this, 'Lambda', {
      todoTable: database.todoTable,
      userPool: auth.userPool,
      userPoolClient: auth.userPoolClient,
      identityPool: auth.identityPool,
    });

    // API Gateway 생성
    const api = new ApiConstruct(this, 'Api', {
      todoHandlers: lambda.todoHandlers,
      authHandlers: lambda.authHandlers,
      userPool: auth.userPool,
    });

    // 모니터링 스택 생성 (CloudWatch)
    const monitoring = new MonitoringConstruct(this, 'Monitoring', {
      restApi: api.restApi,
      todoTable: database.todoTable,
      todoHandlers: lambda.todoHandlers,
      authHandlers: lambda.authHandlers,
      alertEmail: process.env.ALERT_EMAIL, // 선택적 알림 이메일
    });

    // 출력 값들
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: api.restApi.url,
      description: 'API Gateway 엔드포인트',
    });

    new cdk.CfnOutput(this, 'TodoTableName', {
      value: database.todoTable.tableName,
      description: 'DynamoDB 테이블 이름',
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: auth.userPool.userPoolId,
      description: 'Cognito User Pool ID',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: auth.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
    });

    new cdk.CfnOutput(this, 'IdentityPoolId', {
      value: auth.identityPool.ref,
      description: 'Cognito Identity Pool ID',
    });

    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: `https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${monitoring.dashboard.dashboardName}`,
      description: 'CloudWatch 대시보드 URL',
    });

    new cdk.CfnOutput(this, 'AlarmTopicArn', {
      value: monitoring.alarmTopic.topicArn,
      description: 'SNS 알람 토픽 ARN',
    });
  }
}
