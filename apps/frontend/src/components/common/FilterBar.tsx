import { useCallback } from 'react';
import { useSupplyChainStore } from '../../store/supply-chain-store';
import { Checkbox } from '../ui/checkbox';

// HS 코드 필터 옵션
const HS_CODE_OPTIONS = [
    {
        value: '2530.90',
        label: '리튬 광석',
        badges: [
            { text: '광산→정제소 원료', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
        ],
        description: '리튬 광석 (2530.90): 광산 → 정제소 이동 원료',
    },
    {
        value: '2836.91',
        label: '탄산리튬',
        badges: [
            { text: '염호→정제소 원료', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
            { text: 'LFP계 양극재 원료', color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' },
        ],
        description: '탄산리튬 (2836.91): 염호 직조달 및 정제소 → LFP 양극재 공장 납품',
    },
    {
        value: '2825.20',
        label: '수산화리튬',
        badges: [
            { text: '삼원계 양극재 원료', color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' },
        ],
        description: '수산화리튬 (2825.20): 정제소 → 삼원계(NCM/NCA) 하이니켈 공장 납품',
    },
] as const;

// 국가 필터 옵션
const COUNTRY_OPTIONS = [
    { value: 'SouthKorea', label: '한국' },
    { value: 'China', label: '중국' },
    { value: 'Chile', label: '칠레' },
    { value: 'Argentina', label: '아르헨티나' },
    { value: 'Australia', label: '호주' },
    { value: 'Poland', label: '폴란드' },
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
                <div className="flex items-center gap-5 flex-wrap">
                    {HS_CODE_OPTIONS.map(({ value, label, badges, description }) => {
                        const isActive = filters.hsCode.includes(value);
                        const id = `hs-code-${value}`;
                        return (
                            <div
                                key={value}
                                className="flex items-center gap-1.5 group relative"
                                title={description}
                            >
                                <Checkbox
                                    id={id}
                                    checked={isActive}
                                    onCheckedChange={() => handleHsCodeChange(value)}
                                />
                                <label
                                    htmlFor={id}
                                    className="text-xs font-semibold text-foreground cursor-pointer select-none flex items-center gap-1.5"
                                >
                                    <span>{label}</span>
                                    {badges.map((b, idx) => (
                                        <span
                                            key={idx}
                                            className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${b.color}`}
                                        >
                                            {b.text}
                                        </span>
                                    ))}
                                </label>
                            </div>
                        );
                    })}
                </div>
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
