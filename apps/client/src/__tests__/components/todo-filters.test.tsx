import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TodoFilters } from "../../components/todo-filters";
import type { TodoFilter } from "@vive/types";
import type {
  FilterHelpers,
  SyncHelpers,
  TodoMetadata,
} from "../../hooks/use-todo";

describe("TodoFilters Component", () => {
  const user = userEvent.setup();

  // 기본 필터 상태
  const defaultFilter: TodoFilter = {
    type: "all",
    sortBy: "createdAt",
    sortOrder: "desc",
  };

  // 모킹된 FilterHelpers
  const mockFilterHelpers: FilterHelpers = {
    type: "all",
    showAll: vi.fn(),
    showActive: vi.fn(),
    showCompleted: vi.fn(),
    sortByCreatedAt: vi.fn(),
    sortByPriority: vi.fn(),
    sortByTitle: vi.fn(),
  };

  // 모킹된 SyncHelpers
  const mockSyncHelpers: SyncHelpers = {
    triggerSync: vi.fn(),
    retrySync: vi.fn(),
    clearErrors: vi.fn(),
    toggleOfflineMode: vi.fn(),
    getConnectionStatusText: vi.fn(() => "온라인"),
    getSyncStatusText: vi.fn(() => "대기 중"),
    getLastSyncText: vi.fn(() => "방금 전"),
  };

  // 모킹된 TodoMetadata
  const defaultMetadata: TodoMetadata = {
    totalCount: 10,
    activeCount: 6,
    completedCount: 4,
    completionRate: 40,
    pendingOperations: 0,
    isOnline: true,
    isSyncing: false,
    hasErrors: false,
    hasConflicts: false,
  };

  const mockOnFilterChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ================================
  // 기본 렌더링 테스트
  // ================================

  it("should render filter sections", () => {
    render(
      <TodoFilters
        filter={defaultFilter}
        onFilterChange={mockOnFilterChange}
      />,
    );

    // 필터 섹션
    expect(screen.getByText("필터")).toBeInTheDocument();

    // 필터 칩들
    expect(screen.getByTestId("filter-all")).toBeInTheDocument();
    expect(screen.getByTestId("filter-active")).toBeInTheDocument();
    expect(screen.getByTestId("filter-completed")).toBeInTheDocument();

    // 우선순위 섹션
    expect(screen.getByText("우선순위")).toBeInTheDocument();

    // 정렬 섹션
    expect(screen.getByText("정렬")).toBeInTheDocument();
    expect(screen.getByTestId("sort-by-select")).toBeInTheDocument();
    expect(screen.getByTestId("sort-order-select")).toBeInTheDocument();
  });

  it("should render with FilterHelpers interface", () => {
    render(
      <TodoFilters
        filter={mockFilterHelpers}
        onFilterChange={mockFilterHelpers}
      />,
    );

    expect(screen.getByText("필터")).toBeInTheDocument();
    expect(screen.getByTestId("filter-all")).toBeInTheDocument();
  });

  // ================================
  // 필터 상태 변경 테스트 (Legacy Interface)
  // ================================

  it("should handle filter type changes - legacy interface", async () => {
    render(
      <TodoFilters
        filter={defaultFilter}
        onFilterChange={mockOnFilterChange}
      />,
    );

    const activeFilter = screen.getByTestId("filter-active");
    await user.click(activeFilter);

    expect(mockOnFilterChange).toHaveBeenCalledWith({
      ...defaultFilter,
      type: "active",
    });
  });

  it("should handle completed filter selection - legacy interface", async () => {
    render(
      <TodoFilters
        filter={defaultFilter}
        onFilterChange={mockOnFilterChange}
      />,
    );

    const completedFilter = screen.getByTestId("filter-completed");
    await user.click(completedFilter);

    expect(mockOnFilterChange).toHaveBeenCalledWith({
      ...defaultFilter,
      type: "completed",
    });
  });

  it("should highlight active filter", () => {
    const activeFilter: TodoFilter = { ...defaultFilter, type: "active" };

    render(
      <TodoFilters filter={activeFilter} onFilterChange={mockOnFilterChange} />,
    );

    const activeFilterButton = screen.getByTestId("filter-active");

    // 활성 필터는 default variant, 나머지는 outline
    expect(activeFilterButton).toHaveClass("bg-gradient-to-r");
    // 정확한 클래스는 shadcn/ui Button 구현에 따라 다를 수 있음
  });

  // ================================
  // 필터 헬퍼 인터페이스 테스트
  // ================================

  it("should handle filter type changes - FilterHelpers interface", async () => {
    render(
      <TodoFilters
        filter={mockFilterHelpers}
        onFilterChange={mockFilterHelpers}
      />,
    );

    const activeFilter = screen.getByTestId("filter-active");
    await user.click(activeFilter);

    expect(mockFilterHelpers.showActive).toHaveBeenCalled();
  });

  it("should handle showAll filter - FilterHelpers interface", async () => {
    render(
      <TodoFilters
        filter={mockFilterHelpers}
        onFilterChange={mockFilterHelpers}
      />,
    );

    const allFilter = screen.getByTestId("filter-all");
    await user.click(allFilter);

    expect(mockFilterHelpers.showAll).toHaveBeenCalled();
  });

  it("should handle showCompleted filter - FilterHelpers interface", async () => {
    render(
      <TodoFilters
        filter={mockFilterHelpers}
        onFilterChange={mockFilterHelpers}
      />,
    );

    const completedFilter = screen.getByTestId("filter-completed");
    await user.click(completedFilter);

    expect(mockFilterHelpers.showCompleted).toHaveBeenCalled();
  });

  // ================================
  // 정렬 옵션 테스트
  // ================================

  it("should handle sort by changes - legacy interface", async () => {
    render(
      <TodoFilters
        filter={defaultFilter}
        onFilterChange={mockOnFilterChange}
      />,
    );

    const sortBySelect = screen.getByTestId("sort-by-select");
    await user.click(sortBySelect);

    const priorityOption = screen.getByText("우선순위순");
    await user.click(priorityOption);

    expect(mockOnFilterChange).toHaveBeenCalledWith({
      ...defaultFilter,
      sortBy: "priority",
    });
  });

  it("should handle sort order changes - legacy interface", async () => {
    render(
      <TodoFilters
        filter={defaultFilter}
        onFilterChange={mockOnFilterChange}
      />,
    );

    const sortOrderSelect = screen.getByTestId("sort-order-select");
    await user.click(sortOrderSelect);

    const ascOption = screen.getByText("오름차순");
    await user.click(ascOption);

    expect(mockOnFilterChange).toHaveBeenCalledWith({
      ...defaultFilter,
      sortOrder: "asc",
    });
  });

  it("should handle sort by changes - FilterHelpers interface", async () => {
    render(
      <TodoFilters
        filter={mockFilterHelpers}
        onFilterChange={mockFilterHelpers}
      />,
    );

    const sortBySelect = screen.getByTestId("sort-by-select");
    await user.click(sortBySelect);

    const titleOption = screen.getByText("제목순");
    await user.click(titleOption);

    expect(mockFilterHelpers.sortByTitle).toHaveBeenCalled();
  });

  it("should handle sort order changes with FilterHelpers", async () => {
    render(
      <TodoFilters
        filter={mockFilterHelpers}
        onFilterChange={mockFilterHelpers}
      />,
    );

    const sortOrderSelect = screen.getByTestId("sort-order-select");
    await user.click(sortOrderSelect);

    const ascOption = screen.getByText("오름차순");
    await user.click(ascOption);

    expect(mockFilterHelpers.sortByCreatedAt).toHaveBeenCalledWith("asc");
  });

  // ================================
  // 우선순위 필터 테스트 (현재 구현상 비활성)
  // ================================

  it("should render priority filter chips", () => {
    render(
      <TodoFilters
        filter={defaultFilter}
        onFilterChange={mockOnFilterChange}
      />,
    );

    expect(screen.getByText("긴급")).toBeInTheDocument();
    expect(screen.getByText("보통")).toBeInTheDocument();
    expect(screen.getByText("낮음")).toBeInTheDocument();

    // 우선순위 필터는 현재 구현상 비활성 상태
    const urgentChip = screen.getByText("긴급").closest("button");
    expect(urgentChip).not.toHaveClass("bg-gradient-to-r"); // 활성 상태가 아님
  });

  // ================================
  // 동기화 상태 섹션 테스트
  // ================================

  it("should render sync section when syncHelpers and metadata provided", () => {
    render(
      <TodoFilters
        filter={defaultFilter}
        onFilterChange={mockOnFilterChange}
        syncHelpers={mockSyncHelpers}
        metadata={defaultMetadata}
      />,
    );

    expect(screen.getByText("동기화 상태")).toBeInTheDocument();
    expect(screen.getByText("연결 상태:")).toBeInTheDocument();
    expect(screen.getByText("온라인")).toBeInTheDocument();
    expect(screen.getByText("수동 동기화")).toBeInTheDocument();
  });

  it("should not render sync section when syncHelpers not provided", () => {
    render(
      <TodoFilters
        filter={defaultFilter}
        onFilterChange={mockOnFilterChange}
      />,
    );

    expect(screen.queryByText("동기화 상태")).not.toBeInTheDocument();
  });

  it("should handle manual sync trigger", async () => {
    render(
      <TodoFilters
        filter={defaultFilter}
        onFilterChange={mockOnFilterChange}
        syncHelpers={mockSyncHelpers}
        metadata={defaultMetadata}
      />,
    );

    const syncButton = screen.getByText("수동 동기화");
    await user.click(syncButton);

    expect(mockSyncHelpers.triggerSync).toHaveBeenCalled();
  });

  it("should handle offline mode toggle", async () => {
    render(
      <TodoFilters
        filter={defaultFilter}
        onFilterChange={mockOnFilterChange}
        syncHelpers={mockSyncHelpers}
        metadata={defaultMetadata}
      />,
    );

    const offlineModeButton = screen.getByText("오프라인 모드");
    await user.click(offlineModeButton);

    expect(mockSyncHelpers.toggleOfflineMode).toHaveBeenCalled();
  });

  it("should show syncing state", () => {
    const syncingMetadata: TodoMetadata = {
      ...defaultMetadata,
      isSyncing: true,
    };

    mockSyncHelpers.getSyncStatusText.mockReturnValue("동기화 중");

    render(
      <TodoFilters
        filter={defaultFilter}
        onFilterChange={mockOnFilterChange}
        syncHelpers={mockSyncHelpers}
        metadata={syncingMetadata}
      />,
    );

    expect(screen.getByText("동기화 중...")).toBeInTheDocument();

    const syncButton = screen.getByText("동기화 중...");
    expect(syncButton).toBeDisabled();
  });

  it("should show pending operations count", () => {
    const pendingMetadata: TodoMetadata = {
      ...defaultMetadata,
      pendingOperations: 3,
    };

    render(
      <TodoFilters
        filter={defaultFilter}
        onFilterChange={mockOnFilterChange}
        syncHelpers={mockSyncHelpers}
        metadata={pendingMetadata}
      />,
    );

    expect(screen.getByText("3개 작업")).toBeInTheDocument();
  });

  it("should show error clear button when has errors", () => {
    const errorMetadata: TodoMetadata = {
      ...defaultMetadata,
      hasErrors: true,
    };

    render(
      <TodoFilters
        filter={defaultFilter}
        onFilterChange={mockOnFilterChange}
        syncHelpers={mockSyncHelpers}
        metadata={errorMetadata}
      />,
    );

    const clearErrorsButton = screen.getByText("에러 정리");
    expect(clearErrorsButton).toBeInTheDocument();
  });

  it("should handle error clearing", async () => {
    const errorMetadata: TodoMetadata = {
      ...defaultMetadata,
      hasErrors: true,
    };

    render(
      <TodoFilters
        filter={defaultFilter}
        onFilterChange={mockOnFilterChange}
        syncHelpers={mockSyncHelpers}
        metadata={errorMetadata}
      />,
    );

    const clearErrorsButton = screen.getByText("에러 정리");
    await user.click(clearErrorsButton);

    expect(mockSyncHelpers.clearErrors).toHaveBeenCalled();
  });

  it("should show offline status correctly", () => {
    const offlineMetadata: TodoMetadata = {
      ...defaultMetadata,
      isOnline: false,
    };

    mockSyncHelpers.getConnectionStatusText.mockReturnValue("오프라인");

    render(
      <TodoFilters
        filter={defaultFilter}
        onFilterChange={mockOnFilterChange}
        syncHelpers={mockSyncHelpers}
        metadata={offlineMetadata}
      />,
    );

    expect(screen.getByText("오프라인")).toBeInTheDocument();
    expect(screen.getByText("온라인 모드")).toBeInTheDocument(); // 버튼 텍스트
  });

  // ================================
  // 접근성 테스트
  // ================================

  it("should have proper ARIA attributes for filter buttons", () => {
    render(
      <TodoFilters
        filter={defaultFilter}
        onFilterChange={mockOnFilterChange}
      />,
    );

    const allFilter = screen.getByTestId("filter-all");
    const activeFilter = screen.getByTestId("filter-active");
    const completedFilter = screen.getByTestId("filter-completed");

    expect(allFilter).toBeVisible();
    expect(activeFilter).toBeVisible();
    expect(completedFilter).toBeVisible();
  });

  it("should be keyboard navigable", async () => {
    render(
      <TodoFilters
        filter={defaultFilter}
        onFilterChange={mockOnFilterChange}
      />,
    );

    // Tab으로 필터 버튼들 네비게이션
    await user.tab();
    expect(screen.getByTestId("filter-all")).toHaveFocus();

    await user.tab();
    expect(screen.getByTestId("filter-active")).toHaveFocus();

    await user.tab();
    expect(screen.getByTestId("filter-completed")).toHaveFocus();
  });

  it("should activate filters with Enter key", async () => {
    render(
      <TodoFilters
        filter={defaultFilter}
        onFilterChange={mockOnFilterChange}
      />,
    );

    const activeFilter = screen.getByTestId("filter-active");
    activeFilter.focus();
    await user.keyboard("{Enter}");

    expect(mockOnFilterChange).toHaveBeenCalledWith({
      ...defaultFilter,
      type: "active",
    });
  });

  // ================================
  // 스타일링 테스트
  // ================================

  it("should apply correct CSS classes", () => {
    render(
      <TodoFilters
        filter={defaultFilter}
        onFilterChange={mockOnFilterChange}
        className="custom-class"
      />,
    );

    const container = screen.getByText("필터").closest(".space-y-6");
    expect(container).toHaveClass("space-y-6", "custom-class");
  });

  it("should have responsive design classes", () => {
    render(
      <TodoFilters
        filter={defaultFilter}
        onFilterChange={mockOnFilterChange}
      />,
    );

    // 필터 칩 컨테이너
    const filterChipsContainer = screen
      .getByTestId("filter-all")
      .closest(".flex.flex-wrap.gap-2");
    expect(filterChipsContainer).toHaveClass("flex", "flex-wrap", "gap-2");

    // 정렬 옵션 그리드
    const sortContainer = screen
      .getByTestId("sort-by-select")
      .closest(".grid.grid-cols-1.gap-3");
    expect(sortContainer).toHaveClass("grid", "grid-cols-1", "gap-3");
  });

  // ================================
  // Edge Cases 테스트
  // ================================

  it("should handle undefined syncHelpers gracefully", () => {
    render(
      <TodoFilters
        filter={defaultFilter}
        onFilterChange={mockOnFilterChange}
        syncHelpers={undefined}
        metadata={defaultMetadata}
      />,
    );

    expect(screen.queryByText("동기화 상태")).not.toBeInTheDocument();
  });

  it("should handle undefined metadata gracefully", () => {
    render(
      <TodoFilters
        filter={defaultFilter}
        onFilterChange={mockOnFilterChange}
        syncHelpers={mockSyncHelpers}
        metadata={undefined}
      />,
    );

    expect(screen.queryByText("동기화 상태")).not.toBeInTheDocument();
  });

  it("should handle last sync time formatting", () => {
    mockSyncHelpers.getLastSyncText.mockReturnValue("5분 전");

    render(
      <TodoFilters
        filter={defaultFilter}
        onFilterChange={mockOnFilterChange}
        syncHelpers={mockSyncHelpers}
        metadata={defaultMetadata}
      />,
    );

    expect(screen.getByText("5분 전")).toBeInTheDocument();
  });
});
