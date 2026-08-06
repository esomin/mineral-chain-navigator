/**
 * 대체 공급망 자동 추천 및 경로 재설정 파사드 엔진 (Re-routing Engine Facade)
 */

import type {
    SupplyChainNode,
    SupplyChainEdge,
    SimulationResult,
    ReroutingResult,
    OptimizationCriterion,
} from '@navigator/shared';

import { computeIndividualReroutingOptions } from './individual-rerouting-engine.js';
import { computeGlobalReroutingOption } from './global-rerouting-engine.js';

export { computeIndividualReroutingOptions } from './individual-rerouting-engine.js';
export { computeGlobalReroutingOption } from './global-rerouting-engine.js';

/**
 * 시뮬레이션 결과 및 그래프 데이터를 기반으로 대체 우회 공급망 경로 옵션을 자동 산출한다.
 * 개별 노드별 시나리오를 산출하고, 이를 바탕으로 최상단 전역 통합 시나리오(GLOBAL_TOTAL)를 합성한다.
 */
export function computeReroutingOptions(
    simulationResult: SimulationResult,
    allNodes: SupplyChainNode[],
    allEdges: SupplyChainEdge[],
    defaultCriterion: OptimizationCriterion = 'balanced',
): ReroutingResult[] {
    // 1. 개별 차질 노드별 시나리오 산출 (개별 노드 엔진 모듈)
    const individualResults = computeIndividualReroutingOptions(
        simulationResult,
        allNodes,
        allEdges,
        defaultCriterion,
    );

    if (individualResults.length === 0) {
        return [];
    }

    // 2. 전역 통합 대체 시나리오 생성 (전역 통합 엔진 모듈)
    const globalResult = computeGlobalReroutingOption(
        individualResults,
        simulationResult,
        defaultCriterion,
    );

    if (globalResult) {
        return [globalResult, ...individualResults];
    }

    return individualResults;
}
