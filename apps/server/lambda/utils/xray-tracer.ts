import AWSXRay from 'aws-xray-sdk-core';
import AWS from 'aws-sdk';

/**
 * X-Ray 추적 설정 및 초기화
 * Lambda 환경에서 자동으로 X-Ray를 활성화하고 AWS SDK를 계측
 */

// 환경 변수로 X-Ray 활성화 여부 확인
const isXRayEnabled = !!process.env._X_AMZN_TRACE_ID;

let xrayInitialized = false;

/**
 * X-Ray SDK 초기화
 * Lambda 환경에서는 자동으로 세그먼트가 생성되므로 별도 설정 불필요
 */
export function initializeXRay(): void {
  if (xrayInitialized || !isXRayEnabled) {
    return;
  }

  try {
    // AWS SDK 자동 계측 활성화
    AWSXRay.captureAWS(AWS);

    // 로컬 테스트 환경에서는 X-Ray 데몬이 없을 수 있으므로 오류 무시
    if (process.env.NODE_ENV === 'development') {
      AWSXRay.setContextMissingStrategy('LOG_ERROR');
    }

    xrayInitialized = true;
    console.log('X-Ray SDK initialized successfully');
  } catch (error) {
    console.warn('X-Ray SDK initialization failed:', error);
  }
}

/**
 * 사용자 정의 서브세그먼트 생성
 * 비동기 작업이나 외부 API 호출 추적에 사용
 */
export function traceAsync<T>(
  name: string,
  fn: (subsegment?: AWSXRay.Subsegment) => Promise<T>,
  metadata?: Record<string, unknown>
): Promise<T> {
  if (!isXRayEnabled) {
    // X-Ray가 비활성화된 경우 추적 없이 함수 실행
    return fn();
  }

  return new Promise((resolve, reject) => {
    AWSXRay.captureAsyncFunc(name, async subsegment => {
      try {
        // 메타데이터 추가
        if (metadata && subsegment) {
          subsegment.addMetadata('custom', metadata);
        }

        const result = await fn(subsegment);

        if (subsegment) {
          subsegment.close();
        }

        resolve(result);
      } catch (error) {
        if (subsegment) {
          subsegment.close(error as Error);
        }
        reject(error);
      }
    });
  });
}

/**
 * 동기 함수 추적
 */
export function traceSync<T>(
  name: string,
  fn: (subsegment?: AWSXRay.Subsegment) => T,
  metadata?: Record<string, unknown>
): T {
  if (!isXRayEnabled) {
    return fn();
  }

  return AWSXRay.captureFunc(name, subsegment => {
    try {
      if (metadata && subsegment) {
        subsegment.addMetadata('custom', metadata);
      }
      return fn(subsegment);
    } catch (error) {
      if (subsegment) {
        subsegment.addError(error as Error);
      }
      throw error;
    }
  });
}

/**
 * 현재 세그먼트에 사용자 정보 추가
 */
export function addUserInfo(userId: string, userType: 'authenticated' | 'guest'): void {
  if (!isXRayEnabled) return;

  try {
    const segment = AWSXRay.getSegment();
    if (segment) {
      segment.setUser(userId);
      segment.addAnnotation('userType', userType);
    }
  } catch (error) {
    console.warn('Failed to add user info to X-Ray segment:', error);
  }
}

/**
 * 현재 세그먼트에 주석 추가
 */
export function addAnnotation(key: string, value: string | number | boolean): void {
  if (!isXRayEnabled) return;

  try {
    const segment = AWSXRay.getSegment();
    if (segment) {
      segment.addAnnotation(key, value);
    }
  } catch (error) {
    console.warn('Failed to add annotation to X-Ray segment:', error);
  }
}

/**
 * 현재 세그먼트에 메타데이터 추가
 */
export function addMetadata(namespace: string, data: Record<string, unknown>): void {
  if (!isXRayEnabled) return;

  try {
    const segment = AWSXRay.getSegment();
    if (segment) {
      segment.addMetadata(namespace, data);
    }
  } catch (error) {
    console.warn('Failed to add metadata to X-Ray segment:', error);
  }
}
