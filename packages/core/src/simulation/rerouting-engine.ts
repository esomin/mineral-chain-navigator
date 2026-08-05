/**
 * 대체 공급망 자동 추천 및 경로 재설정 엔진 (Re-routing Engine)
 */

import type {
    SupplyChainNode,
    SupplyChainEdge,
    SimulationResult,
    ReroutingResult,
    ReroutingOption,
    OptimizationCriterion,
    LogisticsInfo,
} from '@navigator/shared';

/**
 * 시뮬레이션 결과 및 그래프 데이터를 기반으로 대체 우회 공급망 경로 옵션을 자동 산출한다.
 */
export function computeReroutingOptions(
    simulationResult: SimulationResult,
    allNodes: SupplyChainNode[],
    allEdges: SupplyChainEdge[],
    criterion: OptimizationCriterion = 'balanced',
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

        // 결손 노드로 들어오는 엣지들
        const incomingEdges = allEdges.filter((e) => e.targetNodeId === targetNode.id);
        const incomingHsCodes = new Set(incomingEdges.map((e) => e.attributes.hsCode).filter(Boolean));
        const currentSupplierIds = new Set(incomingEdges.map((e) => e.sourceNodeId));

        // 대체 가능 후보 노드 스크리닝
        // 규칙: 타겟 노드와 다른 아이디, 자원이 아니며, 동일/상위 단계 노드 타입이거나 유효한 공급 능력을 지닌 노드
        const candidates = allNodes.filter((n) => {
            if (n.id === targetNode.id) return false;
            if (n.type === 'Resource') return false;
            // 타겟 노드가 Factory이면 Refinery 또는 Factory가 후보
            if (targetNode.type === 'Factory' && n.type !== 'Refinery' && n.type !== 'Mine') return false;
            if (targetNode.type === 'Refinery' && n.type !== 'Mine') return false;

            // 시뮬레이션 차질(심각도 > 0.8 또는 결손 100%) 노드는 제외
            const nodeDeficit = simulationResult.deficits.find((d) => d.nodeId === n.id);
            if (nodeDeficit && nodeDeficit.deficitPercentage >= 90) {
                return false;
            }

            return true;
        });

        if (candidates.length === 0) continue;

        // 후보 노드별 물류 및 비용 점수 산출
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
            // 기존 연결 엣지 확인
            const existingEdge = allEdges.find(
                (e) => e.sourceNodeId === candidate.id && e.targetNodeId === targetNode.id,
            );

            // HS 코드 결정
            let hsCode = existingEdge?.attributes?.hsCode || Array.from(incomingHsCodes)[0] || '2825.20';

            // 물류 정보 추정 또는 로드
            const existingLogistics = existingEdge?.attributes?.logisticsInfo as LogisticsInfo | undefined;
            const transportType = existingLogistics?.transportMode || (candidate.country === targetNode.country ? 'Road' : 'Maritime');

            // 기본 운임 및 리드타임 추정 (지리적 관계 기반)
            const isSameCountry = candidate.country === targetNode.country;
            const leadTimeDays = existingLogistics?.totalLeadTimeDays || (isSameCountry ? 1.5 : 14.0);
            const costPerTon = existingLogistics?.freightCostUsdPerTon || (isSameCountry ? 35.0 : 120.0);

            // 가중치 산출 (기준별)
            let wCost = 0.5;
            let wTime = 0.5;
            if (criterion === 'cost') {
                wCost = 0.8;
                wTime = 0.2;
            } else if (criterion === 'leadTime') {
                wCost = 0.2;
                wTime = 0.8;
            }

            // 점수 낮을수록 우수 (Normalized Rank Score)
            const score = wCost * (costPerTon / 100) + wTime * (leadTimeDays / 5);

            evaluated.push({
                candidateNode: candidate,
                hsCode,
                logistics: existingLogistics || {
                    transportMode: transportType,
                    distanceKm: isSameCountry ? 200 : 8000,
                    leadTimeDays,
                    customsDelayDays: isSameCountry ? 0 : 2,
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

        // 점수 순 정렬
        evaluated.sort((a, b) => a.score - b.score);

        // 상위 2개 후보 선택 및 물량 배분
        const topCandidates = evaluated.slice(0, 2);
        if (topCandidates.length === 0) continue;

        const totalDeficitPercentage = deficit.deficitPercentage; // 예: 50%
        // 결손 톤수 계산 (기본 생산능력 또는 1000톤 기준)
        const nodeCapacity = Number(targetNode.metadata?.productionCapacity) || 1000;
        const defectQuantityTons = Math.round((nodeCapacity * totalDeficitPercentage) / 100);

        // 물량 배분 비율 (후보가 2개인 경우 70:30, 1개인 경우 100)
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

        results.push({
            simulationId: simulationResult.scenarioId,
            targetNodeId: targetNode.id,
            targetNodeName: targetNode.name,
            defectQuantityTons,
            originalDeficitPercentage: totalDeficitPercentage,
            remainingDeficitPercentage: remainingDeficit,
            totalExtraCostUsd: weightedCostSum,
            averageExtraLeadTimeDays: avgLeadTime,
            criterion,
            options,
        });
    }

    return results;
}
