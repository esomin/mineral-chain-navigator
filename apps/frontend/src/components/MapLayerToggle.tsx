import { useCallback } from 'react';

// 레이어 토글 상태 인터페이스
export interface MapLayerState {
    showNodeType: boolean;    // 노드 타입별 표시/숨김
    showRiskLevel: boolean;   // 리스크 레벨 색상 오버레이
    showTradeVolume: boolean; // 무역량 아크 표시
}

export interface MapLayerToggleProps {
    layerState: MapLayerState;
    onChange: (state: MapLayerState) => void;
}

/**
 * 지도 레이어 토글 플로팅 패널.
 * 노드 타입, 리스크 레벨, 무역량 레이어를 독립적으로 토글할 수 있다.
 */
export function MapLayerToggle({ layerState, onChange }: MapLayerToggleProps) {
    const handleToggle = useCallback(
        (key: keyof MapLayerState) => {
            onChange({ ...layerState, [key]: !layerState[key] });
        },
        [layerState, onChange],
    );

    return (
        <div
            style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                padding: '0.75rem',
                fontSize: '0.8rem',
                zIndex: 10,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                minWidth: '160px',
            }}
            role="group"
            aria-label="지도 레이어 토글"
        >
            <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: '#333' }}>
                레이어
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem', cursor: 'pointer' }}>
                <input
                    type="checkbox"
                    checked={layerState.showNodeType}
                    onChange={() => handleToggle('showNodeType')}
                    aria-label="노드 표시 토글"
                />
                <span>노드 타입</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem', cursor: 'pointer' }}>
                <input
                    type="checkbox"
                    checked={layerState.showRiskLevel}
                    onChange={() => handleToggle('showRiskLevel')}
                    aria-label="리스크 레벨 색상 토글"
                />
                <span>리스크 레벨</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                    type="checkbox"
                    checked={layerState.showTradeVolume}
                    onChange={() => handleToggle('showTradeVolume')}
                    aria-label="무역량 경로 토글"
                />
                <span>무역량 경로</span>
            </label>
        </div>
    );
}
