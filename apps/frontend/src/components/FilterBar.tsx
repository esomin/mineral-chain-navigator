import { useCallback } from 'react';
import type { NodeType, Country } from '@navigator/shared';
import { useSupplyChainStore } from '../store/supply-chain-store';
import type { HsCodeFilter } from '../store/supply-chain-store';
import { getCountryDisplayName } from '../utils/graph-helpers';

// 필터 가능한 노드 타입 목록
const NODE_TYPES: NodeType[] = ['Resource', 'Mine', 'Refinery', 'Factory'];

// 필터 가능한 국가 목록 (N/A 제외, 7개국 전체)
const COUNTRIES: Country[] = ['SouthKorea', 'Japan', 'China', 'Chile', 'UnitedStates', 'Australia', 'Argentina'];

// 리스크 레벨 옵션
const RISK_LEVELS = [
    { value: 'all', label: '전체' },
    { value: 'low', label: '저위험 (0-33)' },
    { value: 'medium', label: '중위험 (34-66)' },
    { value: 'high', label: '고위험 (67-100)' },
] as const;

// HS 코드 필터 옵션
const HS_CODE_OPTIONS: { value: HsCodeFilter; label: string }[] = [
    { value: 'all', label: '전체' },
    { value: '2530.90', label: 'HS 2530.90' },
    { value: '2836.91', label: 'HS 2836.91' },
    { value: '2825.20', label: 'HS 2825.20' },
];

// 노드 타입 한글 라벨
const NODE_TYPE_LABELS: Record<NodeType, string> = {
    Resource: '자원',
    Mine: '광산',
    Refinery: '제련소',
    Factory: '공장',
};

// 태그 버튼 공통 스타일
const getTagStyle = (isActive: boolean): React.CSSProperties => ({
    padding: '2px 8px',
    borderRadius: '3px',
    border: isActive ? '1px solid #91d5ff' : '1px solid #d9d9d9',
    background: isActive ? '#e6f7ff' : '#fff',
    cursor: 'pointer',
    fontSize: '0.75rem',
    color: isActive ? '#1890ff' : '#333',
});

/**
 * 그래프 필터 컨트롤 바.
 * 노드 타입, 국가, 리스크 레벨 필터를 제공한다.
 * 필터 변경 시 Zustand 스토어를 통해 즉시 반영된다.
 */
export function FilterBar() {
    const { filters, setFilters } = useSupplyChainStore();

    // 노드 타입 '전체' 선택 여부 (빈 배열 = 전체)
    const isAllNodeTypes = filters.nodeTypes.length === 0;

    // 국가 '전체' 선택 여부 (빈 배열 = 전체)
    const isAllCountries = filters.countries.length === 0;

    // 노드 타입 토글 핸들러 (복수 선택)
    const handleNodeTypeToggle = useCallback(
        (type: NodeType) => {
            const current = filters.nodeTypes;
            const updated = current.includes(type)
                ? current.filter((t) => t !== type)
                : [...current, type];
            setFilters({ nodeTypes: updated });
        },
        [filters.nodeTypes, setFilters],
    );

    // 노드 타입 전체 선택 핸들러
    const handleNodeTypeAll = useCallback(() => {
        setFilters({ nodeTypes: [] });
    }, [setFilters]);

    // 국가 토글 핸들러 (복수 선택)
    const handleCountryToggle = useCallback(
        (country: Country) => {
            const current = filters.countries;
            const updated = current.includes(country)
                ? current.filter((c) => c !== country)
                : [...current, country];
            setFilters({ countries: updated });
        },
        [filters.countries, setFilters],
    );

    // 국가 전체 선택 핸들러
    const handleCountryAll = useCallback(() => {
        setFilters({ countries: [] });
    }, [setFilters]);

    // 리스크 레벨 변경 핸들러
    const handleRiskLevelChange = useCallback(
        (level: 'all' | 'low' | 'medium' | 'high') => {
            setFilters({ riskLevel: level });
        },
        [setFilters],
    );

    // HS 코드 필터 변경 핸들러
    const handleHsCodeChange = useCallback(
        (hsCode: HsCodeFilter) => {
            setFilters({ hsCode });
        },
        [setFilters],
    );

    return (
        <div
            style={{
                display: 'flex',
                gap: '1.5rem',
                padding: '0.5rem 1rem',
                borderBottom: '1px solid #e0e0e0',
                background: '#fafafa',
                flexWrap: 'wrap',
                alignItems: 'center',
                fontSize: '0.8rem',
            }}
            role="toolbar"
            aria-label="그래프 필터 컨트롤"
        >
            {/* 노드 타입 필터 - 태그 버튼 (복수 선택) */}
            <fieldset
                style={{
                    border: 'none',
                    padding: 0,
                    margin: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                }}
            >
                <legend
                    style={{
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        color: '#555',
                        float: 'left',
                        marginRight: '0.5rem',
                    }}
                >
                    노드 타입
                </legend>
                <button
                    onClick={handleNodeTypeAll}
                    aria-pressed={isAllNodeTypes}
                    style={getTagStyle(isAllNodeTypes)}
                >
                    전체
                </button>
                {NODE_TYPES.map((type) => (
                    <button
                        key={type}
                        onClick={() => handleNodeTypeToggle(type)}
                        aria-pressed={filters.nodeTypes.includes(type)}
                        style={getTagStyle(filters.nodeTypes.includes(type))}
                    >
                        {NODE_TYPE_LABELS[type]}
                    </button>
                ))}
            </fieldset>

            {/* 국가 필터 - 태그 버튼 (복수 선택) */}
            <fieldset
                style={{
                    border: 'none',
                    padding: 0,
                    margin: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                }}
            >
                <legend
                    style={{
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        color: '#555',
                        float: 'left',
                        marginRight: '0.5rem',
                    }}
                >
                    국가
                </legend>
                <button
                    onClick={handleCountryAll}
                    aria-pressed={isAllCountries}
                    style={getTagStyle(isAllCountries)}
                >
                    전체
                </button>
                {COUNTRIES.map((country) => (
                    <button
                        key={country}
                        onClick={() => handleCountryToggle(country)}
                        aria-pressed={filters.countries.includes(country)}
                        style={getTagStyle(filters.countries.includes(country))}
                    >
                        {getCountryDisplayName(country)}
                    </button>
                ))}
            </fieldset>

            {/* 리스크 레벨 필터 - 태그 버튼 (단일 선택) */}
            <fieldset
                style={{
                    border: 'none',
                    padding: 0,
                    margin: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                }}
            >
                <legend
                    style={{
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        color: '#555',
                        float: 'left',
                        marginRight: '0.5rem',
                    }}
                >
                    리스크
                </legend>
                {RISK_LEVELS.map(({ value, label }) => (
                    <button
                        key={value}
                        onClick={() => handleRiskLevelChange(value)}
                        aria-pressed={filters.riskLevel === value}
                        style={getTagStyle(filters.riskLevel === value)}
                    >
                        {label}
                    </button>
                ))}
            </fieldset>

            {/* HS 코드 필터 - 태그 버튼 (단일 선택) */}
            <fieldset
                style={{
                    border: 'none',
                    padding: 0,
                    margin: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                }}
            >
                <legend
                    style={{
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        color: '#555',
                        float: 'left',
                        marginRight: '0.5rem',
                    }}
                >
                    HS 코드
                </legend>
                {HS_CODE_OPTIONS.map(({ value, label }) => (
                    <button
                        key={value}
                        onClick={() => handleHsCodeChange(value)}
                        aria-pressed={filters.hsCode === value}
                        style={getTagStyle(filters.hsCode === value)}
                    >
                        {label}
                    </button>
                ))}
            </fieldset>
        </div>
    );
}
