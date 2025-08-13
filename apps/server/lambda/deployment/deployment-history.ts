import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import {
  CloudFormationClient,
  DescribeStacksCommand,
  DescribeStackEventsCommand,
} from '@aws-sdk/client-cloudformation';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const cloudFormationClient = new CloudFormationClient({ region: process.env.AWS_REGION });

interface DeploymentRecord {
  deploymentId: string;
  timestamp: string;
  environment: string;
  status: 'success' | 'failure' | 'in_progress' | 'rolled_back';
  deploymentType: 'deploy' | 'rollback' | 'hotfix';
  version?: string;
  commitSha?: string;
  deployedBy?: string;
  duration?: number;
  changes?: string[];
  errorMessage?: string;
  rollbackTarget?: string;
  details: Record<string, unknown>;
  ttl: number;
}

/**
 * 배포 히스토리 관리 핸들러
 *
 * 기능:
 * - 배포 히스토리 조회 (GET /deployment/history)
 * - 특정 배포 정보 조회 (GET /deployment/history/{deploymentId})
 * - 배포 정보 기록 (POST /deployment/history)
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    const httpMethod = event.httpMethod;
    const pathParameters = event.pathParameters;
    const queryStringParameters = event.queryStringParameters || {};

    switch (httpMethod) {
      case 'GET':
        if (pathParameters?.deploymentId) {
          return await getDeploymentById(pathParameters.deploymentId);
        } else {
          return await getDeploymentHistory(queryStringParameters);
        }

      case 'POST':
        return await recordDeployment(JSON.parse(event.body || '{}'));

      default:
        return {
          statusCode: 405,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};

/**
 * 배포 히스토리 조회
 */
async function getDeploymentHistory(
  queryParams: Record<string, string>
): Promise<APIGatewayProxyResult> {
  const { limit = '50', status, from, to, deploymentType } = queryParams;

  const tableName = process.env.DEPLOYMENT_HISTORY_TABLE;
  const environment = process.env.ENVIRONMENT;

  if (!tableName || !environment) {
    throw new Error('Required environment variables are not set');
  }

  try {
    const queryParams: {
      TableName: string;
      IndexName: string;
      KeyConditionExpression: string;
      ExpressionAttributeValues: Record<string, unknown>;
      ScanIndexForward: boolean;
      Limit: number;
      FilterExpression?: string;
      ExpressionAttributeNames?: Record<string, string>;
    } = {
      TableName: tableName,
      IndexName: 'EnvironmentIndex',
      KeyConditionExpression: 'environment = :env',
      ExpressionAttributeValues: {
        ':env': environment,
      },
      ScanIndexForward: false, // 최신순 정렬
      Limit: parseInt(limit),
    };

    // 필터 조건 추가
    const filterExpressions: string[] = [];
    const expressionAttributeValues: Record<string, unknown> = { ':env': environment };

    if (status) {
      filterExpressions.push('#status = :status');
      expressionAttributeValues[':status'] = status;
      queryParams.ExpressionAttributeNames = { '#status': 'status' };
    }

    if (deploymentType) {
      filterExpressions.push('deploymentType = :deploymentType');
      expressionAttributeValues[':deploymentType'] = deploymentType;
    }

    if (from) {
      filterExpressions.push('#timestamp >= :from');
      expressionAttributeValues[':from'] = from;
      queryParams.ExpressionAttributeNames = {
        ...queryParams.ExpressionAttributeNames,
        '#timestamp': 'timestamp',
      };
    }

    if (to) {
      filterExpressions.push('#timestamp <= :to');
      expressionAttributeValues[':to'] = to;
      queryParams.ExpressionAttributeNames = {
        ...queryParams.ExpressionAttributeNames,
        '#timestamp': 'timestamp',
      };
    }

    if (filterExpressions.length > 0) {
      queryParams.FilterExpression = filterExpressions.join(' AND ');
      queryParams.ExpressionAttributeValues = expressionAttributeValues;
    }

    const result = await docClient.send(new QueryCommand(queryParams));

    // 추가 메타데이터 포함
    const enhancedItems = await Promise.all(
      (result.Items || []).map(async item => {
        const deploymentRecord = item as DeploymentRecord;

        // CloudFormation 스택 정보 추가 (필요시)
        if (deploymentRecord.status === 'in_progress') {
          try {
            const stackInfo = await getStackInfo();
            deploymentRecord.details = {
              ...deploymentRecord.details,
              stackStatus: stackInfo.status,
              lastUpdated: stackInfo.lastUpdated,
            };
          } catch (error) {
            console.warn('Failed to get stack info:', error);
          }
        }

        return deploymentRecord;
      })
    );

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        deployments: enhancedItems,
        count: enhancedItems.length,
        lastEvaluatedKey: result.LastEvaluatedKey,
        environment,
        generatedAt: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error('Failed to get deployment history:', error);
    throw error;
  }
}

/**
 * 특정 배포 정보 조회
 */
async function getDeploymentById(deploymentId: string): Promise<APIGatewayProxyResult> {
  const tableName = process.env.DEPLOYMENT_HISTORY_TABLE;

  if (!tableName) {
    throw new Error('DEPLOYMENT_HISTORY_TABLE environment variable is not set');
  }

  try {
    // 정확한 키를 모르므로 Query를 사용하여 검색
    const result = await docClient.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: 'deploymentId = :deploymentId',
        ExpressionAttributeValues: {
          ':deploymentId': deploymentId,
        },
      })
    );

    if (!result.Items || result.Items.length === 0) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Deployment not found' }),
      };
    }

    const deployment = result.Items[0] as DeploymentRecord;

    // 관련 이벤트 정보도 함께 조회
    try {
      const stackEvents = await getStackEvents();
      deployment.details = {
        ...deployment.details,
        recentEvents: stackEvents,
      };
    } catch (error) {
      console.warn('Failed to get stack events:', error);
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(deployment),
    };
  } catch (error) {
    console.error('Failed to get deployment by ID:', error);
    throw error;
  }
}

/**
 * 배포 정보 기록
 */
async function recordDeployment(
  deploymentData: Partial<DeploymentRecord>
): Promise<APIGatewayProxyResult> {
  const tableName = process.env.DEPLOYMENT_HISTORY_TABLE;
  const environment = process.env.ENVIRONMENT;

  if (!tableName || !environment) {
    throw new Error('Required environment variables are not set');
  }

  try {
    const now = new Date();
    const deploymentRecord: DeploymentRecord = {
      deploymentId: deploymentData.deploymentId || `deploy-${now.getTime()}`,
      timestamp: deploymentData.timestamp || now.toISOString(),
      environment,
      status: deploymentData.status || 'in_progress',
      deploymentType: deploymentData.deploymentType || 'deploy',
      version: deploymentData.version,
      commitSha: deploymentData.commitSha,
      deployedBy: deploymentData.deployedBy,
      duration: deploymentData.duration,
      changes: deploymentData.changes || [],
      errorMessage: deploymentData.errorMessage,
      rollbackTarget: deploymentData.rollbackTarget,
      details: deploymentData.details || ({} as Record<string, unknown>),
      ttl: Math.floor(now.getTime() / 1000) + 90 * 24 * 60 * 60, // 90일 후 삭제
    };

    await docClient.send(
      new PutCommand({
        TableName: tableName,
        Item: deploymentRecord,
      })
    );

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: 'Deployment recorded successfully',
        deploymentId: deploymentRecord.deploymentId,
        timestamp: deploymentRecord.timestamp,
      }),
    };
  } catch (error) {
    console.error('Failed to record deployment:', error);
    throw error;
  }
}

/**
 * CloudFormation 스택 정보 조회
 */
async function getStackInfo() {
  const stackName = `HanbitTodoStack-${process.env.ENVIRONMENT}`;

  try {
    const result = await cloudFormationClient.send(
      new DescribeStacksCommand({
        StackName: stackName,
      })
    );

    const stack = result.Stacks?.[0];
    if (!stack) {
      throw new Error('Stack not found');
    }

    return {
      status: stack.StackStatus,
      lastUpdated: stack.LastUpdatedTime?.toISOString(),
      creationTime: stack.CreationTime?.toISOString(),
      description: stack.Description,
    };
  } catch (error) {
    console.error('Failed to get stack info:', error);
    throw error;
  }
}

/**
 * CloudFormation 스택 이벤트 조회
 */
async function getStackEvents() {
  const stackName = `HanbitTodoStack-${process.env.ENVIRONMENT}`;

  try {
    const result = await cloudFormationClient.send(
      new DescribeStackEventsCommand({
        StackName: stackName,
      })
    );

    // 최근 10개 이벤트만 반환
    return (result.StackEvents || []).slice(0, 10).map(event => ({
      timestamp: event.Timestamp?.toISOString(),
      resourceType: event.ResourceType,
      logicalResourceId: event.LogicalResourceId,
      resourceStatus: event.ResourceStatus,
      resourceStatusReason: event.ResourceStatusReason,
    }));
  } catch (error) {
    console.error('Failed to get stack events:', error);
    throw error;
  }
}
