import React from 'react';
import type { ReroutingResult } from '@navigator/shared';
import { useSimulationStore } from '../../store/simulation-store';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Route, Loader2 } from 'lucide-react';

interface ReRoutingPanelProps {
    reroutingResults: ReroutingResult[];
}

export const ReRoutingPanel: React.FC<ReRoutingPanelProps> = ({
    reroutingResults,
}) => {
    const {
        isRerouteLoading,
        isRerouteApplied,
        selectedPlanNumber,
        setSelectedPlanNumber,
    } = useSimulationStore();

    const [selectedNodeId, setSelectedNodeId] = React.useState<string>('');

    // 결과 목록이 업데이트되면 기본 선택 노드(전체 통합 시나리오) 설정
    const firstNodeId = reroutingResults && reroutingResults.length > 0 ? reroutingResults[0].targetNodeId : '';
    const activeNodeId = selectedNodeId && reroutingResults.some((r) => r.targetNodeId === selectedNodeId)
        ? selectedNodeId
        : firstNodeId;

    if (isRerouteLoading) {
        const maxDeficit = reroutingResults.length > 0 ? reroutingResults[0].originalDeficitPercentage : 50;
        return (
            <Card className="border border-border bg-muted/40 shadow-sm shrink-0 min-h-[330px] flex flex-col justify-center items-center text-center p-4">
                <Loader2 className="w-5 h-5 text-primary animate-spin mb-2" />
                <div className="space-y-1">
                    <p className="text-xs font-bold text-foreground">대체 공급망 최적화 계산 중</p>
                    <p className="text-[11px] text-muted-foreground">
                        부족률 {maxDeficit}% 해소를 위한 대체 정제소 및 우회 물류 경로를 계산 중입니다...
                    </p>
                </div>
            </Card>
        );
    }

    if (!isRerouteApplied || !reroutingResults || reroutingResults.length === 0) {
        return null;
    }

    const activeResult = reroutingResults.find((r) => r.targetNodeId === activeNodeId) || reroutingResults[0];
    const plans = activeResult.plans || [];

    // 활성화된 플랜 (1안, 2안, 3안 중 선택된 안)
    const currentPlanIndex = (selectedPlanNumber >= 1 && selectedPlanNumber <= plans.length) ? selectedPlanNumber - 1 : 0;
    const currentPlan = plans[currentPlanIndex] || {
        planNumber: 1,
        title: '1안: 비용 우선',
        criterion: 'cost',
        coveredDeficitPercentage: activeResult.originalDeficitPercentage - activeResult.remainingDeficitPercentage,
        remainingDeficitPercentage: activeResult.remainingDeficitPercentage,
        totalExtraCostUsd: activeResult.totalExtraCostUsd,
        averageExtraLeadTimeDays: activeResult.averageExtraLeadTimeDays,
        options: activeResult.options,
    };

    return (
        <Card className="border border-border bg-muted/40 shadow-sm shrink-0 min-h-[360px] flex flex-col overflow-hidden text-xs text-foreground">
            {/* 1. 헤더 (타이틀 및 하단 노드 선택 드롭다운) */}
            <CardHeader className="p-3 pb-2 shrink-0 border-b border-border/40 flex flex-col space-y-1.5">
                <CardTitle className="text-xs font-bold text-primary flex items-center gap-1.5 truncate">
                    <Route className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="truncate">
                        {activeResult.isGlobalCombined
                            ? `전역 통합 대체 공급망 시나리오`
                            : `대체 공급망 시나리오 (${activeResult.targetNodeName})`}
                    </span>
                </CardTitle>

                {reroutingResults.length > 0 && (
                    <select
                        value={activeResult.targetNodeId}
                        onChange={(e) => setSelectedNodeId(e.target.value)}
                        className="w-full text-xs font-medium bg-background text-foreground border border-border/80 rounded px-2 py-1 outline-none cursor-pointer hover:border-primary transition-colors shrink-0"
                    >
                        {reroutingResults.map((r) => (
                            <option key={r.targetNodeId} value={r.targetNodeId}>
                                {r.isGlobalCombined ? '전체 통합 시나리오' : r.targetNodeName}
                            </option>
                        ))}
                    </select>
                )}
            </CardHeader>

            <CardContent className="p-3 pt-2.5 flex-1 min-h-0 flex flex-col overflow-y-auto space-y-2.5">
                {/* 2. 세그먼트 컨트롤 탭 (3안 밸런스 탭은 숨김 처리) */}
                {plans.length > 0 && (
                    <div className="flex bg-muted/60 p-0.5 rounded-md border border-border/50 text-[11px] shrink-0">
                        {plans
                            .filter((p) => p.planNumber !== 3 /* 3안(밸런스) 탭 숨김 처리 */)
                            .map((p) => {
                                const isSelected = p.planNumber === selectedPlanNumber;
                                const label = p.criterion === 'cost' ? '비용 우선' : p.criterion === 'leadTime' ? '시간 우선' : '밸런스';
                                return (
                                    <button
                                        key={p.planNumber}
                                        type="button"
                                        onClick={() => setSelectedPlanNumber(p.planNumber)}
                                        className={`flex-1 py-1 rounded text-center transition-all cursor-pointer ${isSelected
                                            ? 'bg-card text-primary font-bold shadow-xs border border-border/60'
                                            : 'text-muted-foreground hover:text-foreground'
                                            }`}
                                    >
                                        {p.planNumber}안 ({label})
                                    </button>
                                );
                            })}
                    </div>
                )}

                {/* 3. 플랫 리스트 구조 (내용 과다 시 카드 내부 스크롤) */}
                <div className="space-y-1.5 flex-1 min-h-0 overflow-y-auto">
                    {currentPlan.options.map((opt) => (
                        <div
                            key={`${opt.rank}-${opt.sourceNodeId}`}
                            className="p-2 rounded border-l-2 border-l-white border border-border/40 bg-card space-y-1 transition-colors"
                        >
                            <div className="flex items-center justify-between font-medium text-[11px] text-foreground">
                                <span className="truncate font-semibold">{opt.rank}차 수급: {opt.sourceName}</span>
                                <span className="font-bold text-primary shrink-0">
                                    {opt.allocatedVolumeTons.toLocaleString()}톤 ({opt.coveredDeficitPercentage}%p)
                                </span>
                            </div>
                            <div className="flex flex-col gap-0.5 text-[10px] text-muted-foreground">
                                <div>추가 단가 <strong className="text-emerald-400 font-medium">+${opt.costImpact.unitExtraCostUsd}/톤</strong></div>
                                <div>리드타임 <strong className="text-emerald-400 font-medium">+{opt.leadTimeImpact.additionalDays}일</strong> (총 {opt.leadTimeImpact.totalDays}일)</div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* 4. 하단 요약 인라인 레이아웃 */}
                <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground shrink-0">
                    <div className="flex items-center gap-1.5 font-semibold text-foreground">
                        <span className="text-emerald-400">+${currentPlan.totalExtraCostUsd.toLocaleString()}</span>
                        <span>•</span>
                        <span className="text-emerald-400">+{currentPlan.averageExtraLeadTimeDays}일</span>
                    </div>
                    <div>
                        {activeResult.isGlobalCombined ? '평균 부족률' : '부족률'} <strong className="text-foreground">{activeResult.originalDeficitPercentage}%</strong> ➔ <strong className="text-primary font-bold">{currentPlan.remainingDeficitPercentage}%</strong>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
