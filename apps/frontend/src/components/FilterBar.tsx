import { useCallback } from 'react';
import { useSupplyChainStore } from '../store/supply-chain-store';
import type { HsCodeFilter } from '../store/supply-chain-store';

// HS 코드 필터 옵션
const HS_CODE_OPTIONS: { value: string; label: string; hoverText: string; description: string }[] = [
    { value: '2530.90', label: '리튬 광석', hoverText: 'HS 2530.90', description: '리튬 광석 (Mine → Refinery)' },
    { value: '2836.91', label: '탄산리튬', hoverText: 'HS 2836.91', description: '탄산리튬 (Refinery → LFP Factory)' },
    { value: '2825.20', label: '수산화리튬', hoverText: 'HS 2825.20', description: '수산화리튬 (Refinery → NCM Factory)' },
];

/**
 * 그래프 필터 컨트롤 바.
 * HS 코드 필터만 제공한다 — 공급망 물질 계층(material layer)을 전환하는 핵심 필터.
 */
export function FilterBar() {
    const { filters, setFilters } = useSupplyChainStore();

    const handleHsCodeChange = useCallback(
        (hsCode: string) => {
            const current = filters.hsCode;
            let next: string[];
            if (current.includes(hsCode)) {
                // 이미 선택된 상태이면 해제 (단, 최소 1개는 활성화되어야 함)
                if (current.length > 1) {
                    next = current.filter((c) => c !== hsCode);
                } else {
                    return; // 최소 1개 선택 유지
                }
            } else {
                next = [...current, hsCode];
            }
            setFilters({ hsCode: next });
        },
        [filters.hsCode, setFilters],
    );

    return (
        <div
            className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 bg-gray-50 flex-wrap"
            role="toolbar"
            aria-label="HS 코드 필터"
        >
            <span className="text-xs font-bold text-gray-500 mr-1">품목명</span>
            {HS_CODE_OPTIONS.map(({ value, label, hoverText }) => {
                const isActive = filters.hsCode.includes(value);
                return (
                    <button
                        key={value}
                        onClick={() => handleHsCodeChange(value)}
                        aria-pressed={isActive}
                        title={hoverText}
                        className={`px-3 py-1 rounded text-xs border transition-colors cursor-pointer ${isActive
                                ? 'border-blue-300 bg-blue-50 text-blue-600 font-medium'
                                : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-100'
                            }`}
                    >
                        {label}
                    </button>
                );
            })}
            {filters.hsCode.length > 0 && (
                <span className="text-xs text-gray-400 ml-1">
                    — {filters.hsCode.map((val) => HS_CODE_OPTIONS.find((o) => o.value === val)?.description).join(', ')}
                </span>
            )}
        </div>
    );
}
