import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DatabaseConstruct } from './database-construct';
import { LambdaConstruct } from './lambda-construct';
import { ApiConstruct } from './api-construct';

/**
 * Hanbit TODO 앱의 메인 CDK 스택
 * DynamoDB, Lambda, API Gateway를 포함하는 서버리스 아키텍처
 */
export class HanbitStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB 테이블 생성
    const database = new DatabaseConstruct(this, 'Database');

    // Lambda 함수들 생성
    const lambda = new LambdaConstruct(this, 'Lambda', {
      todoTable: database.todoTable,
    });

    // API Gateway 생성
    const api = new ApiConstruct(this, 'Api', {
      todoHandlers: lambda.todoHandlers,
      authHandlers: lambda.authHandlers,
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
  }
}