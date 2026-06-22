import { describe, it, expect } from 'vitest';
import {
    computePropagationPath,
    DEFAULT_ATTENUATION_RATE,
    DEFAULT_IMPACT_THRESHOLD,
} from './compute-propagation.js';
import type { SupplyChainNode, SupplyChainEdge, Disruption } from '@navigator/shared';

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

// 테스트용 엣지 생성 헬퍼
const makeEdge = (id: string, sourceNodeId: string, targetNodeId: string): SupplyChainEdge => ({
    id,
    type: 'Supply',
    sourceNodeId,
    targetNodeId,
    attributes: { volume: 10000 },
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
});

// 기본 교란 시나리오
const makeDisruption = (overrides?: Partial<Disruption>): Disruption => ({
    targetId: 'N-01',
    targetType: 'node',
    disruptionType: 'facility_closure',
    severity: 1.0,
    ...overrides,
});

describe('computePropagationPath', () => {
    describe('기본 동작', () => {
        it('시작 노드만 존재하고 아웃바운드 엣지가 없으면 시작 노드만 반환', () => {
            const nodes = [makeNode('N-01')];
            const edges: SupplyChainEdge[] = [];
            const disruption = makeDisruption();

            const result = computePropagationPath('N-01', disruption, nodes, edges);

            expect(result.nodes).toEqual(['N-01']);
            expect(result.edges).toEqual([]);
            expect(result.attenuationFactors).toEqual([1.0]);
        });

        it('존재하지 않는 시작 노드에 대해 빈 경로 반환', () => {
            const nodes = [makeNode('N-01')];
            const edges: SupplyChainEdge[] = [];
            const disruption = makeDisruption({ targetId: 'N-99' });

            const result = computePropagationPath('N-99', disruption, nodes, edges);

            expect(result.nodes).toEqual([]);
            expect(result.edges).toEqual([]);
            expect(result.attenuationFactors).toEqual([]);
        });

        it('단일 다운스트림 경로 전파', () => {
            const nodes = [makeNode('N-01'), makeNode('N-02'), makeNode('N-03')];
            const edges = [
                makeEdge('E-01', 'N-01', 'N-02'),
                makeEdge('E-02', 'N-02', 'N-03'),
            ];
            const disruption = makeDisruption({ severity: 1.0 });

            const result = computePropagationPath('N-01', disruption, nodes, edges);

            expect(result.nodes).toEqual(['N-01', 'N-02', 'N-03']);
            expect(result.edges).toEqual(['E-01', 'E-02']);
            expect(result.attenuationFactors[0]).toBe(1.0); // 시작 노드
            expect(result.attenuationFactors[1]).toBeCloseTo(0.7); // 1단계
            expect(result.attenuationFactors[2]).toBeCloseTo(0.49); // 2단계
        });
    });

    describe('감쇄율 적용', () => {
        it('기본 감쇄율(0.7) 적용 — 각 단계별 영향 감소', () => {
            const nodes = [makeNode('A'), makeNode('B'), makeNode('C'), makeNode('D')];
            const edges = [
                makeEdge('E-AB', 'A', 'B'),
                makeEdge('E-BC', 'B', 'C'),
                makeEdge('E-CD', 'C', 'D'),
            ];
            const disruption = makeDisruption({ targetId: 'A', severity: 1.0 });

            const result = computePropagationPath('A', disruption, nodes, edges);

            expect(result.attenuationFactors[0]).toBe(1.0);      // step 0: severity
            expect(result.attenuationFactors[1]).toBeCloseTo(0.7);  // step 1: 1.0 * 0.7^1
            expect(result.attenuationFactors[2]).toBeCloseTo(0.49); // step 2: 1.0 * 0.7^2
            expect(result.attenuationFactors[3]).toBeCloseTo(0.343); // step 3: 1.0 * 0.7^3
        });

        it('사용자 정의 감쇄율 적용', () => {
            const nodes = [makeNode('A'), makeNode('B'), makeNode('C')];
            const edges = [
                makeEdge('E-AB', 'A', 'B'),
                makeEdge('E-BC', 'B', 'C'),
            ];
            const disruption = makeDisruption({ targetId: 'A', severity: 0.8 });

            const result = computePropagationPath('A', disruption, nodes, edges, {
                attenuationRate: 0.5,
            });

            expect(result.attenuationFactors[0]).toBe(0.8);       // step 0: severity
            expect(result.attenuationFactors[1]).toBeCloseTo(0.4); // step 1: 0.8 * 0.5^1
            expect(result.attenuationFactors[2]).toBeCloseTo(0.2); // step 2: 0.8 * 0.5^2
        });

        it('임계값 이하로 떨어지면 전파 중단', () => {
            // severity 0.1, attenuationRate 0.1 → step 1: 0.01, step 2: 0.001
            // threshold = 0.01이므로 step 2는 전파되지 않아야 함
            const nodes = [makeNode('A'), makeNode('B'), makeNode('C')];
            const edges = [
                makeEdge('E-AB', 'A', 'B'),
                makeEdge('E-BC', 'B', 'C'),
            ];
            const disruption = makeDisruption({ targetId: 'A', severity: 0.1 });

            const result = computePropagationPath('A', disruption, nodes, edges, {
                attenuationRate: 0.1,
                impactThreshold: 0.01,
            });

            // step 1: 0.1 * 0.1 = 0.01 → 0.01 < 0.01은 false이므로 전파됨
            // step 2: 0.1 * 0.01 = 0.001 → 0.001 < 0.01이므로 전파 중단
            expect(result.nodes).toEqual(['A', 'B']);
            expect(result.edges).toEqual(['E-AB']);
        });
    });

    describe('분기 전파 (BFS)', () => {
        it('하나의 노드에서 여러 다운스트림으로 분기 전파', () => {
            const nodes = [makeNode('A'), makeNode('B'), makeNode('C'), makeNode('D')];
            const edges = [
                makeEdge('E-AB', 'A', 'B'),
                makeEdge('E-AC', 'A', 'C'),
                makeEdge('E-AD', 'A', 'D'),
            ];
            const disruption = makeDisruption({ targetId: 'A', severity: 1.0 });

            const result = computePropagationPath('A', disruption, nodes, edges);

            expect(result.nodes).toContain('A');
            expect(result.nodes).toContain('B');
            expect(result.nodes).toContain('C');
            expect(result.nodes).toContain('D');
            expect(result.nodes).toHaveLength(4);
            expect(result.edges).toHaveLength(3);
        });

        it('순환 그래프에서 무한 루프 방지', () => {
            const nodes = [makeNode('A'), makeNode('B'), makeNode('C')];
            const edges = [
                makeEdge('E-AB', 'A', 'B'),
                makeEdge('E-BC', 'B', 'C'),
                makeEdge('E-CA', 'C', 'A'), // 순환 엣지
            ];
            const disruption = makeDisruption({ targetId: 'A', severity: 1.0 });

            const result = computePropagationPath('A', disruption, nodes, edges);

            // 순환이 있어도 각 노드는 한 번만 방문
            expect(result.nodes).toEqual(['A', 'B', 'C']);
            expect(result.edges).toEqual(['E-AB', 'E-BC']);
        });
    });

    describe('엣지 대상 교란', () => {
        it('edge 교란 시 해당 엣지의 targetNodeId에서 BFS 시작', () => {
            const nodes = [makeNode('A'), makeNode('B'), makeNode('C')];
            const edges = [
                makeEdge('E-AB', 'A', 'B'),
                makeEdge('E-BC', 'B', 'C'),
            ];
            const disruption: Disruption = {
                targetId: 'E-AB',
                targetType: 'edge',
                disruptionType: 'natural_disaster',
                severity: 0.9,
            };

            const result = computePropagationPath('A', disruption, nodes, edges);

            // E-AB의 targetNodeId인 B에서 BFS 시작
            expect(result.nodes[0]).toBe('B');
            expect(result.attenuationFactors[0]).toBe(0.9);
            expect(result.nodes).toContain('C');
        });

        it('존재하지 않는 엣지 교란 시 빈 경로 반환', () => {
            const nodes = [makeNode('A'), makeNode('B')];
            const edges = [makeEdge('E-AB', 'A', 'B')];
            const disruption: Disruption = {
                targetId: 'E-99',
                targetType: 'edge',
                disruptionType: 'strike',
                severity: 0.5,
            };

            const result = computePropagationPath('A', disruption, nodes, edges);

            expect(result.nodes).toEqual([]);
            expect(result.edges).toEqual([]);
            expect(result.attenuationFactors).toEqual([]);
        });
    });

    describe('기본 상수 값', () => {
        it('DEFAULT_ATTENUATION_RATE는 0.7', () => {
            expect(DEFAULT_ATTENUATION_RATE).toBe(0.7);
        });

        it('DEFAULT_IMPACT_THRESHOLD는 0.01', () => {
            expect(DEFAULT_IMPACT_THRESHOLD).toBe(0.01);
        });
    });

    describe('실제 공급망 시나리오', () => {
        it('중국 정련소 폐쇄 시 다운스트림 공장으로 영향 전파', () => {
            // 실제 시나리오: RF-01(중국 정련소) → F-01(한국 공장) → 최종 수요처
            const nodes = [
                makeNode('RF-01', { type: 'Refinery', country: 'China', name: 'Ganfeng Xinyu' }),
                makeNode('F-01', { type: 'Factory', country: 'SouthKorea', name: 'EcoPro BM' }),
                makeNode('F-02', { type: 'Factory', country: 'Japan', name: 'Panasonic Energy' }),
            ];
            const edges = [
                makeEdge('E-RF01-F01', 'RF-01', 'F-01'),
                makeEdge('E-RF01-F02', 'RF-01', 'F-02'),
            ];
            const disruption: Disruption = {
                targetId: 'RF-01',
                targetType: 'node',
                disruptionType: 'facility_closure',
                severity: 0.8,
            };

            const result = computePropagationPath('RF-01', disruption, nodes, edges);

            expect(result.nodes).toContain('RF-01');
            expect(result.nodes).toContain('F-01');
            expect(result.nodes).toContain('F-02');
            expect(result.attenuationFactors[0]).toBe(0.8);
            // F-01과 F-02는 같은 단계(step 1)이므로 동일한 감쇄율
            expect(result.attenuationFactors[1]).toBeCloseTo(0.8 * 0.7);
            expect(result.attenuationFactors[2]).toBeCloseTo(0.8 * 0.7);
        });
    });
});
