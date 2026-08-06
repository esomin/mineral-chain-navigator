import React from 'react';
import type { ReroutingResult } from '@navigator/shared';
import { useSimulationStore } from '../../store/simulation-store';
import { Route, ShieldCheck, Clock, DollarSign, Loader2, CheckCircle2, TrendingUp } from 'lucide-react';

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

    if (isRerouteLoading) {
        const maxDeficit = reroutingResults.length > 0 ? reroutingResults[0].originalDeficitPercentage : 50;
        return (
            <div className="relative mt-3 p-6 bg-card/80 backdrop-blur-sm border border-border rounded-lg shadow-sm flex flex-col items-center justify-center text-center space-y-3 min-h-[160px]">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
                <div className="space-y-1">
                    <p className="text-xs font-bold text-foreground">대체 공급망 최적화 계산 중</p>
                    <p className="text-[11px] text-muted-foreground">
                        부족률 {maxDeficit}% 해소를 위한 대체 정제소 및 우회 물류 경로를 계산 중입니다...
                    </p>
                </div>
            </div>
        );
    }

    if (!isRerouteApplied || !reroutingResults || reroutingResults.length === 0) {
        return null;
    }

    const mainResult = reroutingResults[0];
    const plans = mainResult.plans || [];

    // 활성화된 플랜 (1안, 2안, 3안 중 선택된 안)
    const currentPlanIndex = (selectedPlanNumber >= 1 && selectedPlanNumber <= plans.length) ? selectedPlanNumber - 1 : 0;
    const currentPlan = plans[currentPlanIndex] || {
        planNumber: 1,
        title: '1안: 비용 우선',
        criterion: 'cost',
        coveredDeficitPercentage: mainResult.originalDeficitPercentage - mainResult.remainingDeficitPercentage,
        remainingDeficitPercentage: mainResult.remainingDeficitPercentage,
        totalExtraCostUsd: mainResult.totalExtraCostUsd,
        averageExtraLeadTimeDays: mainResult.averageExtraLeadTimeDays,
        options: mainResult.options,
    };

    return (
        <div className="mt-3 p-3.5 bg-card border border-border rounded-lg shadow-xs text-xs space-y-3 text-foreground">
            {/* 헤더 */}
            <div className="flex items-center justify-between pb-2 border-b border-border">
                <div className="flex items-center gap-1.5 font-bold text-xs text-primary">
                    <Route className="w-4 h-4 text-primary" />
                    <span>대체 공급망 시나리오 추천 ({mainResult.targetNodeName})</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>그래프 자동 반영 중</span>
                </div>
            </div>

            {/* 1안 / 2안 / 3안 시나리오 선택 탭 */}
            {plans.length > 0 && (
                <div className="grid grid-cols-3 gap-1.5">
                    {plans.map((p) => {
                        const isSelected = p.planNumber === selectedPlanNumber;
                        return (
                            <button
                                key={p.planNumber}
                                type="button"
                                onClick={() => setSelectedPlanNumber(p.planNumber)}
                                className={`p-2 rounded-md border text-left transition-all cursor-pointer flex flex-col justify-between ${
                                    isSelected
                                        ? 'bg-primary/10 border-primary text-primary font-bold shadow-xs'
                                        : 'bg-muted/30 border-border/60 text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                                }`}
                            >
                                <div className="text-[11px] font-bold truncate">
                                    {p.planNumber}안 ({p.criterion === 'cost' ? '비용 우선' : p.criterion === 'leadTime' ? '시간 우선' : '밸런스'})
                                </div>
                                <div className="text-[10px] opacity-80 mt-1 flex items-center justify-between">
                                    <span>+${(p.totalExtraCostUsd / 1000).toFixed(0)}k</span>
                                    <span>+{p.averageExtraLeadTimeDays}일</span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* 선택된 안의 세부 우회 물량 할당 항목들 */}
            <div className="space-y-2">
                {currentPlan.options.map((opt) => (
                    <div
                        key={`${opt.rank}-${opt.sourceNodeId}`}
                        className={`p-2.5 rounded-md border text-xs space-y-1.5 ${
                            opt.rank === 1
                                ? 'bg-emerald-950/20 border-emerald-800/40 text-foreground'
                                : 'bg-muted/30 border-border text-foreground'
                        }`}
                    >
                        <div className="font-semibold text-[11px] flex items-center gap-1.5 text-foreground">
                            <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                            <span>추천 {opt.rank}안: {opt.sourceName} 우회 물량 할당</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1 text-[10px] text-muted-foreground bg-background/50 p-1.5 rounded border border-border/40">
                            <div>
                                <span className="text-muted-foreground block text-[9px]">물량 배분</span>
                                <strong className="text-foreground font-semibold">{opt.allocatedVolumeTons.toLocaleString()}톤 ({opt.coveredDeficitPercentage}%p)</strong>
                            </div>
                            <div>
                                <span className="text-muted-foreground block text-[9px]">추가 단가</span>
                                <strong className="text-red-400 font-semibold">+${opt.costImpact.unitExtraCostUsd}/톤</strong>
                            </div>
                            <div>
                                <span className="text-muted-foreground block text-[9px]">리드타임</span>
                                <strong className="text-amber-400 font-semibold">+{opt.leadTimeImpact.additionalDays}일 (총 {opt.leadTimeImpact.totalDays}일)</strong>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* 최종 결과 요약 바 */}
            <div className="p-2.5 bg-card border border-border rounded-md flex items-center justify-between text-[11px] font-medium text-foreground">
                <div className="flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    <span>부족률 {mainResult.originalDeficitPercentage}% ➔ <strong className="text-emerald-400 font-bold">{currentPlan.remainingDeficitPercentage}%</strong> (완전 해소)</span>
                </div>
                <div className="flex items-center gap-2 text-[10px]">
                    <span className="flex items-center gap-0.5 text-red-400 font-bold">
                        <DollarSign className="w-3 h-3" />
                        +${currentPlan.totalExtraCostUsd.toLocaleString()}
                    </span>
                    <span className="text-border">|</span>
                    <span className="flex items-center gap-0.5 text-amber-400 font-bold">
                        <Clock className="w-3 h-3" />
                        +{currentPlan.averageExtraLeadTimeDays}일
                    </span>
                </div>
            </div>
        </div>
    );
};
