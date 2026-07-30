import { useCallback } from 'react';
import { useSupplyChainStore } from '../store/supply-chain-store';
import { Checkbox } from './ui/checkbox';

// HS 코드 필터 옵션
const HS_CODE_OPTIONS = [
    { value: '2530.90', label: '리튬 광석', hoverText: 'HS 2530.90', description: '리튬 광석 (Mine → Refinery)' },
    { value: '2836.91', label: '탄산리튬', hoverText: 'HS 2836.91', description: '탄산리튬 (Refinery → LFP Factory)' },
    { value: '2825.20', label: '수산화리튬', hoverText: 'HS 2825.20', description: '수산화리튬 (Refinery → NCM Factory)' },
] as const;

// 국가 필터 옵션
const COUNTRY_OPTIONS = [
    { value: 'SouthKorea', label: '한국' },
    { value: 'China', label: '중국' },
    { value: 'Chile', label: '칠레' },
    { value: 'UnitedStates', label: '미국' },
    { value: 'Japan', label: '일본' },
    { value: 'Argentina', label: '아르헨티나' },
    { value: 'Australia', label: '호주' },
] as const;

/**
 * 그래프 및 대시보드 필터 컨트롤 바.
 * - 품목명 (HS 코드) 다중 필터
 * - 국가별 다중 필터
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

    const handleCountryChange = useCallback(
        (country: string) => {
            const current = filters.countries;
            let next: string[];
            if (current.includes(country)) {
                // 이미 선택된 상태이면 해제 (단, 최소 1개는 활성화되어야 함)
                if (current.length > 1) {
                    next = current.filter((c) => c !== country);
                } else {
                    return; // 최소 1개 선택 유지
                }
            } else {
                next = [...current, country];
            }
            setFilters({ countries: next });
        },
        [filters.countries, setFilters],
    );

    return (
        <div
            className="flex flex-col gap-3 px-4 py-3 border-b border-border bg-card"
            role="toolbar"
            aria-label="공급망 필터 바"
        >
            {/* 품목 필터 */}
            <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs font-bold text-muted-foreground mr-2 w-12 shrink-0">품목명</span>
                <div className="flex items-center gap-4 flex-wrap">
                    {HS_CODE_OPTIONS.map(({ value, label, hoverText }) => {
                        const isActive = filters.hsCode.includes(value);
                        const id = `hs-code-${value}`;
                        return (
                            <div key={value} className="flex items-center gap-1.5" title={hoverText}>
                                <Checkbox
                                    id={id}
                                    checked={isActive}
                                    onCheckedChange={() => handleHsCodeChange(value)}
                                />
                                <label
                                    htmlFor={id}
                                    className="text-xs font-semibold text-foreground cursor-pointer select-none"
                                >
                                    {label}
                                </label>
                            </div>
                        );
                    })}
                </div>
                {filters.hsCode.length > 0 && (
                    <span className="text-xs text-muted-foreground ml-1">
                        — {filters.hsCode.map((val) => HS_CODE_OPTIONS.find((o) => o.value === val)?.description).join(', ')}
                    </span>
                )}
            </div>

            {/* 국가 필터 */}
            <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs font-bold text-muted-foreground mr-2 w-12 shrink-0">국가</span>
                <div className="flex items-center gap-4 flex-wrap">
                    {COUNTRY_OPTIONS.map(({ value, label }) => {
                        const isActive = filters.countries.includes(value);
                        const id = `country-${value}`;
                        return (
                            <div key={value} className="flex items-center gap-1.5">
                                <Checkbox
                                    id={id}
                                    checked={isActive}
                                    onCheckedChange={() => handleCountryChange(value)}
                                />
                                <label
                                    htmlFor={id}
                                    className="text-xs font-semibold text-foreground cursor-pointer select-none"
                                >
                                    {label}
                                </label>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
