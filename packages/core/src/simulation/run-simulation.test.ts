import { describe, it, expect } from 'vitest';
import type {
    SupplyChainNode,
    SupplyChainEdge,
    DisruptionScenario,
} from '@navigator/shared';
import { runSingleSimulation, runConcurrentSimulations } from './run-simulation.js';

// 테스트용 공급망 그래프 데이터
const baseDate = new Date('2025-01-01');

const testNodes: SupplyChainNode[] = [
    {
        id: 'mine-1',
        type: 'Mine',
        name: '리튬 광산 A',
        country: 'Chile',
        coordinates: { latitude: -23.5, longitude: -68.0 },
        metadata: { productionCapacity: 50000, capacityUnit: 'tons_lce' },
        description: '칠레 아타카마 리튬 광산',
        createdAt: baseDate,
        updatedAt: baseDate,
    },
    {
        id: 'refinery-1',
        type: 'Refinery',
        name: '정제소 B',
        country: 'China',
        coordinates: { latitude: 31.2, longitude: 121.5 },
        metadata: { productionCapacity: 30000, capacityUnit: 'tons' },
        description: '중국 상하이 정제소',
        createdAt: baseDate,
        updatedAt: baseDate,
    },
    {
        id: 'factory-1',
        type: 'Factory',
        name: '배터리 공장 C',
        country: 'SouthKorea',
        coordinates: { latitude: 37.5, longitude: 127.0 },
        metadata: { productionCapacity: 10000, capacityUnit: 'gwh' },
        description: '한국 배터리 공장',
        createdAt: baseDate,
        updatedAt: baseDate,
    },
    {
        id: 'factory-2',
        type: 'Factory',
        name: '배터리 공장 D',
        country: 'Japan',
        coordinates: { latitude: 35.7, longitude: 139.7 },
        metadata: { productionCapacity: 8000, capacityUnit: 'gwh' },
        description: '일본 배터리 공장',
        createdAt: baseDate,
        updatedAt: baseDate,
    },
];

const testEdges: SupplyChainEdge[] = [
    {
        id: 'edge-1',
        type: 'Supply',
        sourceNodeId: 'mine-1',
        targetNodeId: 'refinery-1',
        attributes: { volume: 10000 },
        createdAt: baseDate,
        updatedAt: baseDate,
    },
    {
        id: 'edge-2',
        type: 'Delivery',
        sourceNodeId: 'refinery-1',
        targetNodeId: 'factory-1',
        attributes: { volume: 5000 },
        createdAt: baseDate,
        updatedAt: baseDate,
    },
    {
        id: 'edge-3',
        type: 'Delivery',
        sourceNodeId: 'refinery-1',
        targetNodeId: 'factory-2',
        attributes: { volume: 4000 },
        createdAt: baseDate,
        updatedAt: baseDate,
    },
];

describe('runSingleSimulation', () => {
    it('단일 교란 시나리오 — 전파 경로와 부족 결과 반환', () => {
        const scenario: DisruptionScenario = {
            id: 'scenario-1',
            name: '광산 폐쇄',
            disruptions: [
                {
                    targetId: 'mine-1',
                    targetType: 'node',
                    disruptionType: 'facility_closure',
                    severity: 0.8,
                },
            ],
        };

        const result = runSingleSimulation(scenario, testNodes, testEdges);

        expect(result.scenarioId).toBe('scenario-1');
        expect(result.propagationPaths.length).toBe(1);
        expect(result.propagationPaths[0].nodes).toContain('mine-1');
        expect(result.deficits.length).toBeGreaterThan(0);
        expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('복합 교란 시나리오 — 여러 교란 결과 병합', () => {
        const scenario: DisruptionScenario = {
            id: 'scenario-2',
            name: '복합 교란',
            disruptions: [
                {
                    targetId: 'mine-1',
                    targetType: 'node',
                    disruptionType: 'facility_closure',
                    severity: 0.5,
                },
                {
                    targetId: 'edge-2',
                    targetType: 'edge',
                    disruptionType: 'export_restriction',
                    severity: 0.6,
                },
            ],
        };

        const result = runSingleSimulation(scenario, testNodes, testEdges);

        expect(result.scenarioId).toBe('scenario-2');
        // 두 교란 모두에서 전파 경로가 생성됨
        expect(result.propagationPaths.length).toBe(2);
        // 부족 결과도 병합됨
        expect(result.deficits.length).toBeGreaterThan(0);
    });

    it('빈 시나리오 (교란 없음) — 빈 결과 반환', () => {
        const scenario: DisruptionScenario = {
            id: 'scenario-empty',
            name: '빈 시나리오',
            disruptions: [],
        };

        const result = runSingleSimulation(scenario, testNodes, testEdges);

        expect(result.scenarioId).toBe('scenario-empty');
        expect(result.propagationPaths).toEqual([]);
        expect(result.deficits).toEqual([]);
        expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });
});

describe('runConcurrentSimulations', () => {
    it('복수 시나리오 병렬 실행 — 모든 결과 반환', async () => {
        const scenarios: DisruptionScenario[] = [
            {
                id: 'concurrent-1',
                name: '시나리오 A',
                disruptions: [
                    {
                        targetId: 'mine-1',
                        targetType: 'node',
                        disruptionType: 'natural_disaster',
                        severity: 0.9,
                    },
                ],
            },
            {
                id: 'concurrent-2',
                name: '시나리오 B',
                disruptions: [
                    {
                        targetId: 'edge-2',
                        targetType: 'edge',
                        disruptionType: 'strike',
                        severity: 0.4,
                    },
                ],
            },
            {
                id: 'concurrent-3',
                name: '시나리오 C',
                disruptions: [
                    {
                        targetId: 'refinery-1',
                        targetType: 'node',
                        disruptionType: 'facility_closure',
                        severity: 0.7,
                    },
                ],
            },
        ];

        const results = await runConcurrentSimulations(
            scenarios,
            testNodes,
            testEdges,
        );

        expect(results).toHaveLength(3);
        // 결과 순서가 입력 순서와 일치
        expect(results[0].scenarioId).toBe('concurrent-1');
        expect(results[1].scenarioId).toBe('concurrent-2');
        expect(results[2].scenarioId).toBe('concurrent-3');
    });

    it('결과 순서 유지 — 입력 시나리오 순서와 동일', async () => {
        const scenarios: DisruptionScenario[] = [
            {
                id: 'order-a',
                name: '첫 번째',
                disruptions: [
                    {
                        targetId: 'mine-1',
                        targetType: 'node',
                        disruptionType: 'facility_closure',
                        severity: 0.3,
                    },
                ],
            },
            {
                id: 'order-b',
                name: '두 번째',
                disruptions: [],
            },
        ];

        const results = await runConcurrentSimulations(
            scenarios,
            testNodes,
            testEdges,
        );

        expect(results[0].scenarioId).toBe('order-a');
        expect(results[1].scenarioId).toBe('order-b');
    });

    it('타임아웃 처리 — 빠른 시뮬레이션은 정상 완료', async () => {
        const scenarios: DisruptionScenario[] = [
            {
                id: 'timeout-test',
                name: '타임아웃 테스트',
                disruptions: [
                    {
                        targetId: 'mine-1',
                        targetType: 'node',
                        disruptionType: 'facility_closure',
                        severity: 0.5,
                    },
                ],
            },
        ];

        // 충분히 큰 타임아웃 — 정상 완료되어야 함
        const results = await runConcurrentSimulations(
            scenarios,
            testNodes,
            testEdges,
            { timeoutMs: 5000 },
        );

        expect(results).toHaveLength(1);
        expect(results[0].scenarioId).toBe('timeout-test');
        // 정상 완료 시 executionTimeMs는 타임아웃 값보다 작음
        expect(results[0].executionTimeMs).toBeLessThan(5000);
        expect(results[0].propagationPaths.length).toBeGreaterThan(0);
    });

    it('빈 시나리오 배열 — 빈 결과 배열 반환', async () => {
        const results = await runConcurrentSimulations([], testNodes, testEdges);
        expect(results).toEqual([]);
    });
});
