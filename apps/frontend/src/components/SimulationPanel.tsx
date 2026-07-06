import { useCallback, useMemo, useEffect, useState } from 'react';
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
import { ChevronLeft, ChevronRight } from 'lucide-react';

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

interface ScenarioPreset {
    id: string;
    name: string;
    description: string;
    badge: string;
    config: {
        targetType: 'node' | 'edge';
        country?: string;
        nodeType?: string;
        sourceNodeId?: string;
        targetId: string;
        disruptionType: DisruptionType;
        severity: number;
    };
}

const SCENARIO_PRESETS: ScenarioPreset[] = [
    {
        id: 'ai-ess-demand',
        name: 'AI 데이터센터발 ESS용 리튬 수요 폭발',
        description: '글로벌 배터리 공장의 리튬 수요 50% 급증',
        badge: '수요',
        config: {
            targetType: 'node',
            country: 'ALL',
            nodeType: 'Factory',
            disruptionType: 'demand_shock',
            severity: 0.5,
            targetId: 'F-01',
        },
    },
    {
        id: 'china-export-restriction',
        name: '중국 리튬 수출 통제',
        description: '중국 리튬 제품의 수출 통제로 물량 80% 제한',
        badge: '지정학',
        config: {
            targetType: 'node',
            country: 'China',
            nodeType: 'Refinery',
            disruptionType: 'export_restriction',
            severity: 0.8,
            targetId: 'RF-01',
        },
    },
    {
        id: 'latin-nationalization',
        name: '남미 리튬 삼각지대 국유화',
        description: '칠레 광산 국유화로 유통 물량 30% 격리',
        badge: '정책',
        config: {
            targetType: 'node',
            country: 'Chile',
            nodeType: 'Mine',
            disruptionType: 'stockpile_policy',
            severity: 0.3,
            targetId: 'M-01',
        },
    },
    {
        id: 'sea-route-blockade',
        name: '주요 해상 경로 봉쇄',
        description: '호주-중국 간 해상 경로 마비로 3배 지연',
        badge: '물류',
        config: {
            targetType: 'edge',
            sourceNodeId: 'M-04',
            disruptionType: 'logistics_disruption',
            severity: 3.0,
            targetId: 'E-M04-RF01',
        },
    },
];


/**
 * Simulation Controls 사이드 패널 컴포넌트.
 * 충격 시나리오 구성, 국가 수출 규제 바로가기, 시뮬레이션 실행을 제공한다.
 * Requirements 7.5 구현.
 */
export function SimulationPanel() {
    const { nodes, edges, setFilters } = useSupplyChainStore();
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

    // '매장된 자원'을 제외한 유효 시설 노드 목록 생성
    const activeNodes = useMemo(() => {
        return nodes.filter((n) => n.type !== 'Resource');
    }, [nodes]);

    // 필터링 상태 추가
    const [selectedCountry, setSelectedCountry] = useState<string>('ALL');
    const [selectedNodeType, setSelectedNodeType] = useState<string>('ALL');
    const [selectedSourceNodeId, setSelectedSourceNodeId] = useState<string>('ALL');

    // 2열 레이아웃 슬라이드 아웃 상태
    const [isSecondColumnOpen, setIsSecondColumnOpen] = useState(historyEntries.length > 0 || !!result);

    // 결과 생성 시 2열 패널 자동 확장
    useEffect(() => {
        if (result) {
            setIsSecondColumnOpen(true);
        }
    }, [result]);

    // 프리셋 적용 핸들러
    const handleApplyPreset = useCallback((preset: ScenarioPreset) => {
        setTargetType(preset.config.targetType);

        if (preset.config.targetType === 'node') {
            setSelectedCountry(preset.config.country || 'ALL');
            setSelectedNodeType(preset.config.nodeType || 'ALL');
            setSelectedSourceNodeId('ALL');
        } else {
            setSelectedCountry('ALL');
            setSelectedNodeType('ALL');
            setSelectedSourceNodeId(preset.config.sourceNodeId || 'ALL');
        }

        setDisruptionType(preset.config.disruptionType);
        setSeverity(preset.config.severity);
        setTargetId(preset.config.targetId);
    }, [setTargetType, setDisruptionType, setSeverity, setTargetId]);

    // 사용 가능한 국가 필터 옵션
    const countryOptions = useMemo(() => {
        const countries = Array.from(new Set(activeNodes.map((n) => n.country)));
        return [
            { value: 'ALL', label: '모든 국가' },
            ...countries.map((c) => ({
                value: c,
                label: getCountryDisplayName(c),
            })).sort((a, b) => a.label.localeCompare(b.label, 'ko')),
        ];
    }, [activeNodes]);

    // 사용 가능한 시설 유형 필터 옵션
    const nodeTypeOptions = useMemo(() => {
        const types = Array.from(new Set(activeNodes.map((n) => n.type)));
        return [
            { value: 'ALL', label: '모든 시설 종류' },
            ...types.map((t) => ({
                value: t,
                label: getNodeTypeLabel(t),
            })).sort((a, b) => a.label.localeCompare(b.label, 'ko')),
        ];
    }, [activeNodes]);

    // 선택 가능한 노드 항목 목록 (필터 조건 적용)
    const targetOptions = useMemo(() => {
        return activeNodes
            .filter((n) => selectedCountry === 'ALL' || n.country === selectedCountry)
            .filter((n) => selectedNodeType === 'ALL' || n.type === selectedNodeType)
            .map((n) => {
                const countryStr = getCountryDisplayName(n.country);
                const typeStr = getNodeTypeLabel(n.type);
                const labelSuffix = n.country === 'NA' ? typeStr : `${countryStr}, ${typeStr}`;
                return {
                    id: n.id,
                    label: `${n.name} (${labelSuffix})`,
                };
            });
    }, [activeNodes, selectedCountry, selectedNodeType]);

    // 결과 노드가 1개일 때 자동 선택 처리하는 이펙트
    useEffect(() => {
        if (currentDisruption.targetType === 'node' && targetOptions.length === 1) {
            const uniqueNode = targetOptions[0];
            if (currentDisruption.targetId !== uniqueNode.id) {
                setTargetId(uniqueNode.id);
            }
        }
    }, [targetOptions, currentDisruption.targetType, currentDisruption.targetId, setTargetId]);

    // 엣지의 출발 노드로 존재하는 노드들의 유니크 목록
    const sourceNodeOptions = useMemo(() => {
        const sourceIds = Array.from(new Set(edges.map((e) => e.sourceNodeId)));
        return sourceIds
            .map((id) => activeNodes.find((n) => n.id === id)) // 매장자원은 배제된 activeNodes 기준
            .filter((n): n is Exclude<typeof n, undefined> => !!n)
            .map((n) => ({
                id: n.id,
                label: `${n.name} (${getCountryDisplayName(n.country)})`,
            }))
            .sort((a, b) => a.label.localeCompare(b.label, 'ko'));
    }, [activeNodes, edges]);

    // 선택된 출발지 노드에서 출발하는 엣지 목록 (구조화 데이터로 관리)
    const targetEdgeOptions = useMemo(() => {
        if (selectedSourceNodeId === 'ALL') return [];
        return edges
            .filter((e) => e.sourceNodeId === selectedSourceNodeId)
            .map((e) => {
                const targetNode = nodes.find((n) => n.id === e.targetNodeId);
                const targetLabel = targetNode ? `${targetNode.name} (${getCountryDisplayName(targetNode.country)})` : e.targetNodeId;
                return {
                    edgeId: e.id,
                    targetLabel,
                    volume: e.attributes.volume ?? 0,
                };
            });
    }, [nodes, edges, selectedSourceNodeId]);

    // 도착지 경로가 1개일 때 자동 선택 처리하는 이펙트
    useEffect(() => {
        if (currentDisruption.targetType === 'edge' && targetEdgeOptions.length === 1) {
            const uniqueEdge = targetEdgeOptions[0];
            if (currentDisruption.targetId !== uniqueEdge.edgeId) {
                setTargetId(uniqueEdge.edgeId);
            }
        }
    }, [targetEdgeOptions, currentDisruption.targetType, currentDisruption.targetId, setTargetId]);

    // 현재 선택된 엣지 정보 조회
    const selectedEdge = useMemo(() => {
        if (currentDisruption.targetType !== 'edge' || !currentDisruption.targetId) return null;
        return edges.find((e) => e.id === currentDisruption.targetId);
    }, [edges, currentDisruption.targetType, currentDisruption.targetId]);

    // 컴포넌트 마운트 시(시뮬레이션 모드 진입 시) 글로벌 필터 전체 선택 처리
    useEffect(() => {
        setFilters({
            hsCode: ['2530.90', '2836.91', '2825.20'],
            countries: ['SouthKorea', 'China', 'Chile', 'UnitedStates', 'Japan', 'Argentina', 'Australia'],
        });
    }, [setFilters]);

    // 충격 추가 핸들러
    const handleAddDisruption = useCallback(() => {
        addDisruption();
    }, [addDisruption]);

    // 시뮬레이션 실행 핸들러 (실행 시 모든 품목 및 국가 필터를 전체 활성화하여 데이터 정합성 보장)
    const handleRunSimulation = useCallback(() => {
        setFilters({
            hsCode: ['2530.90', '2836.91', '2825.20'],
            countries: ['SouthKorea', 'China', 'Chile', 'UnitedStates', 'Japan', 'Argentina', 'Australia'],
        });
        runSimulation();
    }, [runSimulation, setFilters]);

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
        <div
            className="absolute top-0 left-0 h-full flex font-sans z-[5] pointer-events-none"
            role="region"
            aria-label="시뮬레이션 제어 패널 그룹"
        >
            {/* 1열: 시뮬레이션 설정 및 입력 폼 */}
            <aside
                className="w-[380px] h-full bg-white border-r border-slate-200 p-4 pr-2 shadow-md flex flex-col pointer-events-auto relative"
                aria-label="시뮬레이션 입력 및 설정 제어"
            >
                {/* 헤더 */}
                <h2 className="text-base font-bold text-slate-900 mb-2 tracking-tight flex items-center justify-between pr-4">
                    시뮬레이션 제어
                </h2>

                <div className="flex-1 min-h-0 overflow-y-auto space-y-3 p-1">
                    {/* 시나리오 구성 UI */}
                    <Card className="border border-slate-150 bg-slate-50/50 shadow-sm mb-3">
                        <CardHeader className="p-2.5 pb-0">
                            <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                충격 시나리오 구성
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-2.5 pt-2">
                            {/* 대상 유형 선택 */}
                            <div className="mb-2">
                                <label
                                    htmlFor="sim-target-type"
                                    className="block text-[11px] font-medium text-slate-600 mb-1"
                                >
                                    대상 유형
                                </label>
                                <Select
                                    value={currentDisruption.targetType}
                                    onValueChange={(val) => {
                                        setTargetType(val as 'node' | 'edge');
                                        setTargetId('');
                                        setSelectedCountry('ALL');
                                        setSelectedNodeType('ALL');
                                        setSelectedSourceNodeId('ALL');
                                    }}
                                >
                                    <SelectTrigger id="sim-target-type" size="sm" className="w-full bg-white border border-slate-200 text-[11px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent position="popper">
                                        <SelectItem value="node">시설 (노드)</SelectItem>
                                        <SelectItem value="edge">경로 (엣지)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* 대상 지정 선택 */}
                            <div className="mb-2">
                                <label
                                    htmlFor="sim-target-id"
                                    className="block text-[11px] font-medium text-slate-600 mb-1"
                                >
                                    {currentDisruption.targetType === 'node' ? '대상 시설 (노드)' : '대상 경로 (엣지)'}
                                </label>

                                {/* 노드 타겟팅 활성화 및 국가/시설유형 가로 필터 렌더링 */}
                                {currentDisruption.targetType === 'node' && (
                                    <div className="flex gap-2 mb-1.5">
                                        <div className="flex-1">
                                            <Select
                                                value={selectedCountry}
                                                onValueChange={(val) => {
                                                    setSelectedCountry(val);
                                                    setTargetId('');
                                                }}
                                            >
                                                <SelectTrigger
                                                    size="sm"
                                                    className="w-full bg-white border border-slate-200 text-[11px]">
                                                    <SelectValue placeholder="국가 필터" />
                                                </SelectTrigger>
                                                <SelectContent position="popper">
                                                    {countryOptions.map((opt) => (
                                                        <SelectItem key={opt.value} value={opt.value}>
                                                            {opt.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="flex-1">
                                            <Select
                                                value={selectedNodeType}
                                                onValueChange={(val) => {
                                                    setSelectedNodeType(val);
                                                    setTargetId('');
                                                }}
                                            >
                                                <SelectTrigger size="sm" className="w-full bg-white border border-slate-200 text-[11px]">
                                                    <SelectValue placeholder="시설 종류 필터" />
                                                </SelectTrigger>
                                                <SelectContent position="popper">
                                                    {nodeTypeOptions.map((opt) => (
                                                        <SelectItem key={opt.value} value={opt.value}>
                                                            {opt.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                )}

                                {/* [분기 1] 노드 타겟팅일 때의 노드 선택 UI */}
                                {currentDisruption.targetType === 'node' && (
                                    <>
                                        {targetOptions.length === 1 ? (
                                            <div className="p-2 bg-slate-50 border border-slate-200 rounded-md text-xs font-semibold text-slate-800 shadow-xs">
                                                <span className="truncate">{targetOptions[0].label}</span>
                                            </div>
                                        ) : targetOptions.length === 0 ? (
                                            <div className="p-2 bg-red-50/50 border border-red-150 rounded-md text-xs font-semibold text-red-600 flex items-center gap-1.5">
                                                <span>⚠ 조건에 일치하는 시설이 없습니다.</span>
                                            </div>
                                        ) : (
                                            <Select
                                                value={currentDisruption.targetId}
                                                onValueChange={(val) => setTargetId(val)}
                                            >
                                                <SelectTrigger id="sim-target-id" size="sm" className="w-full bg-white border border-slate-200 text-[11px]">
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
                                        )}
                                    </>
                                )}

                                {/* [분기 2] 엣지 타겟팅일 때의 출발지 -> 도착지 다단계 필터 UI */}
                                {currentDisruption.targetType === 'edge' && (
                                    <div className="space-y-2">
                                        {/* 1. 출발 시설 선택 */}
                                        <div>
                                            <Select
                                                value={selectedSourceNodeId}
                                                onValueChange={(val) => {
                                                    setSelectedSourceNodeId(val);
                                                    setTargetId('');
                                                }}
                                            >
                                                <SelectTrigger size="sm" className="w-full bg-white border border-slate-200 text-[11px]">
                                                    <SelectValue placeholder="-- 출발 시설 선택 --" />
                                                </SelectTrigger>
                                                <SelectContent position="popper">
                                                    <SelectItem value="ALL">-- 출발 시설 선택 --</SelectItem>
                                                    {sourceNodeOptions.map((opt) => (
                                                        <SelectItem key={opt.id} value={opt.id}>
                                                            {opt.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* 2. 도착 시설(최종 엣지) 선택 */}
                                        <div>
                                            {selectedSourceNodeId === 'ALL' ? (
                                                <div className="p-2 bg-slate-50 border border-slate-200 border-dashed rounded-md text-[11px] text-slate-400 text-center">
                                                    출발 시설을 먼저 선택해주세요.
                                                </div>
                                            ) : targetEdgeOptions.length === 0 ? (
                                                <div className="p-2 bg-red-50/30 border border-red-100 rounded-md text-[11px] text-red-500 text-center">
                                                    출발하는 경로가 존재하지 않습니다.
                                                </div>
                                            ) : targetEdgeOptions.length === 1 ? (
                                                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-md text-xs font-semibold text-slate-800 shadow-xs flex items-center justify-between w-full overflow-hidden min-w-0">
                                                    <span className="truncate flex-1 min-w-0 text-left">➔ {targetEdgeOptions[0].targetLabel}</span>
                                                </div>
                                            ) : (
                                                <Select
                                                    value={currentDisruption.targetId}
                                                    onValueChange={(val) => setTargetId(val)}
                                                >
                                                    <SelectTrigger size="sm" className="w-full bg-white border border-slate-200 text-[11px] overflow-hidden max-w-[328px] min-w-0">
                                                        <SelectValue placeholder="-- 도착 시설(경로) 선택 --" />
                                                    </SelectTrigger>
                                                    <SelectContent position="popper" className="max-w-[328px] w-full">
                                                        {targetEdgeOptions.map((opt) => (
                                                            <SelectItem key={opt.edgeId} value={opt.edgeId} className="w-full overflow-hidden">
                                                                <span className="truncate flex-1 min-w-0 text-left">➔ {opt.targetLabel}</span>
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        </div>

                                        {/* 선택된 엣지의 수송 물량을 하단에 기울임꼴로 표시 */}
                                        {selectedEdge && (
                                            <div className="text-[11px] text-slate-400 mt-1 font-normal italic">
                                                * 해당 경로 수송 물량: {selectedEdge.attributes.volume ?? 0}t
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* 충격 유형 선택 */}
                            <div className="mb-2">
                                <label
                                    htmlFor="sim-disruption-type"
                                    className="block text-[11px] font-medium text-slate-600 mb-1"
                                >
                                    충격 유형
                                </label>
                                <Select
                                    value={currentDisruption.disruptionType}
                                    onValueChange={handleDisruptionTypeChange}
                                >
                                    <SelectTrigger id="sim-disruption-type" size="sm" className="w-full bg-white border border-slate-200 text-[11px]">
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
                                    <div className="mb-3">
                                        <label
                                            htmlFor="sim-severity"
                                            className="block text-[11px] font-medium text-slate-600 mb-1"
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
                                            className="py-1"
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
                                size="sm"
                                className="w-full h-8 text-xs font-semibold"
                                aria-label="충격 이벤트 추가"
                            >
                                + 충격 이벤트 추가
                            </Button>
                        </CardContent>
                    </Card>


                    {/* 시나리오 프리셋 */}
                    <Card className="border border-slate-150 bg-slate-50/50 shadow-sm mb-4">
                        <CardHeader className="p-3.5 pb-0">
                            <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                시나리오 프리셋
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-3.5 pt-3">
                            <div className="space-y-2">
                                {SCENARIO_PRESETS.map((preset) => {
                                    const isSelected = currentDisruption.disruptionType === preset.config.disruptionType &&
                                        currentDisruption.targetType === preset.config.targetType &&
                                        currentDisruption.targetId === preset.config.targetId &&
                                        Math.abs(currentDisruption.severity - preset.config.severity) < 0.01;

                                    return (
                                        <button
                                            key={preset.id}
                                            onClick={() => handleApplyPreset(preset)}
                                            className={`w-full text-left p-2 rounded-md border transition-all duration-200 cursor-pointer ${isSelected
                                                ? 'bg-slate-100 border-slate-400 shadow-xs'
                                                : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 hover:shadow-xs'
                                                }`}
                                            aria-label={`프리셋 적용: ${preset.name}`}
                                        >
                                            <div className="text-xs font-bold text-slate-800 mb-1 leading-tight">
                                                {preset.name}
                                            </div>
                                            <div className="text-[10px] text-slate-500 font-normal leading-none">
                                                {preset.config.targetType === 'node'
                                                    ? (preset.config.country === 'ALL'
                                                        ? '모든 국가'
                                                        : `${getCountryDisplayName(preset.config.country || '')} ${getNodeTypeLabel(preset.config.nodeType || '')}`)
                                                    : (preset.config.sourceNodeId === 'M-04'
                                                        ? '호주 광산 ➔ 중국 제련소'
                                                        : '경로 선택됨')
                                                }
                                                {' • '}
                                                {DISRUPTION_TYPE_CONFIGS[preset.config.disruptionType]?.label}
                                                {' • '}
                                                {DISRUPTION_TYPE_CONFIGS[preset.config.disruptionType]?.formatValue(preset.config.severity)}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
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
                </div>

            </aside>

            {/* 2열: 시뮬레이션 결과 요약 및 이력 */}
            <aside
                className={`h-full bg-slate-50 border-r border-slate-200 shadow-lg flex flex-col pointer-events-auto transition-all duration-300 ease-in-out ${isSecondColumnOpen ? 'w-[380px] opacity-100 border-l border-slate-200' : 'w-0 opacity-0 overflow-hidden border-l-0'
                    }`}
                aria-label="시뮬레이션 결과 및 이력"
            >
                <div className="w-[380px] h-full p-4 flex flex-col space-y-3">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                            시뮬레이션 결과 및 이력
                        </h3>
                    </div>

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
                </div>
            </aside>

            {/* 2열 슬라이드 아웃 토글 버튼 - 항상 현재 활성화된 패널의 가장 우측 경계에 붙도록 절대 위치 동적 연동 */}
            {(historyEntries.length > 0 || result) && (
                <button
                    onClick={() => setIsSecondColumnOpen(!isSecondColumnOpen)}
                    className="absolute top-1/2 -translate-y-1/2 w-6 h-12 bg-white hover:bg-slate-50 border border-slate-200 border-l-0 rounded-r-md shadow-md z-10 flex items-center justify-center cursor-pointer pointer-events-auto text-slate-500 hover:text-slate-700 transition-all duration-300 ease-in-out"
                    style={{ left: isSecondColumnOpen ? '779px' : '399px' }}
                    title={isSecondColumnOpen ? "결과/이력 패널 접기" : "결과/이력 패널 펼치기"}
                    aria-label={isSecondColumnOpen ? "결과/이력 패널 접기" : "결과/이력 패널 펼치기"}
                >
                    {isSecondColumnOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
            )}
        </div>
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
            className="border border-emerald-100 bg-emerald-50/15 flex-1 min-h-0 flex flex-col shadow-xs"
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
            <CardContent className="p-3.5 pt-3 flex-1 min-h-0 flex flex-col">
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
                    <div className="border border-slate-100 rounded-md bg-white shadow-xs flex-1 min-h-0 overflow-y-auto">
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
        <Card className="border border-slate-150 bg-slate-50/50 flex flex-col h-[40%] min-h-[200px] shadow-sm">
            <CardHeader className="p-3.5 pb-0">
                <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    시뮬레이션 이력 ({entries.length})
                </CardTitle>
            </CardHeader>
            <CardContent className="p-3.5 pt-3 flex-1 min-h-0 flex flex-col">
                {isLoading && (
                    <div className="text-xs text-slate-400 mb-2 flex items-center gap-1.5">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse"></span>
                        이력 로드 중...
                    </div>
                )}

                <ul
                    className="m-0 p-0 list-none flex-1 min-h-0 overflow-y-auto space-y-1"
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
