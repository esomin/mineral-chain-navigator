import { ReactNode } from 'react';
import { Cuboid } from 'lucide-react';
import { ViewSwitcher } from './ViewSwitcher';

export interface AppHeaderProps {
    currentView: 'graph' | 'map';
    actions?: ReactNode;
}

/**
 * 공통 상단 헤더 컴포넌트.
 * 로고, 애플리케이션 타이틀, 타이틀 우측 액션 버튼(충격 시뮬레이션), 뷰 전환 네비게이션을 제공한다.
 */
export function AppHeader({
    currentView,
    actions,
}: AppHeaderProps) {
    return (
        <header className="px-6 border-b border-border bg-card flex items-center justify-between h-16 min-h-[64px] select-none">
            {/* 좌측 로고, 타이틀 및 액션 버튼(충격 시뮬레이션) 영역 */}
            <div className="flex items-center gap-5">
                <div className="flex items-center gap-3.5">
                    <Cuboid size={34} strokeWidth={2.5} className="text-foreground shrink-0" />
                    <h1 className="m-0 text-[24px] font-bold text-foreground tracking-tight">
                        Lithium Supply Chain Navigator
                    </h1>
                </div>
                {actions && (
                    <div className="flex items-center pl-1">
                        {actions}
                    </div>
                )}
            </div>

            {/* 우측 네비게이션 영역 */}
            <div className="flex items-center h-full">
                <ViewSwitcher currentView={currentView} />
            </div>
        </header>
    );
}
