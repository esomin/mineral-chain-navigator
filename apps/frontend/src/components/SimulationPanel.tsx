import { useCallback, useMemo } from 'react';
import type { Country, DisruptionType } from '@navigator/shared';
import { useSupplyChainStore } from '../store/supply-chain-store';
import { useSimulationStore } from '../store/simulation-store';
import type { HistoryEntry } from '../store/simulation-store';

// 충격 유형 레이블 매핑
const DISRUPTION_TYPE_LABELS: Record<DisruptionType, string> = {
    export_restriction: '수출 규제',
    facility_closure: '시설 폐쇄',
    strike: '파업',
    natural_disaster: '자연재해',
};

// 국가 바로가기 버튼 설정 (7개국)
const COUNTRY_SHORTCUTS: { country: Country; label: string }[] = [
    { country: 'Australia', label: '🇦🇺 호주' },
    { country: 'Chile', label: '🇨🇱 칠레' },
    { country: 'Argentina', label: '🇦🇷 아르헨티나' },
    { country: 'China', label: '🇨🇳 중국' },
    { country: 'SouthKorea', label: '🇰🇷 한국' },
    { country: 'Japan', label: '🇯🇵 일본' },
    { country: 'UnitedStates', label: '🇺🇸 미국' },
];

/**
 * Simulation Controls 사이드 패널 컴포넌트.
 * 충격 시나리오 구성, 국가 수출 규제 바로가기, 시뮬레이션 실행을 제공한다.
 * Requirements 7.5 구현.
 */
export function SimulationPanel() {
    const { nodes, edges } = useSupplyChainStore();
    const {
        currentDisruption,
        disruptions,
        isRunning,
        elapsedSeconds,
        error,
        result,
        historyEntries,
        isLoadingHistory,
        setTargetId,
        setTargetType,
        setDisruptionType,
        setSeverity,
        addDisruption,
        removeDisruption,
        clearDisruptions,
        setDisruptions,
        runSimulation,
        clearResult,
        loadHistoryResult,
    } = useSimulationStore();

    // 대상 유형에 따른 선택 가능 항목 목록
    const targetOptions = useMemo(() => {
        if (currentDisruption.targetType === 'node') {
            return nodes.map((n) => ({ id: n.id, label: `${n.name} (${n.id})` }));
        }
        return edges.map((e) => ({
            id: e.id,
            label: `${e.sourceNodeId} → ${e.targetNodeId} (${e.id})`,
        }));
    }, [currentDisruption.targetType, nodes, edges]);

    // 국가 수출 규제 바로가기 핸들러
    const handleCountryShortcut = useCallback(
        (country: Country) => {
            // 해당 국가에서 출발하는 모든 엣지를 수출 규제 대상으로 설정
            const countryNodeIds = new Set(
                nodes.filter((n) => n.country === country).map((n) => n.id),
            );
            const countryEdges = edges.filter((e) => countryNodeIds.has(e.sourceNodeId));

            const newDisruptions = countryEdges.map((e) => ({
                targetId: e.id,
                targetType: 'edge' as const,
                disruptionType: 'export_restriction' as const,
                severity: 0.8,
            }));

            setDisruptions(newDisruptions);
        },
        [nodes, edges, setDisruptions],
    );

    // 충격 추가 핸들러
    const handleAddDisruption = useCallback(() => {
        addDisruption();
    }, [addDisruption]);

    // 시뮬레이션 실행 핸들러
    const handleRunSimulation = useCallback(() => {
        runSimulation();
    }, [runSimulation]);

    // 이력 항목 클릭 핸들러
    const handleHistoryClick = useCallback(
        (scenarioId: string) => {
            loadHistoryResult(scenarioId);
        },
        [loadHistoryResult],
    );

    // 3초 타임아웃 진행률 계산 (0~100)
    const timeoutProgress = useMemo(() => {
        return Math.min((elapsedSeconds / 3) * 100, 100);
    }, [elapsedSeconds]);

    return (
        <aside
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '360px',
                height: '100%',
                background: '#fff',
                borderRight: '1px solid #e0e0e0',
                padding: '1rem',
                overflowY: 'auto',
                boxShadow: '2px 0 8px rgba(0,0,0,0.06)',
                zIndex: 5,
            }}
            aria-label="시뮬레이션 제어 패널"
            role="region"
        >
            {/* 헤더 */}
            <h2 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>시뮬레이션 제어</h2>

            {/* 시나리오 구성 UI */}
            <fieldset
                style={{ border: '1px solid #e0e0e0', borderRadius: '6px', padding: '0.75rem', margin: '0 0 1rem' }}
            >
                <legend style={{ fontSize: '0.85rem', fontWeight: 'bold', padding: '0 4px' }}>
                    충격 시나리오 구성
                </legend>

                {/* 대상 유형 선택 */}
                <div style={{ marginBottom: '0.5rem' }}>
                    <label
                        htmlFor="sim-target-type"
                        style={{ display: 'block', fontSize: '0.8rem', color: '#666', marginBottom: '4px' }}
                    >
                        대상 유형
                    </label>
                    <select
                        id="sim-target-type"
                        value={currentDisruption.targetType}
                        onChange={(e) => setTargetType(e.target.value as 'node' | 'edge')}
                        style={{
                            width: '100%',
                            padding: '6px 8px',
                            fontSize: '0.8rem',
                            border: '1px solid #d9d9d9',
                            borderRadius: '4px',
                        }}
                        aria-label="충격 대상 유형 선택"
                    >
                        <option value="node">노드</option>
                        <option value="edge">엣지</option>
                    </select>
                </div>

                {/* 대상 노드/엣지 선택 */}
                <div style={{ marginBottom: '0.5rem' }}>
                    <label
                        htmlFor="sim-target-id"
                        style={{ display: 'block', fontSize: '0.8rem', color: '#666', marginBottom: '4px' }}
                    >
                        대상 {currentDisruption.targetType === 'node' ? '노드' : '엣지'}
                    </label>
                    <select
                        id="sim-target-id"
                        value={currentDisruption.targetId}
                        onChange={(e) => setTargetId(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '6px 8px',
                            fontSize: '0.8rem',
                            border: '1px solid #d9d9d9',
                            borderRadius: '4px',
                        }}
                        aria-label="충격 대상 선택"
                    >
                        <option value="">-- 선택 --</option>
                        {targetOptions.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                </div>

                {/* 충격 유형 선택 */}
                <div style={{ marginBottom: '0.5rem' }}>
                    <label
                        htmlFor="sim-disruption-type"
                        style={{ display: 'block', fontSize: '0.8rem', color: '#666', marginBottom: '4px' }}
                    >
                        충격 유형
                    </label>
                    <select
                        id="sim-disruption-type"
                        value={currentDisruption.disruptionType}
                        onChange={(e) => setDisruptionType(e.target.value as DisruptionType)}
                        style={{
                            width: '100%',
                            padding: '6px 8px',
                            fontSize: '0.8rem',
                            border: '1px solid #d9d9d9',
                            borderRadius: '4px',
                        }}
                        aria-label="충격 유형 선택"
                    >
                        {Object.entries(DISRUPTION_TYPE_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </select>
                </div>

                {/* 심각도 슬라이더 */}
                <div style={{ marginBottom: '0.75rem' }}>
                    <label
                        htmlFor="sim-severity"
                        style={{ display: 'block', fontSize: '0.8rem', color: '#666', marginBottom: '4px' }}
                    >
                        심각도: {currentDisruption.severity.toFixed(1)}
                    </label>
                    <input
                        id="sim-severity"
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={currentDisruption.severity}
                        onChange={(e) => setSeverity(parseFloat(e.target.value))}
                        style={{ width: '100%' }}
                        aria-label="심각도 슬라이더"
                        aria-valuemin={0}
                        aria-valuemax={1}
                        aria-valuenow={currentDisruption.severity}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#999' }}>
                        <span>0</span>
                        <span>1</span>
                    </div>
                </div>

                {/* 충격 추가 버튼 */}
                <button
                    onClick={handleAddDisruption}
                    disabled={!currentDisruption.targetId}
                    style={{
                        width: '100%',
                        padding: '6px 12px',
                        fontSize: '0.8rem',
                        background: currentDisruption.targetId ? '#1890ff' : '#f5f5f5',
                        color: currentDisruption.targetId ? '#fff' : '#999',
                        border: '1px solid ' + (currentDisruption.targetId ? '#1890ff' : '#d9d9d9'),
                        borderRadius: '4px',
                        cursor: currentDisruption.targetId ? 'pointer' : 'not-allowed',
                    }}
                    aria-label="충격 이벤트 추가"
                >
                    + 충격 이벤트 추가
                </button>
            </fieldset>

            {/* 추가된 충격 목록 */}
            {disruptions.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <h3 style={{ margin: 0, fontSize: '0.85rem' }}>
                            충격 이벤트 목록 ({disruptions.length})
                        </h3>
                        <button
                            onClick={clearDisruptions}
                            style={{
                                background: 'none',
                                border: 'none',
                                fontSize: '0.75rem',
                                color: '#ff4d4f',
                                cursor: 'pointer',
                            }}
                            aria-label="충격 목록 전체 삭제"
                        >
                            전체 삭제
                        </button>
                    </div>
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none' }} aria-label="충격 이벤트 목록">
                        {disruptions.map((d, i) => (
                            <li
                                key={i}
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '4px 8px',
                                    marginBottom: '4px',
                                    background: '#fafafa',
                                    borderRadius: '4px',
                                    fontSize: '0.75rem',
                                }}
                            >
                                <span>
                                    [{d.targetType === 'node' ? '노드' : '엣지'}] {d.targetId} •{' '}
                                    {DISRUPTION_TYPE_LABELS[d.disruptionType]} • {d.severity.toFixed(1)}
                                </span>
                                <button
                                    onClick={() => removeDisruption(i)}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#ff4d4f',
                                        cursor: 'pointer',
                                        fontSize: '0.8rem',
                                    }}
                                    aria-label={`충격 ${i + 1} 삭제`}
                                >
                                    ✕
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* 국가 수준 수출 규제 바로가기 */}
            <fieldset
                style={{ border: '1px solid #e0e0e0', borderRadius: '6px', padding: '0.75rem', margin: '0 0 1rem' }}
            >
                <legend style={{ fontSize: '0.85rem', fontWeight: 'bold', padding: '0 4px' }}>
                    국가 수출 규제 바로가기
                </legend>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {COUNTRY_SHORTCUTS.map(({ country, label }) => (
                        <button
                            key={country}
                            onClick={() => handleCountryShortcut(country)}
                            style={{
                                padding: '4px 10px',
                                fontSize: '0.75rem',
                                background: '#f6ffed',
                                border: '1px solid #b7eb8f',
                                borderRadius: '4px',
                                cursor: 'pointer',
                            }}
                            aria-label={`${label} 수출 규제 시뮬레이션`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </fieldset>

            {/* 시뮬레이션 실행 버튼 */}
            <button
                onClick={handleRunSimulation}
                disabled={isRunning || disruptions.length === 0}
                style={{
                    width: '100%',
                    padding: '10px',
                    fontSize: '0.9rem',
                    fontWeight: 'bold',
                    background: isRunning || disruptions.length === 0 ? '#f5f5f5' : '#52c41a',
                    color: isRunning || disruptions.length === 0 ? '#999' : '#fff',
                    border: '1px solid ' + (isRunning || disruptions.length === 0 ? '#d9d9d9' : '#52c41a'),
                    borderRadius: '6px',
                    cursor: isRunning || disruptions.length === 0 ? 'not-allowed' : 'pointer',
                    marginBottom: '0.75rem',
                }}
                aria-label="시뮬레이션 실행"
            >
                {isRunning ? '실행 중...' : '▶ 시뮬레이션 실행'}
            </button>

            {/* 로딩 상태 & 3초 타임아웃 인디케이터 */}
            {isRunning && (
                <div
                    style={{ marginBottom: '1rem' }}
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={3}
                    aria-valuenow={Math.min(elapsedSeconds, 3)}
                    aria-label="시뮬레이션 실행 진행률"
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#666', marginBottom: '4px' }}>
                        <span>실행 중...</span>
                        <span>{Math.min(elapsedSeconds, 3).toFixed(1)}s / 3.0s</span>
                    </div>
                    <div
                        style={{
                            width: '100%',
                            height: '6px',
                            background: '#f0f0f0',
                            borderRadius: '3px',
                            overflow: 'hidden',
                        }}
                    >
                        <div
                            style={{
                                width: `${timeoutProgress}%`,
                                height: '100%',
                                background: timeoutProgress >= 100 ? '#ff4d4f' : '#1890ff',
                                borderRadius: '3px',
                                transition: 'width 0.1s linear',
                            }}
                        />
                    </div>
                </div>
            )}

            {/* 에러 메시지 */}
            {error && (
                <div
                    style={{
                        padding: '8px 12px',
                        background: '#fff2f0',
                        border: '1px solid #ffccc7',
                        borderRadius: '4px',
                        fontSize: '0.8rem',
                        color: '#cf1322',
                        marginBottom: '0.75rem',
                    }}
                    role="alert"
                    aria-live="assertive"
                >
                    ⚠ {error}
                </div>
            )}

            {/* 시뮬레이션 결과 요약 및 부족률 테이블 */}
            {result && (
                <SimulationResultSection result={result} onClear={clearResult} />
            )}

            {/* 시뮬레이션 이력 섹션 */}
            {historyEntries.length > 0 && (
                <SimulationHistorySection
                    entries={historyEntries}
                    isLoading={isLoadingHistory}
                    onEntryClick={handleHistoryClick}
                />
            )}
        </aside>
    );
}

/**
 * 실행 시간을 포맷팅하여 표시 (ms → 초 단위 소수점 1자리)
 */
function formatExecutionTime(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * 시뮬레이션 결과 요약 및 부족률 테이블 컴포넌트.
 * Requirements 7.6 구현: 영향받은 노드 수, 최대 부족률, 부족률 내림차순 테이블.
 */
function SimulationResultSection({
    result,
    onClear,
}: {
    result: import('@navigator/shared').SimulationResult;
    onClear: () => void;
}) {
    // 부족률 내림차순 정렬
    const sortedDeficits = [...result.deficits].sort(
        (a, b) => b.deficitPercentage - a.deficitPercentage,
    );
    const maxDeficit = sortedDeficits.length > 0 ? sortedDeficits[0].deficitPercentage : 0;

    return (
        <div
            style={{
                border: '1px solid #d9f7be',
                borderRadius: '6px',
                padding: '0.75rem',
                background: '#f6ffed',
                marginBottom: '0.75rem',
            }}
            aria-label="시뮬레이션 결과"
            role="region"
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '0.85rem' }}>결과 요약</h3>
                <button
                    onClick={onClear}
                    style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '0.75rem',
                        color: '#999',
                        cursor: 'pointer',
                    }}
                    aria-label="결과 초기화"
                >
                    ✕ 닫기
                </button>
            </div>
            <div style={{ fontSize: '0.8rem', marginBottom: '0.5rem', color: '#333' }}>
                <div>영향 노드: <strong>{result.deficits.length}</strong>개</div>
                <div>최대 부족률: <strong>{maxDeficit.toFixed(1)}%</strong></div>
                <div>실행 시간: {formatExecutionTime(result.executionTimeMs)}</div>
            </div>

            {sortedDeficits.length > 0 && (
                <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }} aria-label="부족률 테이블">
                        <thead>
                            <tr style={{ borderBottom: '1px solid #e0e0e0' }}>
                                <th style={{ textAlign: 'left', padding: '4px' }}>노드</th>
                                <th style={{ textAlign: 'right', padding: '4px' }}>부족률</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedDeficits.map((d) => (
                                <tr key={d.nodeId} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                    <td style={{ padding: '3px 4px' }}>{d.nodeId}</td>
                                    <td style={{ textAlign: 'right', padding: '3px 4px', color: d.deficitPercentage > 50 ? '#cf1322' : '#333' }}>
                                        {d.deficitPercentage.toFixed(1)}%
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

/**
 * 시뮬레이션 이력 섹션 컴포넌트.
 * 실행된 시뮬레이션 이력 목록을 표시하고, 클릭 시 결과를 재로드한다.
 */
function SimulationHistorySection({
    entries,
    isLoading,
    onEntryClick,
}: {
    entries: HistoryEntry[];
    isLoading: boolean;
    onEntryClick: (scenarioId: string) => void;
}) {
    return (
        <fieldset
            style={{
                border: '1px solid #e0e0e0',
                borderRadius: '6px',
                padding: '0.75rem',
                margin: '1rem 0 0',
            }}
        >
            <legend style={{ fontSize: '0.85rem', fontWeight: 'bold', padding: '0 4px' }}>
                시뮬레이션 이력 ({entries.length})
            </legend>

            {isLoading && (
                <div style={{ fontSize: '0.75rem', color: '#1890ff', marginBottom: '0.5rem' }}>
                    이력 로드 중...
                </div>
            )}

            <ul
                style={{ margin: 0, padding: 0, listStyle: 'none', maxHeight: '200px', overflowY: 'auto' }}
                aria-label="시뮬레이션 이력 목록"
                role="list"
            >
                {entries.map((entry, index) => (
                    <li key={`${entry.scenarioId}-${index}`}>
                        <button
                            onClick={() => onEntryClick(entry.scenarioId)}
                            disabled={isLoading}
                            style={{
                                width: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'flex-start',
                                gap: '2px',
                                padding: '6px 8px',
                                marginBottom: '4px',
                                background: '#fafafa',
                                border: '1px solid #f0f0f0',
                                borderRadius: '4px',
                                cursor: isLoading ? 'not-allowed' : 'pointer',
                                textAlign: 'left',
                                transition: 'background 0.15s',
                            }}
                            onMouseEnter={(e) => {
                                if (!isLoading) e.currentTarget.style.background = '#e6f7ff';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#fafafa';
                            }}
                            aria-label={`이력: ${entry.name}, 실행 시간 ${formatExecutionTime(entry.result.executionTimeMs)}`}
                        >
                            <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#333' }}>
                                {entry.name}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: '#888' }}>
                                {entry.executedAt.toLocaleString('ko-KR')} • {formatExecutionTime(entry.result.executionTimeMs)}
                            </span>
                        </button>
                    </li>
                ))}
            </ul>
        </fieldset>
    );
}
