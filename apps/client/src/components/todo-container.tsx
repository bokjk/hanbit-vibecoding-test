
import { useEffect, useRef, useState } from 'react';
import { TodoProvider, useTodoContext } from '../contexts/todo.context';
import { LocalStorageService } from '../services/localStorage.service';
import { TodoInput } from './todo-input';
import { TodoList } from './todo-list';
import { TodoFilters } from './todo-filters';
import { TodoStatsComponent, TodoStatsCard } from './todo-stats';
import { TodoHeader } from './todo-header';
import { Button } from '@/components/ui/button';
import type { Priority, Todo } from 'types/index';

const localStorageService = new LocalStorageService();

function TodoContainerContent() {
  const { state, filteredTodos, stats, updateTodo, addTodo, toggleTodo, deleteTodo, loadTodos, setFilter } = useTodoContext();
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const isInitialLoad = useRef(true);

  useEffect(() => {
    const loadData = async () => {
      const todos = await localStorageService.getTodos();
      loadTodos(todos);
      isInitialLoad.current = false;
    };
    loadData();
  }, [loadTodos]);

  useEffect(() => {
    if (!isInitialLoad.current) {
      localStorageService.saveTodos(state.todos);
    }
  }, [state.todos]);

  const handleAddTodo = (title: string, priority: Priority) => {
    const newTodo: Omit<Todo, 'id' | 'createdAt' | 'updatedAt' | 'completed'> = { title, priority };
    addTodo(newTodo);
  };

  const handleToggleTodo = (id: string) => {
    toggleTodo(id);
  };

  const handleDeleteTodo = (id: string) => {
    deleteTodo(id);
  };

  const handleEditTodo = (id: string, title: string) => {
    const existingTodo = state.todos.find(todo => todo.id === id);
    if (existingTodo) {
      const updatedTodo: Todo = {
        ...existingTodo,
        title,
        updatedAt: new Date().toISOString(),
      };
      updateTodo(updatedTodo);
    }
  };

  const toggleMobileSidebar = () => {
    setShowMobileSidebar(!showMobileSidebar);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <TodoHeader 
        onToggleSidebar={toggleMobileSidebar}
        showSidebar={showMobileSidebar}
      />

      <div className="flex flex-1">
        {/* 사이드바 (데스크톱용) */}
        <aside className="hidden md:block w-64 bg-white border-r border-gray-200 min-h-[calc(100vh-4rem)]">
          <div className="p-6">
            <TodoFilters
              filter={state.filter}
              onFilterChange={setFilter}
            />
            <div className="mt-8">
              <TodoStatsComponent stats={stats} />
            </div>
          </div>
        </aside>

        {/* 모바일 사이드바 오버레이 */}
        {showMobileSidebar && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            {/* 배경 오버레이 */}
            <div 
              className="fixed inset-0 bg-black bg-opacity-50"
              onClick={toggleMobileSidebar}
            />
            {/* 사이드바 */}
            <div className="relative bg-white w-80 max-w-[85vw] h-full shadow-xl">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold">필터 및 정렬</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleMobileSidebar}
                    className="p-2"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </Button>
                </div>
                <TodoFilters
                  filter={state.filter}
                  onFilterChange={(filter) => {
                    setFilter(filter);
                    setShowMobileSidebar(false);
                  }}
                />
                <div className="mt-8">
                  <TodoStatsComponent stats={stats} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 메인 콘텐츠 */}
        <main className="flex-1 p-4 md:p-8">
          <div className="max-w-6xl mx-auto">
            {/* 모바일 필터 버튼들 */}
            <div className="md:hidden mb-6">
              <div className="flex flex-wrap gap-2 mb-4">
                <Button
                  variant={state.filter.type === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter({ ...state.filter, type: 'all' })}
                >
                  전체
                </Button>
                <Button
                  variant={state.filter.type === 'active' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter({ ...state.filter, type: 'active' })}
                >
                  진행중
                </Button>
                <Button
                  variant={state.filter.type === 'completed' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter({ ...state.filter, type: 'completed' })}
                >
                  완료
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleMobileSidebar}
                  className="ml-auto"
                >
                  정렬
                </Button>
              </div>
              
              <TodoStatsComponent stats={stats} className="mb-6" />
            </div>

            {/* 할 일 입력 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
              <TodoInput onAddTodo={handleAddTodo} />
            </div>

            {/* 할 일 목록 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">
                  할 일 목록
                  {filteredTodos.length > 0 && (
                    <span className="ml-2 text-sm font-normal text-gray-500">
                      ({filteredTodos.length}개)
                    </span>
                  )}
                </h2>
              </div>

              {filteredTodos.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">할 일이 없습니다</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    새로운 할 일을 추가해보세요.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <TodoList
                    todos={filteredTodos}
                    onToggleTodo={handleToggleTodo}
                    onDeleteTodo={handleDeleteTodo}
                    onEditTodo={handleEditTodo}
                  />
                </div>
              )}
            </div>

            {/* 하단 통계 카드 (데스크톱용) */}
            <div className="hidden md:block">
              <TodoStatsCard stats={stats} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export function TodoContainer() {
  return (
    <TodoProvider>
      <TodoContainerContent />
    </TodoProvider>
  );
}
