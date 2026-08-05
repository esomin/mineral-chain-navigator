import type { DisruptionScenario, SimulationResult, OptimizationCriterion, ReroutingResult } from '@navigator/shared';
import { runSingleSimulation, computeReroutingOptions } from '@navigator/core';
import type { SimulationOptions } from '@navigator/core';
import type { DataStore } from '@navigator/database';

/** 기본 타임아웃 (ms) — 3초 */
const DEFAULT_TIMEOUT_MS = 3000;

/**
 * 시뮬레이션 컨트롤러.
 * 시나리오를 실행하고 결과를 인메모리에 저장/조회한다.
 */
export class SimulationController {
    private results: Map<string, SimulationResult> = new Map();

    constructor(private readonly store: DataStore) { }

    /**
     * 시뮬레이션을 실행하고 결과를 저장한다.
     * 3초 타임아웃을 적용하며, 초과 시 부분 결과를 반환한다.
     * @param scenario 교란 시나리오
     * @param criterion 대체 경로 최적화 기준 ('cost' | 'leadTime' | 'balanced')
     * @returns 시뮬레이션 결과 (우회 경로 옵션 포함)
     */
    async runSimulation(
        scenario: DisruptionScenario,
        criterion: OptimizationCriterion = 'balanced',
    ): Promise<SimulationResult> {
        const allNodes = this.store.getNodes();
        const allEdges = this.store.getEdges();

        // targetId가 'ALL_NODES'인 충격 항목을 해당 조건의 전체 노드로 확장
        const expandedDisruptions = scenario.disruptions.flatMap((d) => {
            if (d.targetId === 'ALL_NODES' && d.targetType === 'node') {
                const targetNodes = allNodes.filter((n) => {
                    if (n.type === 'Resource') return false; // 자원은 제외
                    const matchCountry = !d.country || d.country === 'ALL' || n.country === d.country;
                    const matchType = !d.nodeType || d.nodeType === 'ALL' || n.type === d.nodeType;
                    return matchCountry && matchType;
                });
                return targetNodes.map((n) => ({
                    ...d,
                    targetId: n.id,
                }));
            }
            return [d];
        });

        const expandedScenario: DisruptionScenario = {
            ...scenario,
            disruptions: expandedDisruptions,
        };

        const options: SimulationOptions = {
            timeoutMs: DEFAULT_TIMEOUT_MS,
        };

        // 타임아웃을 적용하여 시뮬레이션 실행
        const result = await this.runWithTimeout(expandedScenario, allNodes, allEdges, options);

        // 대체 우회 공급망 경로 자동 산출 (Re-routing Engine)
        const reroutingResults = computeReroutingOptions(result, allNodes, allEdges, criterion);
        result.reroutingResults = reroutingResults;

        // 결과를 인메모리 저장소에 보관
        this.results.set(scenario.id, result);

        return result;
    }

    /**
     * 특정 최적화 기준에 따라 우회 경로 옵션을 재계산한다.
     */
    computeReroute(
        scenarioId: string,
        criterion: OptimizationCriterion = 'balanced',
    ): ReroutingResult[] {
        const result = this.results.get(scenarioId);
        if (!result) return [];

        const allNodes = this.store.getNodes();
        const allEdges = this.store.getEdges();

        const reroutingResults = computeReroutingOptions(result, allNodes, allEdges, criterion);
        result.reroutingResults = reroutingResults;
        this.results.set(scenarioId, result);

        return reroutingResults;
    }

    /**
     * 저장된 시뮬레이션 결과를 조회한다.
     * @param scenarioId 시나리오 ID
     * @returns 시뮬레이션 결과 또는 undefined (미존재 시)
     */
    getSimulationResult(scenarioId: string): SimulationResult | undefined {
        return this.results.get(scenarioId);
    }

    /**
     * 타임아웃을 적용하여 단일 시뮬레이션을 실행한다.
     * 타임아웃 초과 시 빈 결과를 반환한다.
     */
    private runWithTimeout(
        scenario: DisruptionScenario,
        allNodes: Parameters<typeof runSingleSimulation>[1],
        allEdges: Parameters<typeof runSingleSimulation>[2],
        options: SimulationOptions,
    ): Promise<SimulationResult> {
        const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

        return new Promise<SimulationResult>((resolve) => {
            const timer = setTimeout(() => {
                // 타임아웃 발생 시 빈 결과 반환
                resolve({
                    scenarioId: scenario.id,
                    propagationPaths: [],
                    deficits: [],
                    executionTimeMs: timeoutMs,
                });
            }, timeoutMs);

            // 시뮬레이션을 microtask로 실행
            Promise.resolve().then(() => {
                const result = runSingleSimulation(scenario, allNodes, allEdges, options);
                clearTimeout(timer);
                resolve(result);
            });
        });
    }
}
