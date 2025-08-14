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
import styles from "./todo-container.module.scss";

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
    <div className={styles.pageWrapper}>
      {/* 헤더 */}
      <TodoHeader onSearch={handleSearch} />

      {/* 메인 대시보드 */}
      <main className={styles.main}>
        <div className={styles.container}>
          {/* 마이그레이션 상태 표시 */}
          <section>
            <MigrationStatus className={styles.migrationStatus} />
          </section>

          {/* 상단 통계 대시보드 */}
          <section data-testid="todo-dashboard">
            <div className={styles.dashboardHeader}>
              <h2 className={styles.dashboardTitle}>
                대시보드 개요
              </h2>
              <p className={styles.dashboardDescription}>
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
          <section className={styles.sectionGrid}>
            <div className={styles.inputSection}>
              <Card className={styles.glassCard}>
                <CardContent className={styles.cardContent}>
                  <div className={styles.inputCardHeader}>
                    <h3 className={styles.inputCardTitle}>
                      새로운 할 일 추가
                    </h3>
                    <p className={styles.inputCardDescription}>
                      목표를 설정하고 우선순위를 정해보세요
                    </p>
                  </div>
                  <TodoInput />
                </CardContent>
              </Card>
            </div>

            <div className={styles.filterSection}>
              <Card className={styles.glassCard}>
                <CardContent className={styles.cardContent}>
                  <div className={styles.filterHeader}>
                    <h3 className={styles.filterTitle}>
                      필터 & 정렬
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={toggleFilterPanel}
                      className={styles.filterToggle}
                    >
                      <svg
                        className={styles.filterToggleIcon}
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
                    </Button>
                  </div>

                  <div className={`${styles.filterContent} ${showFilterPanel ? styles.show : ''}`}>
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
            <div className={styles.listHeader}>
              <div>
                <h2 className={styles.listTitle}>할 일 목록</h2>
                <p className={styles.listDescription}>
                  {searchFilteredTodos.length > 0
                    ? `총 ${searchFilteredTodos.length}개의 할 일이 있습니다`
                    : "등록된 할 일이 없습니다"}
                  {searchQuery && (
                    <span className={styles.searchQuery}>
                      "{searchQuery}" 검색 결과
                    </span>
                  )}
                </p>
              </div>

              {/* 뷰 모드 선택 */}
              <div className={styles.viewModeSelector}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`${styles.viewModeButton} ${styles.active}`}>
                  <svg
                    className={styles.viewModeIcon}
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
                <Button variant="ghost" size="sm" className={styles.viewModeButton}>
                  <svg
                    className={styles.viewModeIcon}
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

            {/* 할 일 목록 */}
            {searchFilteredTodos.length === 0 ? (
              <Card className={styles.emptyListCard}>
                <CardContent className={styles.emptyListContent}>
                  <div className={styles.emptyListIconContainer}>
                    <svg
                      className={styles.emptyListIcon}
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
                  <h3 className={styles.emptyListTitle}>
                    {searchQuery
                      ? "검색 결과가 없습니다"
                      : "할 일이 없습니다"}
                  </h3>
                  <p className={styles.emptyListDescription}>
                    {searchQuery
                      ? `"${searchQuery}"와 일치하는 할 일을 찾을 수 없습니다. 다른 키워드로 검색해보세요.`
                      : "새로운 할 일을 추가해서 생산성을 높여보세요!"}
                  </p>
                  {searchQuery && (
                    <Button
                      variant="outline"
                      onClick={() => setSearchQuery("")}
                      className={styles.resetSearchButton}
                    >
                      검색 초기화
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className={styles.todoGrid}>
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
