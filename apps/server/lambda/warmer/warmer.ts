import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { EventBridgeEvent } from 'aws-lambda';

interface WarmerEvent {
  source: string;
  action: string;
  timestamp: string;
}

interface WarmerResult {
  warmedFunctions: number;
  successCount: number;
  errorCount: number;
  duration: number;
  timestamp: string;
}

/**
 * Lambda Warmer 핸들러
 * 대상 Lambda 함수들을 정기적으로 호출하여 warm 상태 유지
 */
export const handler = async (
  event: EventBridgeEvent<string, WarmerEvent>
): Promise<WarmerResult> => {
  const startTime = Date.now();

  console.log('Lambda warmer started', {
    event: JSON.stringify(event, null, 2),
    timestamp: new Date().toISOString(),
  });

  const targetFunctions = JSON.parse(process.env.TARGET_FUNCTIONS || '[]') as string[];
  const concurrency = parseInt(process.env.CONCURRENCY || '1', 10);

  if (targetFunctions.length === 0) {
    console.log('No target functions configured');
    return createResult(0, 0, 0, startTime);
  }

  const lambdaClient = new LambdaClient({
    region: process.env.AWS_REGION,
    maxAttempts: 2,
  });

  const results = await Promise.allSettled(
    targetFunctions.map(functionArn => warmFunction(lambdaClient, functionArn, concurrency))
  );

  // 결과 집계
  let successCount = 0;
  let errorCount = 0;

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      successCount += result.value.successCount;
      errorCount += result.value.errorCount;
    } else {
      errorCount++;
      console.error(`Failed to warm function ${targetFunctions[index]}`, {
        error: result.reason,
      });
    }
  });

  const finalResult = createResult(targetFunctions.length, successCount, errorCount, startTime);

  console.log('Lambda warmer completed', finalResult);

  // CloudWatch 메트릭 발행
  publishMetrics(finalResult);

  return finalResult;
};

/**
 * 개별 Lambda 함수 warming
 */
async function warmFunction(
  lambdaClient: LambdaClient,
  functionArn: string,
  concurrency: number
): Promise<{ successCount: number; errorCount: number }> {
  const functionName = extractFunctionName(functionArn);
  let successCount = 0;
  let errorCount = 0;

  // 동시성 만큼 병렬로 호출
  const promises = Array.from({ length: concurrency }, (_, index) =>
    invokeFunctionWithWarming(lambdaClient, functionArn, index)
  );

  const results = await Promise.allSettled(promises);

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      successCount++;
      console.log(`Function ${functionName} warmed successfully (${index + 1}/${concurrency})`);
    } else {
      errorCount++;
      console.error(`Failed to warm function ${functionName} (${index + 1}/${concurrency})`, {
        error: result.reason,
      });
    }
  });

  return { successCount, errorCount };
}

/**
 * Warmer 페이로드로 Lambda 함수 호출
 */
async function invokeFunctionWithWarming(
  lambdaClient: LambdaClient,
  functionArn: string,
  invocationIndex: number
): Promise<void> {
  const warmerPayload = {
    source: 'lambda-warmer',
    action: 'warm',
    warmer: true,
    invocationIndex,
    timestamp: new Date().toISOString(),
  };

  const command = new InvokeCommand({
    FunctionName: functionArn,
    InvocationType: 'RequestResponse',
    Payload: JSON.stringify(warmerPayload),
  });

  try {
    const response = await lambdaClient.send(command);

    // 에러 응답 확인
    if (response.FunctionError) {
      throw new Error(`Function error: ${response.FunctionError}`);
    }

    // 응답 페이로드 로깅 (디버그)
    if (process.env.LOG_LEVEL === 'DEBUG' && response.Payload) {
      const payload = new TextDecoder().decode(response.Payload);
      console.log(`Function response:`, JSON.parse(payload));
    }
  } catch (error) {
    console.error(`Lambda invocation failed for ${functionArn}`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      invocationIndex,
    });
    throw error;
  }
}

/**
 * 함수 ARN에서 함수 이름 추출
 */
function extractFunctionName(functionArn: string): string {
  const parts = functionArn.split(':');
  return parts[parts.length - 1];
}

/**
 * 결과 객체 생성
 */
function createResult(
  warmedFunctions: number,
  successCount: number,
  errorCount: number,
  startTime: number
): WarmerResult {
  return {
    warmedFunctions,
    successCount,
    errorCount,
    duration: Date.now() - startTime,
    timestamp: new Date().toISOString(),
  };
}

/**
 * CloudWatch 커스텀 메트릭 발행
 */
function publishMetrics(result: WarmerResult): void {
  const { warmedFunctions, successCount, errorCount, duration } = result;

  // CloudWatch 커스텀 메트릭 형식으로 로깅
  console.log(`MONITORING|${warmedFunctions}|Count|LambdaWarmer|FunctionsWarmed`);
  console.log(`MONITORING|${successCount}|Count|LambdaWarmer|SuccessfulWarmups`);
  console.log(`MONITORING|${errorCount}|Count|LambdaWarmer|FailedWarmups`);
  console.log(`MONITORING|${duration}|Milliseconds|LambdaWarmer|WarmerDuration`);

  // 성공률 계산
  const successRate = warmedFunctions > 0 ? (successCount / (successCount + errorCount)) * 100 : 0;
  console.log(`MONITORING|${successRate}|Percent|LambdaWarmer|SuccessRate`);
}

/**
 * 에러 핸들링을 위한 wrapper
 */
export const warmupHandler = async (
  event: EventBridgeEvent<string, WarmerEvent>
): Promise<WarmerResult> => {
  try {
    return await handler(event);
  } catch (error) {
    console.error('Warmer function failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      event: JSON.stringify(event),
    });

    // 부분적 실패도 CloudWatch 메트릭으로 기록
    publishMetrics({
      warmedFunctions: 0,
      successCount: 0,
      errorCount: 1,
      duration: 0,
      timestamp: new Date().toISOString(),
    });

    throw error;
  }
};
