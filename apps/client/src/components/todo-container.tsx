import { useState } from "react";
import { TodoProvider } from "../contexts/todo.context";
import { TodoInput } from "./todo-input";
import { TodoList } from "./todo-list";
import { TodoFilters } from "./todo-filters";
import { TodoStatsComponent, TodoProgressBar } from "./todo-stats";
import { TodoHeader } from "./todo-header";
import { MigrationStatus } from "./auth/migration-dialog";
import { Button } from "@vive/ui";
import { Card, CardContent } from "@vive/ui";
import { useTodo, useTodoSync } from "../hooks/use-todo";
// Priority import 제거 - 사용하지 않음

function TodoContainerContent() {
  const {
    todos: filteredTodos,
    stats,
    updateTodo,
    deleteTodo,
    toggleTodo,
    filter: filterHelpers,
    metadata,
  } = useTodo();

  const syncHelpers = useTodoSync();
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const handleToggleTodo = async (id: string) => {
    try {
      await toggleTodo(id);
    } catch (error) {
      console.error("Failed to toggle todo:", error);
    }
  };

  const handleDeleteTodo = async (id: string) => {
    try {
      await deleteTodo(id);
    } catch (error) {
      console.error("Failed to delete todo:", error);
    }
  };

  const handleEditTodo = async (id: string, title: string) => {
    try {
      await updateTodo(id, { title });
    } catch (error) {
      console.error("Failed to edit todo:", error);
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
    ? filteredTodos.filter((todo) =>
        todo.title.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : filteredTodos;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(to bottom right, #f9fafb, rgba(219, 234, 254, 0.3), rgba(237, 233, 254, 0.3))'
    }}>
      {/* 헤더 */}
      <TodoHeader onSearch={handleSearch} />

      {/* 메인 대시보드 */}
      <main style={{
        paddingLeft: '1rem',
        paddingRight: '1rem',
        paddingTop: '2rem',
        paddingBottom: '2rem'
      }}>
        <style>
          {`
            /* Main container padding handled by inline styles */
          `}
        </style>
        <div style={{
          maxWidth: '80rem',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '2rem'
        }}>
          {/* 마이그레이션 상태 표시 */}
          <section>
            <MigrationStatus style={{ marginBottom: '1rem' }} />
          </section>

          {/* 상단 통계 대시보드 */}
          <section data-testid="todo-dashboard">
            <div style={{ marginBottom: '1.5rem' }}>
              <h2 style={{
                fontSize: '1.5rem',
                lineHeight: '2rem',
                fontWeight: 'bold',
                color: '#111827',
                marginBottom: '0.5rem'
              }}>
                대시보드 개요
              </h2>
              <p style={{ color: '#4b5563' }}>
                현재 진행 상황을 한눈에 확인하세요
              </p>
            </div>
            <TodoStatsComponent stats={stats} />
          </section>

          {/* 진행률 카드 */}
          <section>
            <TodoProgressBar stats={stats} />
          </section>

          {/* 빠른 작업 및 필터 패널 */}
          <section style={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: '1.5rem'
          }}>
            <style>
              {`
                @media (min-width: 1024px) {
                  .section-grid { grid-template-columns: repeat(4, 1fr) !important; }
                  .input-section { grid-column: span 3 / span 3 !important; }
                  .filter-section { grid-column: span 1 / span 1 !important; }
                }
              `}
            </style>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: '1.5rem'
            }}>
              {/* 왼쪽: 할 일 입력 */}
              <div>
                <style>
                  {`
                    @media (min-width: 1024px) {
                      .input-section { grid-column: span 3 / span 3 !important; }
                    }
                  `}
                </style>
                <div className="input-section" style={{ gridColumn: 'span 1 / span 1' }}>
                <Card style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.7)',
                  backdropFilter: 'blur(8px)',
                  borderColor: 'rgba(255, 255, 255, 0.5)',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                }}>
                  <CardContent style={{ padding: '1.5rem' }}>
                    <div style={{ marginBottom: '1rem' }}>
                      <h3 style={{
                        fontSize: '1.125rem',
                        lineHeight: '1.75rem',
                        fontWeight: '600',
                        color: '#111827',
                        marginBottom: '0.5rem'
                      }}>
                        새로운 할 일 추가
                      </h3>
                      <p style={{
                        fontSize: '0.875rem',
                        lineHeight: '1.25rem',
                        color: '#4b5563'
                      }}>
                        목표를 설정하고 우선순위를 정해보세요
                      </p>
                    </div>
                    <TodoInput />
                  </CardContent>
                </Card>
                </div>
              </div>

              {/* 오른쪽: 필터 패널 */}
              <div>
                <style>
                  {`
                    @media (min-width: 1024px) {
                      .filter-section { grid-column: span 1 / span 1 !important; }
                    }
                  `}
                </style>
                <div className="filter-section" style={{ gridColumn: 'span 1 / span 1' }}>
                <Card style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.7)',
                  backdropFilter: 'blur(8px)',
                  borderColor: 'rgba(255, 255, 255, 0.5)',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                }}>
                  <CardContent style={{ padding: '1.5rem' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '1rem'
                    }}>
                      <h3 style={{
                        fontSize: '1.125rem',
                        lineHeight: '1.75rem',
                        fontWeight: '600',
                        color: '#111827'
                      }}>
                        필터 & 정렬
                      </h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={toggleFilterPanel}
                        style={{ display: 'none' }}
                      >
                        <style>
                          {`
                            @media (max-width: 1023px) {
                              .filter-toggle { display: inline-flex !important; }
                            }
                          `}
                        </style>
                        <div className="filter-toggle" style={{ display: 'none' }}>
                          <svg
                            style={{ height: '1rem', width: '1rem' }}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </div>
                      </Button>
                    </div>

                    <div style={{
                      display: showFilterPanel ? 'block' : 'none'
                    }}>
                      <style>
                        {`
                          @media (min-width: 1024px) {
                            .filter-content { display: block !important; }
                          }
                        `}
                      </style>
                      <div className="filter-content" style={{
                        display: showFilterPanel ? 'block' : 'none'
                      }}>
                        <TodoFilters
                          filter={filterHelpers}
                          onFilterChange={filterHelpers}
                          syncHelpers={syncHelpers}
                          metadata={metadata}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                </div>
              </div>
            </div>
          </section>

          {/* 할 일 목록 섹션 */}
          <section>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1.5rem'
            }}>
              <div>
                <h2 style={{
                  fontSize: '1.5rem',
                  lineHeight: '2rem',
                  fontWeight: 'bold',
                  color: '#111827'
                }}>할 일 목록</h2>
                <p style={{
                  color: '#4b5563',
                  marginTop: '0.25rem'
                }}>
                  {searchFilteredTodos.length > 0
                    ? `총 ${searchFilteredTodos.length}개의 할 일이 있습니다`
                    : "등록된 할 일이 없습니다"}
                  {searchQuery && (
                    <span style={{
                      marginLeft: '0.5rem',
                      color: '#2563eb',
                      fontWeight: '500'
                    }}>
                      "{searchQuery}" 검색 결과
                    </span>
                  )}
                </p>
              </div>

              {/* 뷰 모드 선택 */}
              <div style={{
                display: 'none',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: 'white',
                borderRadius: '0.5rem',
                padding: '0.25rem',
                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
              }}>
                <style>
                  {`
                    @media (min-width: 768px) {
                      .view-mode-selector { display: flex !important; }
                    }
                  `}
                </style>
                <div className="view-mode-selector" style={{
                  display: 'none',
                  alignItems: 'center',
                  gap: '0.5rem',
                  backgroundColor: 'white',
                  borderRadius: '0.5rem',
                  padding: '0.25rem',
                  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                }}>
                  <Button
                    variant="ghost"
                    size="sm"
                    style={{
                      height: '2rem',
                      width: '2rem',
                      padding: 0,
                      backgroundColor: '#dbeafe',
                      color: '#2563eb'
                    }}
                  >
                    <svg
                      style={{ height: '1rem', width: '1rem' }}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                      />
                    </svg>
                  </Button>
                  <Button variant="ghost" size="sm" style={{ height: '2rem', width: '2rem', padding: 0 }}>
                    <svg
                      style={{ height: '1rem', width: '1rem' }}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 6h16M4 10h16M4 14h16M4 18h16"
                      />
                    </svg>
                  </Button>
                </div>
              </div>
            </div>

            {/* 할 일 목록 */}
            {searchFilteredTodos.length === 0 ? (
              <Card style={{
                backgroundColor: 'rgba(255, 255, 255, 0.5)',
                backdropFilter: 'blur(8px)',
                borderStyle: 'dashed',
                borderWidth: '2px',
                borderColor: '#d1d5db'
              }}>
                <CardContent style={{ padding: '3rem' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      width: '5rem',
                      height: '5rem',
                      margin: '0 auto',
                      marginBottom: '1rem',
                      background: 'linear-gradient(to bottom right, #dbeafe, #e9d5ff)',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <svg
                        style={{ height: '2.5rem', width: '2.5rem', color: '#9ca3af' }}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                        />
                      </svg>
                    </div>
                    <h3 style={{
                      fontSize: '1.25rem',
                      lineHeight: '1.75rem',
                      fontWeight: '600',
                      color: '#111827',
                      marginBottom: '0.5rem'
                    }}>
                      {searchQuery
                        ? "검색 결과가 없습니다"
                        : "할 일이 없습니다"}
                    </h3>
                    <p style={{
                      color: '#4b5563',
                      maxWidth: '28rem',
                      margin: '0 auto'
                    }}>
                      {searchQuery
                        ? `"${searchQuery}"와 일치하는 할 일을 찾을 수 없습니다. 다른 키워드로 검색해보세요.`
                        : "새로운 할 일을 추가해서 생산성을 높여보세요!"}
                    </p>
                    {searchQuery && (
                      <Button
                        variant="outline"
                        onClick={() => setSearchQuery("")}
                        style={{ marginTop: '1rem' }}
                      >
                        검색 초기화
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr',
                gap: '1.5rem'
              }}>
                <style>
                  {`
                    @media (min-width: 768px) {
                      .todo-grid { grid-template-columns: repeat(2, 1fr) !important; }
                    }
                    @media (min-width: 1280px) {
                      .todo-grid { grid-template-columns: repeat(3, 1fr) !important; }
                    }
                  `}
                </style>
                <div className="todo-grid" style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr',
                  gap: '1.5rem'
                }}>
                  <TodoList
                    todos={searchFilteredTodos}
                    onToggleTodo={handleToggleTodo}
                    onDeleteTodo={handleDeleteTodo}
                    onEditTodo={handleEditTodo}
                  />
                </div>
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