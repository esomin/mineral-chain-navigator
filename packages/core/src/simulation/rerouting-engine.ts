/**
 * 대체 공급망 자동 추천 및 경로 재설정 엔진 (Re-routing Engine)
 */

import type {
    SupplyChainNode,
    SupplyChainEdge,
    SimulationResult,
    ReroutingResult,
    ReroutingOption,
    ReroutingProposalPlan,
    OptimizationCriterion,
    LogisticsInfo,
} from '@navigator/shared';

/** 두 지점 간의 하버사인(Haversine) 최단 거리(km) 계산 */
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // 지구 반지름 (km)
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.max(10, Math.round(R * c));
}

/**
 * 시뮬레이션 결과 및 그래프 데이터를 기반으로 대체 우회 공급망 경로 옵션을 자동 산출한다.
 * 1안(비용 우선), 2안(운송시간 우선), 3안(밸런스) 플랜을 포함한다.
 */
export function computeReroutingOptions(
    simulationResult: SimulationResult,
    allNodes: SupplyChainNode[],
    allEdges: SupplyChainEdge[],
    defaultCriterion: OptimizationCriterion = 'balanced',
): ReroutingResult[] {
    const results: ReroutingResult[] = [];
    const nodeMap = new Map(allNodes.map((n) => [n.id, n]));

    // 차질이 발생한 노드 (deficitPercentage > 0) 감지
    const deficitItems = (simulationResult.deficits || []).filter((d) => d.deficitPercentage > 0);

    if (deficitItems.length === 0) {
        return results;
    }

    for (const deficit of deficitItems) {
        const targetNode = nodeMap.get(deficit.nodeId);
        if (!targetNode) continue;

        // 결손 노드로 들어오는 엣지들 및 HS 코드
        const incomingEdges = allEdges.filter((e) => e.targetNodeId === targetNode.id);
        const incomingHsCodes = new Set(incomingEdges.map((e) => e.attributes?.hsCode).filter(Boolean));

        // 대체 가능 후보 노드 스크리닝
        const candidates = allNodes.filter((candidate) => {
            if (candidate.id === targetNode.id) return false;
            if (candidate.type === 'Resource') return false;

            if (targetNode.type === 'Factory') {
                if (candidate.type !== 'Refinery') return false;
            } else if (targetNode.type === 'Refinery') {
                if (candidate.type !== 'Mine') return false;
            } else if (targetNode.type === 'Mine') {
                if (candidate.type !== 'Mine') return false;
            }

            // 시뮬레이션 차질(부족률 30% 이상 또는 공급 0) 노드는 제외
            const candidateDeficit = simulationResult.deficits.find((d) => d.nodeId === candidate.id);
            if (candidateDeficit && (candidateDeficit.deficitPercentage >= 30 || candidateDeficit.disruptedSupply === 0)) {
                return false;
            }

            return true;
        });

        if (candidates.length === 0) continue;

        // 기준(criterion)별 ReroutingProposalPlan 산출 함수
        const buildPlan = (
            crit: OptimizationCriterion,
            planNum: 1 | 2 | 3,
            title: string,
        ): ReroutingProposalPlan | null => {
            interface CandidateEvaluation {
                candidateNode: SupplyChainNode;
                hsCode: string;
                logistics: LogisticsInfo;
                costPerTon: number;
                leadTimeDays: number;
                transportType: string;
                score: number;
                existingEdgeId?: string;
            }

            const evaluated: CandidateEvaluation[] = [];

            for (const candidate of candidates) {
                const existingEdge = allEdges.find(
                    (e) => e.sourceNodeId === candidate.id && e.targetNodeId === targetNode.id,
                );

                const hsCode = (existingEdge?.attributes?.hsCode as string) || Array.from(incomingHsCodes)[0] || (targetNode.type === 'Factory' ? '2825.20' : '2530.90');
                const existingLogistics = existingEdge?.attributes?.logisticsInfo as LogisticsInfo | undefined;

                const isSameCountry = candidate.country === targetNode.country;
                const distKm = calculateDistanceKm(
                    candidate.coordinates.latitude, candidate.coordinates.longitude,
                    targetNode.coordinates.latitude, targetNode.coordinates.longitude,
                );

                const transportType = existingLogistics?.transportMode || (isSameCountry ? 'Road' : 'Maritime');
                const leadTimeDays = existingLogistics?.totalLeadTimeDays || (
                    isSameCountry
                        ? Math.max(0.4, Math.round((distKm / 350) * 10) / 10)
                        : Math.round((distKm / 700 + 2.5) * 10) / 10
                );

                const costPerTon = existingLogistics?.freightCostUsdPerTon || (
                    isSameCountry
                        ? Math.round(20 + distKm * 0.06)
                        : Math.round(45 + (distKm / 1000) * 5.2)
                );

                let wCost = 0.5;
                let wTime = 0.5;
                if (crit === 'cost') {
                    wCost = 0.85;
                    wTime = 0.15;
                } else if (crit === 'leadTime') {
                    wCost = 0.15;
                    wTime = 0.85;
                }

                const normCost = costPerTon / 200;
                const normTime = leadTimeDays / 30;
                const score = wCost * normCost + wTime * normTime;

                evaluated.push({
                    candidateNode: candidate,
                    hsCode,
                    logistics: existingLogistics || {
                        transportMode: transportType,
                        distanceKm: distKm,
                        leadTimeDays,
                        customsDelayDays: isSameCountry ? 0 : 2.0,
                        totalLeadTimeDays: leadTimeDays,
                        freightCostUsdPerTon: costPerTon,
                    },
                    costPerTon,
                    leadTimeDays,
                    transportType,
                    score,
                    existingEdgeId: existingEdge?.id,
                });
            }

            evaluated.sort((a, b) => a.score - b.score);
            const topCandidates = evaluated.slice(0, 2);
            if (topCandidates.length === 0) return null;

            const totalDeficitPercentage = deficit.deficitPercentage;
            const capacity = Number(targetNode.metadata?.productionCapacity) || 50000;
            const defectQuantityTons = Math.round((capacity * totalDeficitPercentage) / 100);

            const allocations = topCandidates.length > 1 ? [0.7, 0.3] : [1.0];
            const options: ReroutingOption[] = [];
            let totalCoveredPercentage = 0;
            let weightedCostSum = 0;
            let weightedLeadTimeSum = 0;

            topCandidates.forEach((item, index) => {
                const ratio = allocations[index];
                const coveredDeficit = Math.round(totalDeficitPercentage * ratio * 10) / 10;
                const allocatedTons = Math.round(defectQuantityTons * ratio);

                totalCoveredPercentage += coveredDeficit;
                const totalExtraCost = Math.round(allocatedTons * item.costPerTon);

                weightedCostSum += totalExtraCost;
                weightedLeadTimeSum += item.leadTimeDays * ratio;

                options.push({
                    rank: index + 1,
                    sourceNodeId: item.candidateNode.id,
                    sourceName: item.candidateNode.name,
                    targetNodeId: targetNode.id,
                    targetName: targetNode.name,
                    allocatedVolumeTons: allocatedTons,
                    coveredDeficitPercentage: coveredDeficit,
                    costImpact: {
                        unitExtraCostUsd: item.costPerTon,
                        totalExtraCostUsd: totalExtraCost,
                    },
                    leadTimeImpact: {
                        baseDays: Math.round(item.leadTimeDays * 0.7),
                        additionalDays: Math.round(item.leadTimeDays * 0.3 * 10) / 10,
                        totalDays: item.leadTimeDays,
                    },
                    transportType: item.transportType,
                    hsCode: item.hsCode,
                    suggestedEdgeId: item.existingEdgeId || `REROUTE-${item.candidateNode.id}-${targetNode.id}`,
                });
            });

            const remainingDeficit = Math.max(0, Math.round((totalDeficitPercentage - totalCoveredPercentage) * 10) / 10);
            const avgLeadTime = Math.round(weightedLeadTimeSum * 10) / 10;

            return {
                planNumber: planNum,
                title,
                criterion: crit,
                coveredDeficitPercentage: Math.round(totalCoveredPercentage * 10) / 10,
                remainingDeficitPercentage: remainingDeficit,
                totalExtraCostUsd: weightedCostSum,
                averageExtraLeadTimeDays: avgLeadTime,
                options,
            };
        };

        const plan1 = buildPlan('cost', 1, '1안: 비용 우선');
        const plan2 = buildPlan('leadTime', 2, '2안: 운송시간 우선');
        const plan3 = buildPlan('balanced', 3, '3안: 밸런스');

        const plans: ReroutingProposalPlan[] = [plan1, plan2, plan3].filter(
            (p): p is ReroutingProposalPlan => p !== null,
        );

        if (plans.length === 0) continue;

        const defaultPlan = plans.find((p) => p.criterion === defaultCriterion) || plans[0];
        const capacity = Number(targetNode.metadata?.productionCapacity) || 50000;
        const defectQuantityTons = Math.round((capacity * deficit.deficitPercentage) / 100);

        results.push({
            simulationId: simulationResult.scenarioId,
            targetNodeId: targetNode.id,
            targetNodeName: targetNode.name,
            defectQuantityTons,
            originalDeficitPercentage: deficit.deficitPercentage,
            remainingDeficitPercentage: defaultPlan.remainingDeficitPercentage,
            totalExtraCostUsd: defaultPlan.totalExtraCostUsd,
            averageExtraLeadTimeDays: defaultPlan.averageExtraLeadTimeDays,
            criterion: defaultCriterion,
            options: defaultPlan.options,
            plans,
        });
    }

    // 차질 발생 노드가 존재하면 전역 통합 대체 시나리오(Global Combined Rerouting Result)를 생성하여 최상단에 배치
    if (results.length > 0) {
        const totalDisruptedTons = results.reduce((sum, r) => sum + r.defectQuantityTons, 0);
        const avgOriginalDeficit = Math.round((results.reduce((sum, r) => sum + r.originalDeficitPercentage, 0) / results.length) * 10) / 10;

        const criteria: OptimizationCriterion[] = ['cost', 'leadTime', 'balanced'];
        const planTitles: Record<OptimizationCriterion, string> = {
            cost: '1안: 비용 우선',
            leadTime: '2안: 운송시간 우선',
            balanced: '3안: 밸런스',
        };

        const globalPlans: ReroutingProposalPlan[] = ([1, 2, 3] as const).map((planNum) => {
            const crit = criteria[planNum - 1];
            let globalTotalExtraCost = 0;
            let weightedLeadTimeSum = 0;
            let globalRemainingDeficitSum = 0;

            const supplierMap = new Map<string, ReroutingOption>();

            results.forEach((nodeResult) => {
                const plan = nodeResult.plans?.find((p) => p.planNumber === planNum) || nodeResult.plans?.[0];
                if (!plan) return;

                globalTotalExtraCost += plan.totalExtraCostUsd;
                weightedLeadTimeSum += plan.averageExtraLeadTimeDays * (nodeResult.defectQuantityTons || 1);
                globalRemainingDeficitSum += plan.remainingDeficitPercentage;

                plan.options.forEach((opt) => {
                    const existing = supplierMap.get(opt.sourceNodeId);
                    if (existing) {
                        existing.allocatedVolumeTons += opt.allocatedVolumeTons;
                        existing.costImpact.totalExtraCostUsd += opt.costImpact.totalExtraCostUsd;
                    } else {
                        supplierMap.set(opt.sourceNodeId, {
                            ...opt,
                            targetNodeId: opt.targetNodeId,
                            costImpact: { ...opt.costImpact },
                            leadTimeImpact: { ...opt.leadTimeImpact },
                        });
                    }
                });
            });

            const mergedOptions = Array.from(supplierMap.values());
            mergedOptions.sort((a, b) => b.allocatedVolumeTons - a.allocatedVolumeTons);
            mergedOptions.forEach((opt, idx) => {
                opt.rank = idx + 1;
                opt.coveredDeficitPercentage = totalDisruptedTons > 0
                    ? Math.round((opt.allocatedVolumeTons / totalDisruptedTons) * avgOriginalDeficit * 10) / 10
                    : 0;
            });

            const avgRemainingDeficit = Math.round((globalRemainingDeficitSum / results.length) * 10) / 10;
            const avgGlobalLeadTime = totalDisruptedTons > 0
                ? Math.round((weightedLeadTimeSum / totalDisruptedTons) * 10) / 10
                : 0;

            return {
                planNumber: planNum,
                title: planTitles[crit],
                criterion: crit,
                coveredDeficitPercentage: Math.max(0, Math.round((avgOriginalDeficit - avgRemainingDeficit) * 10) / 10),
                remainingDeficitPercentage: avgRemainingDeficit,
                totalExtraCostUsd: globalTotalExtraCost,
                averageExtraLeadTimeDays: avgGlobalLeadTime,
                options: mergedOptions,
            };
        });

        const defaultGlobalPlan = globalPlans.find((p) => p.criterion === defaultCriterion) || globalPlans[0];

        const globalCombinedResult: ReroutingResult = {
            simulationId: simulationResult.scenarioId,
            targetNodeId: 'GLOBAL_TOTAL',
            targetNodeName: `전체 통합 (${results.length}개 노드)`,
            isGlobalCombined: true,
            defectQuantityTons: totalDisruptedTons,
            originalDeficitPercentage: avgOriginalDeficit,
            remainingDeficitPercentage: defaultGlobalPlan.remainingDeficitPercentage,
            totalExtraCostUsd: defaultGlobalPlan.totalExtraCostUsd,
            averageExtraLeadTimeDays: defaultGlobalPlan.averageExtraLeadTimeDays,
            criterion: defaultCriterion,
            options: defaultGlobalPlan.options,
            plans: globalPlans,
        };

        results.unshift(globalCombinedResult);
    }

    return results;
}
