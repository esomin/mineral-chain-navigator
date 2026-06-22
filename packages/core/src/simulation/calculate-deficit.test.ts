import { describe, it, expect } from 'vitest';
import { calculateSupplyDeficit } from './calculate-deficit.js';
import type { SupplyChainNode, SupplyChainEdge, PropagationPath } from '@navigator/shared';

// 테스트용 노드 생성 헬퍼
const makeNode = (id: string, overrides?: Partial<SupplyChainNode>): SupplyChainNode => ({
    id,
    type: 'Refinery',
    name: `Node ${id}`,
    country: 'China',
    coordinates: { latitude: 30, longitude: 120 },
    metadata: { productionCapacity: 10000, capacityUnit: 'tons_lce' },
    description: `테스트 노드 ${id}`,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    ...overrides,
});

// 테스트용 엣지 생성 헬퍼 (volume 지정 가능)
const makeEdge = (
    id: string,
    sourceNodeId: string,
    targetNodeId: string,
    volume?: number,
): SupplyChainEdge => ({
    id,
    type: 'Supply',
    sourceNodeId,
    targetNodeId,
    attributes: { volume: volume ?? 10000 },
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
});

describe('calculateSupplyDeficit', () => {
    describe('기본 단일 경로 부족률 계산', () => {
        it('단일 경로에서 각 노드의 부족률을 올바르게 계산', () => {
            // A → B → C 경로, severity 0.8
            const nodes = [makeNode('A'), makeNode('B'), makeNode('C')];
            const edges = [
                makeEdge('E-AB', 'A', 'B', 5000),
                makeEdge('E-BC', 'B', 'C', 3000),
            ];
            const path: PropagationPath = {
                nodes: ['A', 'B', 'C'],
                edges: ['E-AB', 'E-BC'],
                attenuationFactors: [0.8, 0.56, 0.392],
            };

            const results = calculateSupplyDeficit(path, nodes, edges);

            expect(results).toHaveLength(3);

            // 소스 노드 A — 인바운드 엣지 없으므로 originalSupply = 0
            expect(results[0].nodeId).toBe('A');
            expect(results[0].originalSupply).toBe(0);
            expect(results[0].deficitPercentage).toBe(0);

            // 노드 B — 인바운드: E-AB (volume 5000)
            expect(results[1].nodeId).toBe('B');
            expect(results[1].originalSupply).toBe(5000);
            expect(results[1].disruptedSupply).toBeCloseTo(5000 * (1 - 0.56));
            expect(results[1].deficitPercentage).toBeCloseTo(56);

            // 노드 C — 인바운드: E-BC (volume 3000)
            expect(results[2].nodeId).toBe('C');
            expect(results[2].originalSupply).toBe(3000);
            expect(results[2].disruptedSupply).toBeCloseTo(3000 * (1 - 0.392));
            expect(results[2].deficitPercentage).toBeCloseTo(39.2);
        });
    });

    describe('다중 노드 분기 경로', () => {
        it('여러 인바운드 엣지를 가진 노드의 totalSupply 합산', () => {
            // A → C, B → C 두 개의 인바운드 엣지를 가진 C 노드
            const nodes = [makeNode('A'), makeNode('B'), makeNode('C')];
            const edges = [
                makeEdge('E-AC', 'A', 'C', 4000),
                makeEdge('E-BC', 'B', 'C', 6000),
            ];
            const path: PropagationPath = {
                nodes: ['A', 'C'],
                edges: ['E-AC'],
                attenuationFactors: [0.9, 0.63],
            };

            const results = calculateSupplyDeficit(path, nodes, edges);

            // 노드 C의 인바운드: E-AC(4000) + E-BC(6000) = 10000
            expect(results[1].nodeId).toBe('C');
            expect(results[1].originalSupply).toBe(10000);
            expect(results[1].disruptedSupply).toBeCloseTo(10000 * (1 - 0.63));
            expect(results[1].deficitPercentage).toBeCloseTo(63);
        });

        it('분기 경로의 각 다운스트림 노드별 부족률 계산', () => {
            // A → B, A → C, B → D 분기 경로
            const nodes = [makeNode('A'), makeNode('B'), makeNode('C'), makeNode('D')];
            const edges = [
                makeEdge('E-AB', 'A', 'B', 8000),
                makeEdge('E-AC', 'A', 'C', 5000),
                makeEdge('E-BD', 'B', 'D', 3000),
            ];
            const path: PropagationPath = {
                nodes: ['A', 'B', 'C', 'D'],
                edges: ['E-AB', 'E-AC', 'E-BD'],
                attenuationFactors: [1.0, 0.7, 0.7, 0.49],
            };

            const results = calculateSupplyDeficit(path, nodes, edges);

            expect(results).toHaveLength(4);
            expect(results[1].deficitPercentage).toBeCloseTo(70);
            expect(results[2].deficitPercentage).toBeCloseTo(70);
            expect(results[3].deficitPercentage).toBeCloseTo(49);
        });
    });

    describe('인바운드 volume이 없는 노드', () => {
        it('인바운드 엣지가 없는 노드는 originalSupply=0, deficitPercentage=0', () => {
            const nodes = [makeNode('A'), makeNode('B')];
            const edges: SupplyChainEdge[] = []; // 엣지 없음
            const path: PropagationPath = {
                nodes: ['A', 'B'],
                edges: [],
                attenuationFactors: [0.5, 0.35],
            };

            const results = calculateSupplyDeficit(path, nodes, edges);

            expect(results[0].originalSupply).toBe(0);
            expect(results[0].deficitPercentage).toBe(0);
            expect(results[1].originalSupply).toBe(0);
            expect(results[1].deficitPercentage).toBe(0);
        });

        it('volume이 undefined인 엣지는 0으로 처리', () => {
            const nodes = [makeNode('A'), makeNode('B')];
            const edges: SupplyChainEdge[] = [{
                id: 'E-AB',
                type: 'Supply',
                sourceNodeId: 'A',
                targetNodeId: 'B',
                attributes: {}, // volume 미설정
                createdAt: new Date('2025-01-01'),
                updatedAt: new Date('2025-01-01'),
            }];
            const path: PropagationPath = {
                nodes: ['A', 'B'],
                edges: ['E-AB'],
                attenuationFactors: [0.8, 0.56],
            };

            const results = calculateSupplyDeficit(path, nodes, edges);

            expect(results[1].originalSupply).toBe(0);
            expect(results[1].deficitPercentage).toBe(0);
        });
    });

    describe('부족률 클램핑 [0, 100]', () => {
        it('attenuationFactor가 1.0이면 deficitPercentage는 100', () => {
            const nodes = [makeNode('A'), makeNode('B')];
            const edges = [makeEdge('E-AB', 'A', 'B', 5000)];
            const path: PropagationPath = {
                nodes: ['A', 'B'],
                edges: ['E-AB'],
                attenuationFactors: [1.0, 1.0],
            };

            const results = calculateSupplyDeficit(path, nodes, edges);

            expect(results[1].deficitPercentage).toBe(100);
            expect(results[1].disruptedSupply).toBe(0);
        });

        it('attenuationFactor가 0이면 deficitPercentage는 0', () => {
            const nodes = [makeNode('A'), makeNode('B')];
            const edges = [makeEdge('E-AB', 'A', 'B', 5000)];
            const path: PropagationPath = {
                nodes: ['A', 'B'],
                edges: ['E-AB'],
                attenuationFactors: [0.0, 0.0],
            };

            const results = calculateSupplyDeficit(path, nodes, edges);

            expect(results[1].deficitPercentage).toBe(0);
            expect(results[1].disruptedSupply).toBe(5000);
        });

        it('attenuationFactor > 1 이어도 deficitPercentage는 100으로 클램핑', () => {
            const nodes = [makeNode('A'), makeNode('B')];
            const edges = [makeEdge('E-AB', 'A', 'B', 5000)];
            const path: PropagationPath = {
                nodes: ['A', 'B'],
                edges: ['E-AB'],
                attenuationFactors: [1.5, 1.2],
            };

            const results = calculateSupplyDeficit(path, nodes, edges);

            expect(results[1].deficitPercentage).toBe(100);
        });
    });

    describe('소스 노드 부족률', () => {
        it('소스 노드에 인바운드 엣지가 있을 때 severity 기반 부족률 계산', () => {
            // 소스 노드(RF-01)에 인바운드 엣지가 있는 경우
            const nodes = [makeNode('M-01'), makeNode('RF-01'), makeNode('F-01')];
            const edges = [
                makeEdge('E-M-RF', 'M-01', 'RF-01', 20000), // 소스 노드로의 인바운드
                makeEdge('E-RF-F', 'RF-01', 'F-01', 15000),
            ];
            const path: PropagationPath = {
                nodes: ['RF-01', 'F-01'],
                edges: ['E-RF-F'],
                attenuationFactors: [0.8, 0.56], // severity = 0.8
            };

            const results = calculateSupplyDeficit(path, nodes, edges);

            // 소스 노드 RF-01 — 인바운드: E-M-RF (20000)
            expect(results[0].nodeId).toBe('RF-01');
            expect(results[0].originalSupply).toBe(20000);
            expect(results[0].deficitPercentage).toBeCloseTo(80);
            expect(results[0].disruptedSupply).toBeCloseTo(20000 * (1 - 0.8));
        });
    });

    describe('빈 경로', () => {
        it('빈 전파 경로에 대해 빈 결과 반환', () => {
            const path: PropagationPath = {
                nodes: [],
                edges: [],
                attenuationFactors: [],
            };

            const results = calculateSupplyDeficit(path, [], []);

            expect(results).toEqual([]);
        });
    });
});
