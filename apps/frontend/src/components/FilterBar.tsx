import { useCallback } from 'react';
import type { NodeType, Country } from '@navigator/shared';
import { useSupplyChainStore } from '../store/supply-chain-store';
import { getCountryDisplayName } from '../utils/graph-helpers';

// 필터 가능한 노드 타입 목록
const NODE_TYPES: NodeType[] = ['Resource', 'Mine', 'Refinery', 'Factory'];

// 필터 가능한 국가 목록
const COUNTRIES: Country[] = ['SouthKorea', 'Japan', 'China', 'Chile', 'UnitedStates', 'NA'];

// 리스크 레벨 옵션
const RISK_LEVELS = [
    { value: 'all', label: '전체' },
    { value: 'low', label: '저위험 (0-33)' },
    { value: 'medium', label: '중위험 (34-66)' },
    { value: 'high', label: '고위험 (67-100)' },
] as const;

// 노드 타입 한글 라벨
const NODE_TYPE_LABELS: Record<NodeType, string> = {
    Resource: '자원',
    Mine: '광산',
    Refinery: '제련소',
    Factory: '공장',
};

/**
 * 그래프 필터 컨트롤 바.
 * 노드 타입, 국가, 리스크 레벨 필터를 제공한다.
 * 필터 변경 시 Zustand 스토어를 통해 즉시 반영된다.
 */
export function FilterBar() {
    const { filters, setFilters } = useSupplyChainStore();

    // 노드 타입 토글 핸들러
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

    // 국가 토글 핸들러
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

    // 리스크 레벨 변경 핸들러
    const handleRiskLevelChange = useCallback(
        (level: 'all' | 'low' | 'medium' | 'high') => {
            setFilters({ riskLevel: level });
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
            {/* 노드 타입 필터 */}
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
                {NODE_TYPES.map((type) => (
                    <label
                        key={type}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                            cursor: 'pointer',
                            padding: '2px 6px',
                            borderRadius: '3px',
                            background: filters.nodeTypes.includes(type) ? '#e6f7ff' : 'transparent',
                            border: filters.nodeTypes.includes(type)
                                ? '1px solid #91d5ff'
                                : '1px solid transparent',
                        }}
                    >
                        <input
                            type="checkbox"
                            checked={filters.nodeTypes.includes(type)}
                            onChange={() => handleNodeTypeToggle(type)}
                            aria-label={`${NODE_TYPE_LABELS[type]} 필터`}
                            style={{ margin: 0, width: 14, height: 14 }}
                        />
                        <span>{NODE_TYPE_LABELS[type]}</span>
                    </label>
                ))}
            </fieldset>

            {/* 국가 필터 */}
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
                {COUNTRIES.map((country) => (
                    <label
                        key={country}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                            cursor: 'pointer',
                            padding: '2px 6px',
                            borderRadius: '3px',
                            background: filters.countries.includes(country) ? '#e6f7ff' : 'transparent',
                            border: filters.countries.includes(country)
                                ? '1px solid #91d5ff'
                                : '1px solid transparent',
                        }}
                    >
                        <input
                            type="checkbox"
                            checked={filters.countries.includes(country)}
                            onChange={() => handleCountryToggle(country)}
                            aria-label={`${getCountryDisplayName(country)} 필터`}
                            style={{ margin: 0, width: 14, height: 14 }}
                        />
                        <span>{getCountryDisplayName(country)}</span>
                    </label>
                ))}
            </fieldset>

            {/* 리스크 레벨 필터 */}
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
                        style={{
                            padding: '2px 8px',
                            borderRadius: '3px',
                            border:
                                filters.riskLevel === value
                                    ? '1px solid #91d5ff'
                                    : '1px solid #d9d9d9',
                            background: filters.riskLevel === value ? '#e6f7ff' : '#fff',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            color: filters.riskLevel === value ? '#1890ff' : '#333',
                        }}
                    >
                        {label}
                    </button>
                ))}
            </fieldset>
        </div>
    );
}
