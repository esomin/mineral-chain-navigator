// 시뮬레이션 실행 컨트롤러
import type { DisruptionScenario, SimulationResult } from '@navigator/shared';
import { runSingleSimulation } from '@navigator/core';
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
     * @returns 시뮬레이션 결과
     */
    async runSimulation(scenario: DisruptionScenario): Promise<SimulationResult> {
        const allNodes = this.store.getNodes();
        const allEdges = this.store.getEdges();

        const options: SimulationOptions = {
            timeoutMs: DEFAULT_TIMEOUT_MS,
        };

        // 타임아웃을 적용하여 시뮬레이션 실행
        const result = await this.runWithTimeout(scenario, allNodes, allEdges, options);

        // 결과를 인메모리 저장소에 보관
        this.results.set(scenario.id, result);

        return result;
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
