import { useNavigate } from 'react-router-dom';
import { useCallback } from 'react';

export interface ViewSwitcherProps {
    currentView: 'graph' | 'map';
}

/**
 * 그래프 뷰 / 지도 뷰 전환 스위처.
 * 헤더 영역에 위치하며, 현재 활성 뷰를 시각적으로 표시한다.
 */
export function ViewSwitcher({ currentView }: ViewSwitcherProps) {
    const navigate = useNavigate();

    const handleSwitch = useCallback(
        (view: 'graph' | 'map') => {
            if (view === currentView) return;
            navigate(view === 'graph' ? '/' : '/map');
        },
        [currentView, navigate],
    );

    return (
        <div
            style={{
                display: 'flex',
                gap: 0,
                border: '1px solid #d9d9d9',
                borderRadius: '4px',
                overflow: 'hidden',
            }}
            role="tablist"
            aria-label="뷰 전환"
        >
            <button
                onClick={() => handleSwitch('graph')}
                role="tab"
                aria-selected={currentView === 'graph'}
                style={{
                    padding: '4px 12px',
                    fontSize: '0.8rem',
                    border: 'none',
                    cursor: currentView === 'graph' ? 'default' : 'pointer',
                    background: currentView === 'graph' ? '#1890ff' : '#fff',
                    color: currentView === 'graph' ? '#fff' : '#333',
                    fontWeight: currentView === 'graph' ? 'bold' : 'normal',
                }}
            >
                그래프
            </button>
            <button
                onClick={() => handleSwitch('map')}
                role="tab"
                aria-selected={currentView === 'map'}
                style={{
                    padding: '4px 12px',
                    fontSize: '0.8rem',
                    border: 'none',
                    borderLeft: '1px solid #d9d9d9',
                    cursor: currentView === 'map' ? 'default' : 'pointer',
                    background: currentView === 'map' ? '#1890ff' : '#fff',
                    color: currentView === 'map' ? '#fff' : '#333',
                    fontWeight: currentView === 'map' ? 'bold' : 'normal',
                }}
            >
                지도
            </button>
        </div>
    );
}
