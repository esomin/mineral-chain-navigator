import { useNavigate } from 'react-router-dom';
import { useCallback } from 'react';

export interface ViewSwitcherProps {
    currentView: 'graph' | 'map';
}

/**
 * 상단 헤더 네비게이션 바.
 * 영문 표기(Graph / 2D Map) 및 확장된 폰트 사이즈(text-base) 적용.
 */
export function ViewSwitcher({ currentView }: ViewSwitcherProps) {
    const navigate = useNavigate();

    const handleSwitch = useCallback(
        (view: 'graph' | 'map') => {
            if (view === currentView) return;
            if (view === 'graph') navigate('/');
            else if (view === 'map') navigate('/map');
        },
        [currentView, navigate],
    );

    return (
        <nav
            className="h-full flex items-center gap-2"
            role="navigation"
            aria-label="메인 네비게이션"
        >
            <button
                onClick={() => handleSwitch('graph')}
                aria-current={currentView === 'graph' ? 'page' : undefined}
                className={`h-full flex items-center justify-center min-w-[200px] px-6 text-base tracking-wide transition-colors cursor-pointer border-b-2 -mb-[1px] ${
                    currentView === 'graph'
                        ? 'text-primary font-bold border-primary'
                        : 'text-muted-foreground hover:text-foreground font-medium border-transparent'
                }`}
            >
                Graph
            </button>
            <button
                onClick={() => handleSwitch('map')}
                aria-current={currentView === 'map' ? 'page' : undefined}
                className={`h-full flex items-center justify-center min-w-[200px] px-6 text-base tracking-wide transition-colors cursor-pointer border-b-2 -mb-[1px] ${
                    currentView === 'map'
                        ? 'text-primary font-bold border-primary'
                        : 'text-muted-foreground hover:text-foreground font-medium border-transparent'
                }`}
            >
                2D Map
            </button>
        </nav>
    );
}
