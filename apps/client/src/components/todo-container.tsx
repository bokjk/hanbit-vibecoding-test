
import { useState } from 'react';
import { TodoProvider } from '../contexts/todo.context';
import { TodoInput } from './todo-input';
import { TodoList } from './todo-list';
import { TodoFilters } from './todo-filters';
import { TodoStatsComponent, TodoProgressBar } from './todo-stats';
import { TodoHeader } from './todo-header';
import { MigrationStatus } from './auth/migration-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useTodo, useTodoSync } from '../hooks/use-todo';
import type { Priority } from 'types/index';

function TodoContainerContent() {
  const { 
    todos: filteredTodos, 
    stats, 
    loading,
    error,
    updateTodo, 
    deleteTodo, 
    toggleTodo,
    filter: filterHelpers,
    metadata
  } = useTodo();
  
  const syncHelpers = useTodoSync();
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleToggleTodo = async (id: string) => {
    try {
      await toggleTodo(id);
    } catch (error) {
      console.error('Failed to toggle todo:', error);
    }
  };

  const handleDeleteTodo = async (id: string) => {
    try {
      await deleteTodo(id);
    } catch (error) {
      console.error('Failed to delete todo:', error);
    }
  };

  const handleEditTodo = async (id: string, title: string) => {
    try {
      await updateTodo(id, { title });
    } catch (error) {
      console.error('Failed to edit todo:', error);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const toggleFilterPanel = () => {
    setShowFilterPanel(!showFilterPanel);
  };

  // 검색 필터링 로직
  const searchFilteredTodos = searchQuery.trim() 
    ? filteredTodos.filter(todo => 
        todo.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : filteredTodos;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30">
      {/* 헤더 */}
      <TodoHeader onSearch={handleSearch} />

      {/* 메인 대시보드 */}
      <main className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-7xl mx-auto space-y-8">
          
          {/* 마이그레이션 상태 표시 */}
          <section>
            <MigrationStatus className="mb-4" />
          </section>

          {/* 상단 통계 대시보드 */}
          <section data-testid="todo-dashboard">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">대시보드 개요</h2>
              <p className="text-gray-600">현재 진행 상황을 한눈에 확인하세요</p>
            </div>
            <TodoStatsComponent stats={stats} />
          </section>

          {/* 진행률 카드 */}
          <section>
            <TodoProgressBar stats={stats} />
          </section>

          {/* 빠른 작업 및 필터 패널 */}
          <section className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            
            {/* 왼쪽: 할 일 입력 */}
            <div className="lg:col-span-3">
              <Card className="bg-white/70 backdrop-blur-sm border-white/50 shadow-xl">
                <CardContent className="p-6">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">새로운 할 일 추가</h3>
                    <p className="text-sm text-gray-600">목표를 설정하고 우선순위를 정해보세요</p>
                  </div>
                  <TodoInput />
                </CardContent>
              </Card>
            </div>

            {/* 오른쪽: 필터 패널 */}
            <div className="lg:col-span-1">
              <Card className="bg-white/70 backdrop-blur-sm border-white/50 shadow-xl">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">필터 & 정렬</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={toggleFilterPanel}
                      className="lg:hidden"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </Button>
                  </div>
                  
                  <div className={`${showFilterPanel ? 'block' : 'hidden'} lg:block`}>
                    <TodoFilters
                      filter={filterHelpers}
                      onFilterChange={filterHelpers}
                      syncHelpers={syncHelpers}
                      metadata={metadata}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* 할 일 목록 섹션 */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">할 일 목록</h2>
                <p className="text-gray-600 mt-1">
                  {searchFilteredTodos.length > 0 
                    ? `총 ${searchFilteredTodos.length}개의 할 일이 있습니다`
                    : '등록된 할 일이 없습니다'
                  }
                  {searchQuery && (
                    <span className="ml-2 text-blue-600 font-medium">
                      "{searchQuery}" 검색 결과
                    </span>
                  )}
                </p>
              </div>
              
              {/* 뷰 모드 선택 */}
              <div className="hidden md:flex items-center space-x-2 bg-white rounded-lg p-1 shadow-sm">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 bg-blue-100 text-blue-600"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                </Button>
              </div>
            </div>

            {/* 할 일 목록 */}
            {searchFilteredTodos.length === 0 ? (
              <Card className="bg-white/50 backdrop-blur-sm border-dashed border-2 border-gray-300">
                <CardContent className="p-12">
                  <div className="text-center">
                    <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center">
                      <svg className="h-10 w-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      {searchQuery ? '검색 결과가 없습니다' : '할 일이 없습니다'}
                    </h3>
                    <p className="text-gray-600 max-w-md mx-auto">
                      {searchQuery 
                        ? `"${searchQuery}"와 일치하는 할 일을 찾을 수 없습니다. 다른 키워드로 검색해보세요.`
                        : '새로운 할 일을 추가해서 생산성을 높여보세요!'
                      }
                    </p>
                    {searchQuery && (
                      <Button
                        variant="outline"
                        onClick={() => setSearchQuery('')}
                        className="mt-4"
                      >
                        검색 초기화
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                <TodoList
                  todos={searchFilteredTodos}
                  onToggleTodo={handleToggleTodo}
                  onDeleteTodo={handleDeleteTodo}
                  onEditTodo={handleEditTodo}
                />
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

export function TodoContainer() {
  return (
    <TodoProvider enableAutoSync={true}>
      <TodoContainerContent />
    </TodoProvider>
  );
}
