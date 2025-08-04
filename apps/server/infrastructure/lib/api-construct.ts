import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export interface ApiConstructProps {
  todoHandlers: {
    createTodo: lambda.Function;
    listTodos: lambda.Function;
    updateTodo: lambda.Function;
    deleteTodo: lambda.Function;
  };
  authHandlers: {
    login: lambda.Function;
    refresh: lambda.Function;
  };
}

/**
 * API Gateway를 관리하는 Construct
 * REST API 엔드포인트와 CORS 설정 포함
 */
export class ApiConstruct extends Construct {
  public readonly restApi: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: ApiConstructProps) {
    super(scope, id);

    const { todoHandlers, authHandlers } = props;

    // REST API 생성
    this.restApi = new apigateway.RestApi(this, 'HanbitTodoApi', {
      restApiName: 'hanbit-todo-api',
      description: 'Hanbit TODO 앱 REST API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS, // 개발용, 프로덕션에서는 특정 도메인으로 제한
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
        allowCredentials: true,
      },
      deployOptions: {
        stageName: 'api',
        tracingEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true,
      },
    });

    // /todos 리소스
    const todosResource = this.restApi.root.addResource('todos');
    
    // GET /todos - 할일 목록 조회
    todosResource.addMethod('GET', 
      new apigateway.LambdaIntegration(todoHandlers.listTodos, {
        proxy: true,
      })
    );

    // POST /todos - 새로운 할일 생성
    todosResource.addMethod('POST', 
      new apigateway.LambdaIntegration(todoHandlers.createTodo, {
        proxy: true,
      })
    );

    // /todos/{id} 리소스
    const todoResource = todosResource.addResource('{id}');
    
    // PUT /todos/{id} - 할일 업데이트
    todoResource.addMethod('PUT', 
      new apigateway.LambdaIntegration(todoHandlers.updateTodo, {
        proxy: true,
      })
    );

    // DELETE /todos/{id} - 할일 삭제
    todoResource.addMethod('DELETE', 
      new apigateway.LambdaIntegration(todoHandlers.deleteTodo, {
        proxy: true,
      })
    );

    // /auth 리소스
    const authResource = this.restApi.root.addResource('auth');
    
    // POST /auth/login - 로그인
    authResource.addResource('login').addMethod('POST', 
      new apigateway.LambdaIntegration(authHandlers.login, {
        proxy: true,
      })
    );

    // POST /auth/refresh - 토큰 갱신
    authResource.addResource('refresh').addMethod('POST', 
      new apigateway.LambdaIntegration(authHandlers.refresh, {
        proxy: true,
      })
    );

    // Health check 엔드포인트
    const healthResource = this.restApi.root.addResource('health');
    healthResource.addMethod('GET', 
      new apigateway.MockIntegration({
        integrationResponses: [{
          statusCode: '200',
          responseTemplates: {
            'application/json': JSON.stringify({
              status: 'OK',
              timestamp: new Date().toISOString(),
              service: 'hanbit-todo-api'
            })
          },
        }],
        requestTemplates: {
          'application/json': '{ "statusCode": 200 }'
        },
      }), {
        methodResponses: [{ statusCode: '200' }]
      }
    );

    // 태그 추가
    cdk.Tags.of(this.restApi).add('Component', 'API');
    cdk.Tags.of(this.restApi).add('Project', 'HanbitTodo');
  }
}