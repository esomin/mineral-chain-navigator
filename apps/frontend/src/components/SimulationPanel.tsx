import { useCallback, useMemo, useEffect } from 'react';
import type { Country, DisruptionType } from '@navigator/shared';
import { useSupplyChainStore } from '../store/supply-chain-store';
import { useSimulationStore } from '../store/simulation-store';
import type { HistoryEntry } from '../store/simulation-store';
import { getCountryDisplayName, getNodeTypeLabel } from '../utils/graph-helpers';
import { Button } from './ui/button';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Slider } from './ui/slider';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from './ui/select';

interface DisruptionTypeConfig {
    label: string;
    description: string;
    sliderLabel: string;
    min: number;
    max: number;
    step: number;
    formatValue: (val: number) => string;
    minLabel: string;
    maxLabel: string;
    defaultVal: number;
}

const DISRUPTION_TYPE_CONFIGS: Partial<Record<DisruptionType, DisruptionTypeConfig>> = {
    export_restriction: {
        label: '수출 통제',
        description: '[지정학] 국가별 수출 통제 및 관세',
        sliderLabel: '수출 물량 제한율',
        min: 0,
        max: 1,
        step: 0.05,
        formatValue: (val: number) => `${(val * 100).toFixed(0)}%`,
        minLabel: '0%',
        maxLabel: '100%',
        defaultVal: 0.5,
    },
    logistics_disruption: {
        label: '물류 마비',
        description: '[물류] 해운 경로 마비 및 운임 폭등',
        sliderLabel: '운송 리드타임 지연',
        min: 1,
        max: 5,
        step: 0.5,
        formatValue: (val: number) => `${val.toFixed(1)}배`,
        minLabel: '1배',
        maxLabel: '5배',
        defaultVal: 1.0,
    },
    facility_closure: {
        label: '조업 중단',
        description: '[조업] 광산/제련소 가동 중단',
        sliderLabel: '생산 능력 감소율',
        min: 0,
        max: 1,
        step: 0.05,
        formatValue: (val: number) => `${(val * 100).toFixed(0)}%`,
        minLabel: '0%',
        maxLabel: '100%',
        defaultVal: 0.5,
    },
    stockpile_policy: {
        label: '비축 정책',
        description: '[정책] 자원 국유화 및 국가 비축',
        sliderLabel: '정부 비축/통제 물량',
        min: 0,
        max: 0.5,
        step: 0.05,
        formatValue: (val: number) => `${(val * 100).toFixed(0)}%`,
        minLabel: '0%',
        maxLabel: '50%',
        defaultVal: 0.25,
    },
    demand_shock: {
        label: '수요 충격',
        description: '[수요] ESS/대체 수요 급증',
        sliderLabel: '초과 수요 발생률',
        min: 0,
        max: 1,
        step: 0.05,
        formatValue: (val: number) => `+${(val * 100).toFixed(0)}%`,
        minLabel: '+0%',
        maxLabel: '+100%',
        defaultVal: 0.5,
    },
};

// 국가 바로가기 버튼 설정은 주석 처리됨 (시나리오 프리셋으로 대체)

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

    // 충격 대상 유형을 항상 '노드'로 고정
    useEffect(() => {
        setTargetType('node');
    }, [setTargetType]);

    // 선택 가능한 노드 항목 목록 (유저가 읽기 쉬운 라벨명 적용 - 노드 전용)
    const targetOptions = useMemo(() => {
        return nodes.map((n) => {
            const countryStr = getCountryDisplayName(n.country);
            const typeStr = getNodeTypeLabel(n.type);
            const labelSuffix = n.country === 'NA' ? typeStr : `${countryStr}, ${typeStr}`;
            return {
                id: n.id,
                label: `${n.name} (${labelSuffix})`,
            };
        });
    }, [nodes]);

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

    // 충격 유형 변경 핸들러 (수치 범위가 다른 타입간 이동 시 기본값 자동 매핑)
    const handleDisruptionTypeChange = useCallback((value: string) => {
        const newType = value as DisruptionType;
        setDisruptionType(newType);

        const config = DISRUPTION_TYPE_CONFIGS[newType];
        if (config) {
            if (currentDisruption.severity < config.min || currentDisruption.severity > config.max) {
                setSeverity(config.defaultVal);
            }
        }
    }, [setDisruptionType, setSeverity, currentDisruption.severity]);

    // 3초 타임아웃 진행률 계산 (0~100)
    const timeoutProgress = useMemo(() => {
        return Math.min((elapsedSeconds / 3) * 100, 100);
    }, [elapsedSeconds]);

    return (
        <aside
            className="absolute top-0 left-0 w-[360px] h-full bg-white border-r border-slate-200 p-4 overflow-y-auto shadow-md z-[5] flex flex-col font-sans"
            aria-label="시뮬레이션 제어 패널"
            role="region"
        >
            {/* 헤더 */}
            <h2 className="text-base font-bold text-slate-900 mb-4 tracking-tight flex items-center justify-between">
                시뮬레이션 제어
            </h2>

            {/* 시나리오 구성 UI */}
            <Card className="border border-slate-150 bg-slate-50/50 shadow-sm mb-4">
                <CardHeader className="p-3.5 pb-0">
                    <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        충격 시나리오 구성
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-3.5 pt-3">
                    {/* 대상 노드(시설) 선택 */}
                    <div className="mb-3">
                        <label
                            htmlFor="sim-target-id"
                            className="block text-xs font-medium text-slate-600 mb-1.5"
                        >
                            대상 시설 (노드)
                        </label>
                        <Select
                            value={currentDisruption.targetId}
                            onValueChange={(val) => setTargetId(val)}
                        >
                            <SelectTrigger id="sim-target-id" className="w-full bg-white border border-slate-200">
                                <SelectValue placeholder="-- 선택 --" />
                            </SelectTrigger>
                            <SelectContent position="popper">
                                {targetOptions.map((opt) => (
                                    <SelectItem key={opt.id} value={opt.id}>
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* 충격 유형 선택 */}
                    <div className="mb-3">
                        <label
                            htmlFor="sim-disruption-type"
                            className="block text-xs font-medium text-slate-600 mb-1.5"
                        >
                            충격 유형
                        </label>
                        <Select
                            value={currentDisruption.disruptionType}
                            onValueChange={handleDisruptionTypeChange}
                        >
                            <SelectTrigger id="sim-disruption-type" className="w-full bg-white border border-slate-200">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent position="popper">
                                {Object.entries(DISRUPTION_TYPE_CONFIGS).map(([value, config]) => (
                                    <SelectItem key={value} value={value}>
                                        {config.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <div className="text-[11px] text-slate-400 mt-1 font-normal leading-normal italic">
                            {DISRUPTION_TYPE_CONFIGS[currentDisruption.disruptionType]?.description}
                        </div>
                    </div>

                    {/* 동적 충격 강도 슬라이더 */}
                    {(() => {
                        const config = DISRUPTION_TYPE_CONFIGS[currentDisruption.disruptionType];
                        if (!config) return null;
                        return (
                            <div className="mb-4">
                                <label
                                    htmlFor="sim-severity"
                                    className="block text-xs font-medium text-slate-600 mb-1.5"
                                >
                                    {config.sliderLabel}: <span className="font-semibold text-slate-900">{config.formatValue(currentDisruption.severity)}</span>
                                </label>
                                <Slider
                                    id="sim-severity"
                                    min={config.min}
                                    max={config.max}
                                    step={config.step}
                                    value={[currentDisruption.severity]}
                                    onValueChange={(val) => setSeverity(val[0])}
                                    className="py-2"
                                    aria-label={`${config.sliderLabel} 슬라이더`}
                                />
                                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                                    <span>{config.minLabel}</span>
                                    <span>{config.maxLabel}</span>
                                </div>
                            </div>
                        );
                    })()}

                    {/* 충격 추가 버튼 */}
                    <Button
                        onClick={handleAddDisruption}
                        disabled={!currentDisruption.targetId}
                        variant={currentDisruption.targetId ? "default" : "secondary"}
                        // size="sm"
                        className="w-full"
                        aria-label="충격 이벤트 추가"
                    >
                        + 충격 이벤트 추가
                    </Button>
                </CardContent>
            </Card>

            {/* 추가된 충격 목록 */}
            {disruptions.length > 0 && (
                <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xs font-bold text-slate-700">
                            충격 이벤트 목록 ({disruptions.length})
                        </h3>
                        <Button
                            variant="destructive"
                            size="xs"
                            onClick={clearDisruptions}
                            aria-label="충격 목록 전체 삭제"
                        >
                            전체 삭제
                        </Button>
                    </div>
                    <ul className="m-0 p-0 list-none space-y-1.5" aria-label="충격 이벤트 목록">
                        {disruptions.map((d, i) => (
                            <li
                                key={i}
                                className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200/60 rounded-md text-xs text-slate-700 shadow-xs"
                            >
                                <span className="truncate pr-2 font-medium">
                                    [시설] {(() => {
                                        const node = nodes.find((n) => n.id === d.targetId);
                                        return node ? `${node.name} (${getCountryDisplayName(node.country)})` : d.targetId;
                                    })()} • {DISRUPTION_TYPE_CONFIGS[d.disruptionType]?.label || d.disruptionType} • {DISRUPTION_TYPE_CONFIGS[d.disruptionType]?.formatValue(d.severity) || d.severity}
                                </span>
                                <Button
                                    variant="ghost"
                                    size="icon-xs"
                                    onClick={() => removeDisruption(i)}
                                    className="text-slate-400 hover:text-red-500 hover:bg-transparent"
                                    aria-label={`충격 ${i + 1} 삭제`}
                                >
                                    ✕
                                </Button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* 시나리오 프리셋 */}
            <Card className="border border-slate-150 bg-slate-50/50 shadow-sm mb-4">
                <CardHeader className="p-3.5 pb-0">
                    <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        시나리오 프리셋
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-3.5 pt-3">
                    {/* 시나리오 프리셋 목록 (다음 단계에서 연동) */}
                </CardContent>
            </Card>

            {/* 시뮬레이션 실행 버튼 */}
            <Button
                onClick={handleRunSimulation}
                disabled={isRunning || disruptions.length === 0}
                variant="secondary"
                className="w-full h-9 mb-3 shadow-sm font-semibold"
                aria-label="시뮬레이션 실행"
            >
                {isRunning ? '실행 중...' : '▶ 시뮬레이션 실행'}
            </Button>

            {/* 로딩 상태 & 3초 타임아웃 인디케이터 */}
            {isRunning && (
                <div
                    className="mb-4"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={3}
                    aria-valuenow={Math.min(elapsedSeconds, 3)}
                    aria-label="시뮬레이션 실행 진행률"
                >
                    <div className="flex justify-between text-[11px] font-medium text-slate-500 mb-1">
                        <span>실행 중...</span>
                        <span>{Math.min(elapsedSeconds, 3).toFixed(1)}s / 3.0s</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-slate-900 rounded-full transition-all duration-100 ease-linear"
                            style={{ width: `${timeoutProgress}%` }}
                        />
                    </div>
                </div>
            )}

            {/* 에러 메시지 */}
            {error && (
                <div
                    className="p-3 bg-red-50 border border-red-100 text-red-700 rounded-md text-xs mb-3 font-medium flex items-center gap-1.5"
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

function formatExecutionTime(ms: number): string {
    if (ms < 1) {
        return `${ms.toFixed(2)}ms`;
    }
    if (ms < 10) {
        return `${ms.toFixed(1)}ms`;
    }
    if (ms < 1000) {
        return `${Math.round(ms)}ms`;
    }
    return `${(ms / 1000).toFixed(2)}s`;
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
    const { nodes } = useSupplyChainStore();
    // 부족률 내림차순 정렬
    const sortedDeficits = [...result.deficits].sort(
        (a, b) => b.deficitPercentage - a.deficitPercentage,
    );
    const maxDeficit = sortedDeficits.length > 0 ? sortedDeficits[0].deficitPercentage : 0;

    return (
        <Card
            className="border border-emerald-100 bg-emerald-50/15 mb-3 shadow-xs"
            aria-label="시뮬레이션 결과"
            role="region"
        >
            <CardHeader className="p-3.5 pb-0 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs font-bold text-emerald-800">
                    결과 요약
                </CardTitle>
                <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={onClear}
                    className="text-slate-400 hover:text-slate-600 hover:bg-emerald-50/20 p-0"
                    aria-label="결과 초기화"
                >
                    ✕
                </Button>
            </CardHeader>
            <CardContent className="p-3.5 pt-3">
                <div className="grid grid-cols-3 gap-2 text-xs mb-3 text-slate-700 bg-white border border-slate-100 rounded-md p-2 shadow-xs">
                    <div className="text-center border-r border-slate-100">
                        <div className="text-[10px] text-slate-400">영향 노드</div>
                        <div className="font-bold text-slate-800 mt-0.5">{result.deficits.length}개</div>
                    </div>
                    <div className="text-center border-r border-slate-100">
                        <div className="text-[10px] text-slate-400">최대 부족률</div>
                        <div className="font-bold text-slate-800 mt-0.5">{maxDeficit.toFixed(1)}%</div>
                    </div>
                    <div className="text-center">
                        <div className="text-[10px] text-slate-400">실행 시간</div>
                        <div className="font-bold text-slate-800 mt-0.5">{formatExecutionTime(result.executionTimeMs)}</div>
                    </div>
                </div>

                {sortedDeficits.length > 0 && (
                    <div className="max-h-[150px] overflow-y-auto border border-slate-100 rounded-md bg-white shadow-xs">
                        <table className="w-full text-xs border-collapse" aria-label="부족률 테이블">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100 text-slate-500">
                                    <th className="text-left py-1.5 px-2 font-medium">노드</th>
                                    <th className="text-right py-1.5 px-2 font-medium">부족률</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedDeficits.map((d) => {
                                    const node = nodes.find((n) => n.id === d.nodeId);
                                    const nameStr = node
                                        ? `${node.name} (${node.country === 'NA' ? '' : getCountryDisplayName(node.country) + ', '}${getNodeTypeLabel(node.type)})`
                                        : d.nodeId;
                                    return (
                                        <tr key={d.nodeId} className="border-b border-slate-50 last:border-b-0 text-slate-600 hover:bg-slate-50/50">
                                            <td className="py-1 px-2 font-medium text-[11px] truncate max-w-[190px]" title={nameStr}>
                                                {nameStr}
                                            </td>
                                            <td className={`text-right py-1 px-2 font-semibold ${d.deficitPercentage > 50 ? 'text-red-600' : 'text-slate-700'}`}>
                                                {d.deficitPercentage.toFixed(1)}%
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
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
        <Card className="border border-slate-150 bg-slate-50/50 shadow-sm mt-4">
            <CardHeader className="p-3.5 pb-0">
                <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    시뮬레이션 이력 ({entries.length})
                </CardTitle>
            </CardHeader>
            <CardContent className="p-3.5 pt-3">
                {isLoading && (
                    <div className="text-xs text-slate-400 mb-2 flex items-center gap-1.5">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse"></span>
                        이력 로드 중...
                    </div>
                )}

                <ul
                    className="margin-0 padding-0 list-none max-h-[160px] overflow-y-auto space-y-1.5"
                    aria-label="시뮬레이션 이력 목록"
                    role="list"
                >
                    {entries.map((entry, index) => (
                        <li key={`${entry.scenarioId}-${index}`}>
                            <button
                                onClick={() => onEntryClick(entry.scenarioId)}
                                disabled={isLoading}
                                className="w-full flex flex-col items-start gap-1 p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-md cursor-pointer transition-colors disabled:cursor-not-allowed disabled:opacity-50 text-left shadow-xs"
                                aria-label={`이력: ${entry.name}, 실행 시간 ${formatExecutionTime(entry.result.executionTimeMs)}`}
                            >
                                <span className="text-xs font-semibold text-slate-800">
                                    {entry.name}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                    {entry.executedAt.toLocaleString('ko-KR')} • {formatExecutionTime(entry.result.executionTimeMs)}
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            </CardContent>
        </Card>
    );
}
