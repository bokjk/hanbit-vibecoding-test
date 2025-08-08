/**
 * 의존성 주입 컨테이너
 * Repository, Service, Logger 등의 인스턴스를 관리
 */

import { TodoRepository, TodoService, ITodoService, Logger } from '../services/todo.service';
import { createTodoRepository } from '../repositories/todo-repository';
import { logger } from './logger';

/**
 * CloudWatch Logger 구현체
 */
export class CloudWatchLogger implements Logger {
  info(message: string, meta?: Record<string, unknown>): void {
    logger.info(message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    logger.warn(message, meta);
  }

  error(message: string, error?: Error, meta?: Record<string, unknown>): void {
    logger.error(message, error, meta);
  }
}

/**
 * 의존성 컨테이너 클래스
 */
class Container {
  private static instance: Container;
  private _todoRepository?: TodoRepository;
  private _todoService?: ITodoService;
  private _logger?: Logger;

  private constructor() {
    // 싱글톤 패턴
  }

  static getInstance(): Container {
    if (!Container.instance) {
      Container.instance = new Container();
    }
    return Container.instance;
  }

  /**
   * TodoRepository 인스턴스 반환 (지연 초기화)
   */
  get todoRepository(): TodoRepository {
    if (!this._todoRepository) {
      this._todoRepository = createTodoRepository();
    }
    return this._todoRepository;
  }

  /**
   * Logger 인스턴스 반환 (지연 초기화)
   */
  get logger(): Logger {
    if (!this._logger) {
      this._logger = new CloudWatchLogger();
    }
    return this._logger;
  }

  /**
   * TodoService 인스턴스 반환 (지연 초기화)
   */
  get todoService(): ITodoService {
    if (!this._todoService) {
      this._todoService = new TodoService(this.todoRepository, this.logger);
    }
    return this._todoService;
  }

  /**
   * 테스트용 모킹을 위한 인스턴스 재설정
   * @param overrides 재정의할 인스턴스들
   */
  setInstances(overrides: {
    todoRepository?: TodoRepository;
    todoService?: ITodoService;
    logger?: Logger;
  }): void {
    if (overrides.todoRepository) {
      this._todoRepository = overrides.todoRepository;
    }
    if (overrides.todoService) {
      this._todoService = overrides.todoService;
    }
    if (overrides.logger) {
      this._logger = overrides.logger;
    }
  }

  /**
   * 모든 인스턴스 초기화 (테스트 후 정리용)
   */
  reset(): void {
    this._todoRepository = undefined;
    this._todoService = undefined;
    this._logger = undefined;
  }
}

/**
 * 컨테이너 인스턴스 반환
 */
export function getContainer(): Container {
  return Container.getInstance();
}

/**
 * 편의 함수들
 */
export function getTodoService(): ITodoService {
  return getContainer().todoService;
}

export function getTodoRepository(): TodoRepository {
  return getContainer().todoRepository;
}

export function getLogger(): Logger {
  return getContainer().logger;
}

/**
 * Lambda Cold Start 최적화를 위한 사전 초기화
 */
export function warmupContainer(): void {
  const container = getContainer();

  // 인스턴스들을 미리 생성하여 Cold Start 시간 단축
  container.logger;
  container.todoRepository;
  container.todoService;

  logger.info('Container warmed up successfully');
}
