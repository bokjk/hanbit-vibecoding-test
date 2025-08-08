import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
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
    guestAuth: lambda.Function;
  };
  userPool: cognito.UserPool;
}

/**
 * API Gateway를 관리하는 Construct
 * REST API 엔드포인트, Cognito 인증, CORS 설정 포함
 */
export class ApiConstruct extends Construct {
  public readonly restApi: apigateway.RestApi;
  public readonly cognitoAuthorizer: apigateway.CognitoUserPoolsAuthorizer;

  constructor(scope: Construct, id: string, props: ApiConstructProps) {
    super(scope, id);

    const { todoHandlers, authHandlers, userPool } = props;

    // 환경별 설정
    const stage = process.env.CDK_STAGE || 'dev';
    const isProduction = stage === 'prod';

    // 환경별 CORS 도메인 설정
    const allowedOrigins = isProduction
      ? ['https://todo-app.com', 'https://www.todo-app.com']
      : apigateway.Cors.ALL_ORIGINS;

    // REST API 생성
    this.restApi = new apigateway.RestApi(this, 'HanbitTodoApi', {
      restApiName: `hanbit-todo-api-${stage}`,
      description: `Hanbit TODO 앱 REST API (${stage})`,
      defaultCorsPreflightOptions: {
        allowOrigins: allowedOrigins,
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
          'X-Request-ID',
        ],
        allowCredentials: true,
        maxAge: cdk.Duration.seconds(3600), // 1시간
      },
      deployOptions: {
        stageName: 'api',
        tracingEnabled: true,
        loggingLevel: isProduction
          ? apigateway.MethodLoggingLevel.ERROR
          : apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: !isProduction, // 프로덕션에서는 비활성화
        metricsEnabled: true,
        throttle: {
          rateLimit: isProduction ? 1000 : 100,
          burstLimit: isProduction ? 2000 : 200,
        },
      },
      policy: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            principals: [new iam.AnyPrincipal()],
            actions: ['execute-api:Invoke'],
            resources: ['*'],
          }),
        ],
      }),
    });

    // Cognito User Pool Authorizer 생성
    this.cognitoAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'TodoApiAuthorizer', {
      cognitoUserPools: [userPool],
      authorizerName: `todo-api-authorizer-${stage}`,
      identitySource: 'method.request.header.Authorization',
      resultsCacheTtl: cdk.Duration.seconds(300), // 5분
    });

    // Request Validator 생성
    const requestValidator = new apigateway.RequestValidator(this, 'RequestValidator', {
      restApi: this.restApi,
      requestValidatorName: 'request-body-validator',
      validateRequestBody: true,
      validateRequestParameters: true,
    });

    // 요청/응답 모델 정의
    const createTodoModel = this.restApi.addModel('CreateTodoModel', {
      contentType: 'application/json',
      modelName: 'CreateTodoModel',
      schema: {
        schema: apigateway.JsonSchemaVersion.DRAFT4,
        type: apigateway.JsonSchemaType.OBJECT,
        properties: {
          title: {
            type: apigateway.JsonSchemaType.STRING,
            minLength: 1,
            maxLength: 500,
          },
          priority: {
            type: apigateway.JsonSchemaType.STRING,
            enum: ['LOW', 'MEDIUM', 'HIGH'],
          },
          dueDate: {
            type: apigateway.JsonSchemaType.STRING,
            format: 'date-time',
          },
        },
        required: ['title'],
      },
    });

    const updateTodoModel = this.restApi.addModel('UpdateTodoModel', {
      contentType: 'application/json',
      modelName: 'UpdateTodoModel',
      schema: {
        schema: apigateway.JsonSchemaVersion.DRAFT4,
        type: apigateway.JsonSchemaType.OBJECT,
        properties: {
          title: {
            type: apigateway.JsonSchemaType.STRING,
            minLength: 1,
            maxLength: 500,
          },
          completed: {
            type: apigateway.JsonSchemaType.BOOLEAN,
          },
          priority: {
            type: apigateway.JsonSchemaType.STRING,
            enum: ['LOW', 'MEDIUM', 'HIGH'],
          },
          dueDate: {
            type: apigateway.JsonSchemaType.STRING,
            format: 'date-time',
          },
        },
      },
    });

    // 공통 에러 응답 설정
    const errorResponseTemplates = {
      'application/json': JSON.stringify({
        success: false,
        error: {
          code: '$context.error.responseType',
          message: '$context.error.message',
        },
        timestamp: '$context.requestTime',
        requestId: '$context.requestId',
      }),
    };

    // 공통 Integration Response 설정
    const commonIntegrationResponses = [
      {
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': "'*'",
        },
      },
      {
        statusCode: '400',
        selectionPattern: '4\\d{2}',
        responseTemplates: errorResponseTemplates,
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': "'*'",
        },
      },
      {
        statusCode: '401',
        selectionPattern: '401',
        responseTemplates: errorResponseTemplates,
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': "'*'",
        },
      },
      {
        statusCode: '403',
        selectionPattern: '403',
        responseTemplates: errorResponseTemplates,
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': "'*'",
        },
      },
      {
        statusCode: '500',
        selectionPattern: '5\\d{2}',
        responseTemplates: errorResponseTemplates,
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': "'*'",
        },
      },
    ];

    // 공통 Method Response 설정
    const commonMethodResponses = [
      {
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': true,
        },
      },
      {
        statusCode: '400',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': true,
        },
      },
      {
        statusCode: '401',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': true,
        },
      },
      {
        statusCode: '403',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': true,
        },
      },
      {
        statusCode: '500',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': true,
        },
      },
    ];

    // /todos 리소스
    const todosResource = this.restApi.root.addResource('todos');

    // GET /todos - 할일 목록 조회 (인증 필요)
    todosResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(todoHandlers.listTodos, {
        proxy: true,
        integrationResponses: commonIntegrationResponses,
      }),
      {
        authorizer: this.cognitoAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
        requestParameters: {
          'method.request.querystring.limit': false,
          'method.request.querystring.cursor': false,
          'method.request.querystring.status': false,
          'method.request.querystring.priority': false,
        },
        methodResponses: commonMethodResponses,
      }
    );

    // POST /todos - 새로운 할일 생성 (인증 필요)
    todosResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(todoHandlers.createTodo, {
        proxy: true,
        integrationResponses: commonIntegrationResponses,
      }),
      {
        authorizer: this.cognitoAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
        requestValidator,
        requestModels: {
          'application/json': createTodoModel,
        },
        methodResponses: commonMethodResponses,
      }
    );

    // /todos/{id} 리소스
    const todoResource = todosResource.addResource('{id}');

    // PUT /todos/{id} - 할일 업데이트 (인증 필요)
    todoResource.addMethod(
      'PUT',
      new apigateway.LambdaIntegration(todoHandlers.updateTodo, {
        proxy: true,
        integrationResponses: commonIntegrationResponses,
      }),
      {
        authorizer: this.cognitoAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
        requestValidator,
        requestModels: {
          'application/json': updateTodoModel,
        },
        requestParameters: {
          'method.request.path.id': true,
        },
        methodResponses: commonMethodResponses,
      }
    );

    // DELETE /todos/{id} - 할일 삭제 (인증 필요)
    todoResource.addMethod(
      'DELETE',
      new apigateway.LambdaIntegration(todoHandlers.deleteTodo, {
        proxy: true,
        integrationResponses: commonIntegrationResponses,
      }),
      {
        authorizer: this.cognitoAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
        requestParameters: {
          'method.request.path.id': true,
        },
        methodResponses: commonMethodResponses,
      }
    );

    // /auth 리소스 (공개 엔드포인트)
    const authResource = this.restApi.root.addResource('auth');

    // POST /auth/login - 로그인 (공개 접근)
    authResource.addResource('login').addMethod(
      'POST',
      new apigateway.LambdaIntegration(authHandlers.login, {
        proxy: true,
        integrationResponses: commonIntegrationResponses,
      }),
      {
        methodResponses: commonMethodResponses,
      }
    );

    // POST /auth/refresh - 토큰 갱신 (공개 접근)
    authResource.addResource('refresh').addMethod(
      'POST',
      new apigateway.LambdaIntegration(authHandlers.refresh, {
        proxy: true,
        integrationResponses: commonIntegrationResponses,
      }),
      {
        methodResponses: commonMethodResponses,
      }
    );

    // POST /auth/guest - 게스트 인증 (공개 접근)
    authResource.addResource('guest').addMethod(
      'POST',
      new apigateway.LambdaIntegration(authHandlers.guestAuth, {
        proxy: true,
        integrationResponses: commonIntegrationResponses,
      }),
      {
        methodResponses: commonMethodResponses,
      }
    );

    // Health check 엔드포인트 (공개 접근)
    const healthResource = this.restApi.root.addResource('health');
    healthResource.addMethod(
      'GET',
      new apigateway.MockIntegration({
        integrationResponses: [
          {
            statusCode: '200',
            responseTemplates: {
              'application/json': JSON.stringify({
                success: true,
                data: {
                  status: 'OK',
                  timestamp: '$context.requestTime',
                  service: `hanbit-todo-api-${stage}`,
                  version: '1.0.0',
                  stage,
                },
              }),
            },
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': "'*'",
            },
          },
        ],
        requestTemplates: {
          'application/json': '{ "statusCode": 200 }',
        },
      }),
      {
        methodResponses: [
          {
            statusCode: '200',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
        ],
      }
    );

    // API 문서화를 위한 OpenAPI 확장
    this.restApi.addGatewayResponse('Default4XX', {
      type: apigateway.ResponseType.DEFAULT_4XX,
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'*'",
      },
      templates: {
        'application/json': JSON.stringify({
          success: false,
          error: {
            code: '$context.error.responseType',
            message: '$context.error.message',
          },
          timestamp: '$context.requestTime',
          requestId: '$context.requestId',
        }),
      },
    });

    this.restApi.addGatewayResponse('Default5XX', {
      type: apigateway.ResponseType.DEFAULT_5XX,
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'*'",
      },
      templates: {
        'application/json': JSON.stringify({
          success: false,
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'An internal server error occurred',
          },
          timestamp: '$context.requestTime',
          requestId: '$context.requestId',
        }),
      },
    });

    // 태그 추가
    cdk.Tags.of(this.restApi).add('Component', 'API');
    cdk.Tags.of(this.restApi).add('Project', 'HanbitTodo');
  }
}
