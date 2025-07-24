import { Card, CardContent } from '@/components/ui/card';
import type { TodoStats } from 'types/index';

interface TodoStatsProps {
  stats: TodoStats;
  className?: string;
}

export function TodoStatsComponent({ stats, className = '' }: TodoStatsProps) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${className}`}>
      {/* 전체 할 일 */}
      <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 hover:shadow-lg transition-all duration-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600 mb-1">전체 할 일</p>
              <p className="text-3xl font-bold text-blue-700">{stats.total}</p>
            </div>
            <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center">
              <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 진행 중 */}
      <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 hover:shadow-lg transition-all duration-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-600 mb-1">진행 중</p>
              <p className="text-3xl font-bold text-orange-700">{stats.active}</p>
            </div>
            <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center">
              <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 완료됨 */}
      <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 hover:shadow-lg transition-all duration-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600 mb-1">완료됨</p>
              <p className="text-3xl font-bold text-green-700">{stats.completed}</p>
            </div>
            <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center">
              <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 완료율 */}
      <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 hover:shadow-lg transition-all duration-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600 mb-1">완료율</p>
              <p className="text-3xl font-bold text-purple-700">{stats.completionRate}%</p>
            </div>
            <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center">
              <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* 프로그레스 바 컴포넌트 */
export function TodoProgressBar({ stats, className = '' }: TodoStatsProps) {
  return (
    <Card className={`bg-gradient-to-r from-gray-50 to-gray-100 ${className}`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">전체 진행 상황</h3>
          <span className="text-2xl font-bold text-gray-700">{stats.completionRate}%</span>
        </div>
        
        <div className="space-y-3">
          {/* 메인 프로그레스 바 */}
          <div className="relative w-full h-6 bg-gray-200 rounded-full overflow-hidden shadow-inner">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-green-500 rounded-full transition-all duration-1000 ease-out shadow-sm"
              style={{ width: `${stats.completionRate}%` }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-full"></div>
          </div>
          
          {/* 상세 진행률 표시 */}
          <div className="flex justify-between text-sm text-gray-600">
            <span className="flex items-center">
              <div className="w-3 h-3 bg-orange-400 rounded-full mr-2"></div>
              진행중 {stats.active}개
            </span>
            <span className="flex items-center">
              <div className="w-3 h-3 bg-green-400 rounded-full mr-2"></div>
              완료 {stats.completed}개
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* 모바일용 간단한 통계 */
export function TodoStatsCard({ stats, className = '' }: TodoStatsProps) {
  return (
    <Card className={`md:hidden ${className}`}>
      <CardContent className="p-4">
        <div className="flex justify-between items-center text-sm">
          <div className="text-center">
            <div className="text-lg font-bold text-blue-600">{stats.total}</div>
            <div className="text-gray-600">전체</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-orange-600">{stats.active}</div>
            <div className="text-gray-600">진행중</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-green-600">{stats.completed}</div>
            <div className="text-gray-600">완료</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-purple-600">{stats.completionRate}%</div>
            <div className="text-gray-600">완료율</div>
          </div>
        </div>
        
        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${stats.completionRate}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 