import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { TodoFilter, FilterType, SortBy, SortOrder } from 'types/index';

interface TodoFiltersProps {
  filter: TodoFilter;
  onFilterChange: (filter: TodoFilter) => void;
  className?: string;
}

export function TodoFilters({ filter, onFilterChange, className = '' }: TodoFiltersProps) {
  const handleFilterTypeChange = (type: FilterType) => {
    onFilterChange({ ...filter, type });
  };

  const handleSortByChange = (sortBy: SortBy) => {
    onFilterChange({ ...filter, sortBy });
  };

  const handleSortOrderChange = (sortOrder: SortOrder) => {
    onFilterChange({ ...filter, sortOrder });
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 필터 버튼들 */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-700">필터</h3>
        <div className="flex flex-col gap-2">
          <Button
            variant={filter.type === 'all' ? 'default' : 'outline'}
            onClick={() => handleFilterTypeChange('all')}
            className="justify-start"
          >
            전체 보기
          </Button>
          <Button
            variant={filter.type === 'active' ? 'default' : 'outline'}
            onClick={() => handleFilterTypeChange('active')}
            className="justify-start"
          >
            진행 중
          </Button>
          <Button
            variant={filter.type === 'completed' ? 'default' : 'outline'}
            onClick={() => handleFilterTypeChange('completed')}
            className="justify-start"
          >
            완료됨
          </Button>
        </div>
      </div>

      {/* 정렬 옵션 */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-700">정렬 옵션</h3>
        <div className="space-y-2">
          <Select value={filter.sortBy} onValueChange={handleSortByChange}>
            <SelectTrigger>
              <SelectValue placeholder="정렬 기준" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="createdAt">생성일순</SelectItem>
              <SelectItem value="priority">우선순위순</SelectItem>
              <SelectItem value="title">제목순</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={filter.sortOrder} onValueChange={handleSortOrderChange}>
            <SelectTrigger>
              <SelectValue placeholder="정렬 순서" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">내림차순</SelectItem>
              <SelectItem value="asc">오름차순</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
} 