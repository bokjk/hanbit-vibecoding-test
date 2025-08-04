import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { 
  createSuccessResponse, 
  createErrorResponse,
  createNotFoundResponse
} from '@/utils/response';
import { validatePathParams, IdParamSchema } from '@/utils/validation';
import { logger } from '@/utils/logger';

/**
 * DELETE /todos/{id} - TODO 아이템 삭제
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const timer = logger.startTimer();
  const requestId = event.requestContext.requestId;

  try {
    logger.logRequest('DELETE', `/todos/{id}`, { requestId });

    // 경로 파라미터 검증
    const { id } = validatePathParams(
      event.pathParameters,
      IdParamSchema
    );

    // TODO: 비즈니스 로직 구현
    // 1. 사용자 인증 확인
    // 2. TODO 아이템 존재 여부 확인
    // 3. 권한 확인 (본인의 TODO인지)
    // 4. TODO 삭제
    // 5. 결과 반환

    // 임시로 TODO가 존재하지 않는 경우 처리
    if (id === 'non-existent') {
      const duration = timer();
      logger.logResponse('DELETE', `/todos/${id}`, 404, duration, { requestId });
      return createNotFoundResponse('TODO');
    }

    // 성공적으로 삭제된 경우
    const result = {
      message: 'TODO 아이템이 성공적으로 삭제되었습니다.',
      deletedId: id,
    };

    const duration = timer();
    logger.logResponse('DELETE', `/todos/${id}`, 200, duration, { 
      requestId,
      todoId: id
    });

    return createSuccessResponse(result);

  } catch (error) {
    const duration = timer();
    const todoId = event.pathParameters?.id || 'unknown';
    logger.error('Error deleting todo', error as Error, { 
      requestId,
      todoId
    });
    logger.logResponse('DELETE', `/todos/${todoId}`, 500, duration, { requestId });

    return createErrorResponse(error as Error);
  }
};