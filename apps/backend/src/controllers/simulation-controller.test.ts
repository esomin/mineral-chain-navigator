import { describe, it, expect, beforeAll } from 'vitest';
import type { DisruptionScenario } from '@navigator/shared';
import { SimulationController } from './simulation-controller.js';
import { store } from '../store.js';
import { loadSeedData } from '@navigator/database';

describe('SimulationController', () => {
    let controller: SimulationController;

    beforeAll(() => {
        // 시드 데이터 로딩
        const seedResult = loadSeedData();
        store.loadSeedData(seedResult);
        controller = new SimulationController(store);
    });

    const createTestScenario = (): DisruptionScenario => ({
        id: 'test-scenario-001',
        name: '칠레 광산 폐쇄 시나리오',
        disruptions: [
            {
                targetId: 'M-01',
                targetType: 'node',
                disruptionType: 'facility_closure',
                severity: 0.8,
            },
        ],
    });

    describe('runSimulation', () => {
        it('유효한 시나리오에 대해 SimulationResult를 반환해야 한다', async () => {
            const scenario = createTestScenario();
            const result = await controller.runSimulation(scenario);

            expect(result).toBeDefined();
            expect(result.scenarioId).toBe(scenario.id);
            expect(result.propagationPaths).toBeInstanceOf(Array);
            expect(result.deficits).toBeInstanceOf(Array);
            expect(result.executionTimeMs).toBeTypeOf('number');
        });

        it('3초 이내에 결과를 반환해야 한다', async () => {
            const scenario = createTestScenario();
            const startTime = performance.now();
            const result = await controller.runSimulation(scenario);
            const elapsed = performance.now() - startTime;

            expect(elapsed).toBeLessThan(3500); // 약간의 여유를 두고 검증
            expect(result.executionTimeMs).toBeLessThanOrEqual(3000);
        });

        it('실행 후 결과가 인메모리에 저장되어야 한다', async () => {
            const scenario: DisruptionScenario = {
                id: 'test-scenario-stored',
                name: '저장 테스트 시나리오',
                disruptions: [
                    {
                        targetId: 'M-01',
                        targetType: 'node',
                        disruptionType: 'strike',
                        severity: 0.5,
                    },
                ],
            };

            await controller.runSimulation(scenario);
            const stored = controller.getSimulationResult('test-scenario-stored');
            expect(stored).toBeDefined();
            expect(stored!.scenarioId).toBe('test-scenario-stored');
        });
    });

    describe('getSimulationResult', () => {
        it('저장된 시뮬레이션 결과를 조회할 수 있어야 한다', async () => {
            const scenario: DisruptionScenario = {
                id: 'test-scenario-get',
                name: '조회 테스트 시나리오',
                disruptions: [
                    {
                        targetId: 'M-02',
                        targetType: 'node',
                        disruptionType: 'natural_disaster',
                        severity: 0.6,
                    },
                ],
            };

            const originalResult = await controller.runSimulation(scenario);
            const retrieved = controller.getSimulationResult('test-scenario-get');

            expect(retrieved).toBeDefined();
            expect(retrieved).toEqual(originalResult);
        });

        it('존재하지 않는 시나리오 ID에 대해 undefined를 반환해야 한다', () => {
            const result = controller.getSimulationResult('non-existent-id');
            expect(result).toBeUndefined();
        });
    });
});
