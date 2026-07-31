import { useNavigate } from 'react-router-dom';
import { useCallback } from 'react';

export interface ViewSwitcherProps {
    currentView: 'graph' | 'map' | 'globe';
}

/**
 * 그래프 뷰 / 지도 뷰 / 지구본 뷰 전환 스위처.
 * 헤더 영역에 위치하며, 현재 활성 뷰를 시각적으로 표시한다.
 */
export function ViewSwitcher({ currentView }: ViewSwitcherProps) {
    const navigate = useNavigate();

    const handleSwitch = useCallback(
        (view: 'graph' | 'map' | 'globe') => {
            if (view === currentView) return;
            if (view === 'graph') navigate('/');
            else if (view === 'map') navigate('/map');
            else navigate('/globe');
        },
        [currentView, navigate],
    );

    return (
        <div
            className="inline-flex rounded overflow-hidden shadow-sm"
            role="tablist"
            aria-label="뷰 전환"
        >
            <button
                onClick={() => handleSwitch('graph')}
                role="tab"
                aria-selected={currentView === 'graph'}
                className={`px-3 py-1.5 text-xs outline-none border border-gray-300 rounded-l ${currentView === 'graph'
                    ? 'bg-blue-500 !text-white font-bold !border-blue-500 cursor-default'
                    : 'bg-white text-gray-700 cursor-pointer hover:bg-gray-100'
                    }`}
            >
                그래프
            </button>
            <button
                onClick={() => handleSwitch('map')}
                role="tab"
                aria-selected={currentView === 'map'}
                className={`px-3 py-1.5 text-xs outline-none border border-gray-300 border-l-0 ${currentView === 'map'
                    ? 'bg-blue-500 !text-white font-bold !border-blue-500 cursor-default'
                    : 'bg-white text-gray-700 cursor-pointer hover:bg-gray-100'
                    }`}
            >
                지도
            </button>
            <button
                onClick={() => handleSwitch('globe')}
                role="tab"
                aria-selected={currentView === 'globe'}
                className={`px-3 py-1.5 text-xs outline-none border border-gray-300 border-l-0 rounded-r ${currentView === 'globe'
                    ? 'bg-blue-500 !text-white font-bold !border-blue-500 cursor-default'
                    : 'bg-white text-gray-700 cursor-pointer hover:bg-gray-100'
                    }`}
            >
                지구본
            </button>
        </div>
    );
}
