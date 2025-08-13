import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

interface DeploymentStats {
  environment: string;
  totalDeployments: number;
  successfulDeployments: number;
  failedDeployments: number;
  rolledBackDeployments: number;
  successRate: number;
  averageDuration: number;
  deploymentsByType: Record<string, number>;
  deploymentsByDay: Array<{
    date: string;
    count: number;
    successCount: number;
    failureCount: number;
  }>;
  recentTrends: {
    last7Days: DeploymentMetric;
    last30Days: DeploymentMetric;
    last90Days: DeploymentMetric;
  };
  topFailureReasons: Array<{
    reason: string;
    count: number;
    percentage: number;
  }>;
  performanceMetrics: {
    fastestDeployment: number;
    slowestDeployment: number;
    medianDuration: number;
    p95Duration: number;
  };
}

interface DeploymentMetric {
  totalDeployments: number;
  successfulDeployments: number;
  failedDeployments: number;
  successRate: number;
  averageDuration: number;
}

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
 * 배포 통계 분석 핸들러
 *
 * 기능:
 * - 배포 성공률 통계
 * - 배포 소요 시간 분석
 * - 실패 원인 분석
 * - 트렌드 분석
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    const queryParams = event.queryStringParameters || {};
    const {
      period = '30', // 기본 30일
      includeDetails = 'true',
    } = queryParams;

    const stats = await generateDeploymentStats(parseInt(period), includeDetails === 'true');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        stats,
        generatedAt: new Date().toISOString(),
        period: `${period} days`,
      }),
    };
  } catch (error) {
    console.error('Error generating deployment stats:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Failed to generate deployment statistics',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};

/**
 * 배포 통계 생성
 */
async function generateDeploymentStats(
  periodDays: number,
  includeDetails: boolean
): Promise<DeploymentStats> {
  const tableName = process.env.DEPLOYMENT_HISTORY_TABLE;
  const environment = process.env.ENVIRONMENT;

  if (!tableName || !environment) {
    throw new Error('Required environment variables are not set');
  }

  // 조회 기간 설정
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - periodDays * 24 * 60 * 60 * 1000);

  try {
    // 환경별 배포 데이터 조회
    const deployments = await getAllDeploymentsInPeriod(tableName, environment, startDate, endDate);

    // 기본 통계 계산
    const totalDeployments = deployments.length;
    const successfulDeployments = deployments.filter(d => d.status === 'success').length;
    const failedDeployments = deployments.filter(d => d.status === 'failure').length;
    const rolledBackDeployments = deployments.filter(d => d.status === 'rolled_back').length;
    const successRate = totalDeployments > 0 ? (successfulDeployments / totalDeployments) * 100 : 0;

    // 평균 배포 시간 계산
    const deploymentsWithDuration = deployments.filter(d => d.duration && d.duration > 0);
    const averageDuration =
      deploymentsWithDuration.length > 0
        ? deploymentsWithDuration.reduce((sum, d) => sum + (d.duration || 0), 0) /
          deploymentsWithDuration.length
        : 0;

    // 배포 타입별 통계
    const deploymentsByType = deployments.reduce(
      (acc, d) => {
        acc[d.deploymentType || 'deploy'] = (acc[d.deploymentType || 'deploy'] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    // 성능 메트릭
    const performanceMetrics = calculatePerformanceMetrics(deploymentsWithDuration);

    // 상세 분석 (옵션)
    let deploymentsByDay: DeploymentStats['deploymentsByDay'] = [];
    let recentTrends: DeploymentStats['recentTrends'];
    let topFailureReasons: DeploymentStats['topFailureReasons'] = [];

    if (includeDetails) {
      deploymentsByDay = generateDailyStats(deployments, startDate, endDate);
      recentTrends = generateTrendStats(deployments);
      topFailureReasons = analyzeFailureReasons(deployments.filter(d => d.status === 'failure'));
    } else {
      recentTrends = {
        last7Days: {
          totalDeployments: 0,
          successfulDeployments: 0,
          failedDeployments: 0,
          successRate: 0,
          averageDuration: 0,
        },
        last30Days: {
          totalDeployments: 0,
          successfulDeployments: 0,
          failedDeployments: 0,
          successRate: 0,
          averageDuration: 0,
        },
        last90Days: {
          totalDeployments: 0,
          successfulDeployments: 0,
          failedDeployments: 0,
          successRate: 0,
          averageDuration: 0,
        },
      };
    }

    return {
      environment,
      totalDeployments,
      successfulDeployments,
      failedDeployments,
      rolledBackDeployments,
      successRate: Math.round(successRate * 100) / 100,
      averageDuration: Math.round(averageDuration),
      deploymentsByType,
      deploymentsByDay,
      recentTrends,
      topFailureReasons,
      performanceMetrics,
    };
  } catch (error) {
    console.error('Failed to generate deployment stats:', error);
    throw error;
  }
}

/**
 * 기간 내 모든 배포 데이터 조회
 */
async function getAllDeploymentsInPeriod(
  tableName: string,
  environment: string,
  startDate: Date,
  endDate: Date
) {
  const deployments: DeploymentRecord[] = [];
  let lastEvaluatedKey: Record<string, unknown> | undefined = undefined;

  do {
    const queryParams: {
      TableName: string;
      IndexName: string;
      KeyConditionExpression: string;
      ExpressionAttributeNames: Record<string, string>;
      ExpressionAttributeValues: Record<string, unknown>;
      ExclusiveStartKey?: Record<string, unknown>;
    } = {
      TableName: tableName,
      IndexName: 'EnvironmentIndex',
      KeyConditionExpression: 'environment = :env AND #timestamp BETWEEN :start AND :end',
      ExpressionAttributeNames: {
        '#timestamp': 'timestamp',
      },
      ExpressionAttributeValues: {
        ':env': environment,
        ':start': startDate.toISOString(),
        ':end': endDate.toISOString(),
      },
      ExclusiveStartKey: lastEvaluatedKey,
    };

    const result = await docClient.send(new QueryCommand(queryParams));

    if (result.Items) {
      deployments.push(...result.Items);
    }

    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return deployments;
}

/**
 * 성능 메트릭 계산
 */
function calculatePerformanceMetrics(deployments: DeploymentRecord[]) {
  if (deployments.length === 0) {
    return {
      fastestDeployment: 0,
      slowestDeployment: 0,
      medianDuration: 0,
      p95Duration: 0,
    };
  }

  const durations = deployments.map(d => d.duration).sort((a, b) => a - b);

  return {
    fastestDeployment: durations[0],
    slowestDeployment: durations[durations.length - 1],
    medianDuration: durations[Math.floor(durations.length / 2)],
    p95Duration: durations[Math.floor(durations.length * 0.95)],
  };
}

/**
 * 일별 배포 통계 생성
 */
function generateDailyStats(deployments: DeploymentRecord[], startDate: Date, endDate: Date) {
  const dailyStats: Record<string, { total: number; success: number; failure: number }> = {};

  // 날짜별로 그룹화
  deployments.forEach(deployment => {
    const date = new Date(deployment.timestamp).toISOString().split('T')[0];

    if (!dailyStats[date]) {
      dailyStats[date] = { total: 0, success: 0, failure: 0 };
    }

    dailyStats[date].total++;
    if (deployment.status === 'success') {
      dailyStats[date].success++;
    } else if (deployment.status === 'failure') {
      dailyStats[date].failure++;
    }
  });

  // 결과 배열로 변환
  const result = [];
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const stats = dailyStats[dateStr] || { total: 0, success: 0, failure: 0 };

    result.push({
      date: dateStr,
      count: stats.total,
      successCount: stats.success,
      failureCount: stats.failure,
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return result;
}

/**
 * 트렌드 통계 생성
 */
function generateTrendStats(allDeployments: DeploymentRecord[]) {
  const now = new Date();

  const last7Days = filterDeploymentsByDays(allDeployments, 7, now);
  const last30Days = filterDeploymentsByDays(allDeployments, 30, now);
  const last90Days = filterDeploymentsByDays(allDeployments, 90, now);

  return {
    last7Days: calculateMetricsForPeriod(last7Days),
    last30Days: calculateMetricsForPeriod(last30Days),
    last90Days: calculateMetricsForPeriod(last90Days),
  };
}

/**
 * 특정 일수 내 배포 필터링
 */
function filterDeploymentsByDays(deployments: DeploymentRecord[], days: number, endDate: Date) {
  const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

  return deployments.filter(d => {
    const deploymentDate = new Date(d.timestamp);
    return deploymentDate >= startDate && deploymentDate <= endDate;
  });
}

/**
 * 기간별 메트릭 계산
 */
function calculateMetricsForPeriod(deployments: DeploymentRecord[]): DeploymentMetric {
  const total = deployments.length;
  const successful = deployments.filter(d => d.status === 'success').length;
  const failed = deployments.filter(d => d.status === 'failure').length;
  const successRate = total > 0 ? (successful / total) * 100 : 0;

  const deploymentsWithDuration = deployments.filter(d => d.duration && d.duration > 0);
  const averageDuration =
    deploymentsWithDuration.length > 0
      ? deploymentsWithDuration.reduce((sum, d) => sum + d.duration, 0) /
        deploymentsWithDuration.length
      : 0;

  return {
    totalDeployments: total,
    successfulDeployments: successful,
    failedDeployments: failed,
    successRate: Math.round(successRate * 100) / 100,
    averageDuration: Math.round(averageDuration),
  };
}

/**
 * 실패 원인 분석
 */
function analyzeFailureReasons(failedDeployments: DeploymentRecord[]) {
  const reasonCounts: Record<string, number> = {};

  failedDeployments.forEach(deployment => {
    const reason = deployment.errorMessage || 'Unknown error';
    // 에러 메시지를 분류하여 그룹화
    const category = categorizeErrorMessage(reason);
    reasonCounts[category] = (reasonCounts[category] || 0) + 1;
  });

  const total = failedDeployments.length;

  return Object.entries(reasonCounts)
    .map(([reason, count]) => ({
      reason,
      count,
      percentage: Math.round((count / total) * 100 * 100) / 100,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10); // 상위 10개만 반환
}

/**
 * 에러 메시지 분류
 */
function categorizeErrorMessage(errorMessage: string): string {
  const message = errorMessage.toLowerCase();

  if (message.includes('timeout') || message.includes('time out')) {
    return 'Timeout';
  } else if (message.includes('permission') || message.includes('access denied')) {
    return 'Permission Error';
  } else if (message.includes('resource') && message.includes('limit')) {
    return 'Resource Limit';
  } else if (message.includes('network') || message.includes('connection')) {
    return 'Network Error';
  } else if (message.includes('validation') || message.includes('invalid')) {
    return 'Validation Error';
  } else if (message.includes('lambda') || message.includes('function')) {
    return 'Lambda Error';
  } else if (message.includes('database') || message.includes('dynamodb')) {
    return 'Database Error';
  } else if (message.includes('cloudformation') || message.includes('stack')) {
    return 'CloudFormation Error';
  } else {
    return 'Other';
  }
}
