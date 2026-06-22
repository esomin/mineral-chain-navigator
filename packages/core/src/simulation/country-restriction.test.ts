import { describe, it, expect } from 'vitest';
import { simulateCountryRestriction } from './country-restriction.js';
import type { SupplyChainNode, SupplyChainEdge } from '@navigator/shared';

// 테스트 헬퍼 — 노드 생성
const makeNode = (overrides?: Partial<SupplyChainNode>): SupplyChainNode => ({
    id: 'N-01',
    type: 'Refinery',
    name: 'Test Node',
    country: 'China',
    coordinates: { latitude: 30.0, longitude: 120.0 },
    metadata: { productionCapacity: 10000, capacityUnit: 'tons_lce' },
    description: '테스트 노드',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    ...overrides,
});

// 테스트 헬퍼 — 엣지 생성
const makeEdge = (overrides?: Partial<SupplyChainEdge>): SupplyChainEdge => ({
    id: 'E-01',
    type: 'Supply',
    sourceNodeId: 'N-01',
    targetNodeId: 'N-02',
    attributes: { volume: 5000 },
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    ...overrides,
});

describe('simulateCountryRestriction', () => {
    it('중국 수출 규제 시 중국 출발 모든 엣지를 식별한다', () => {
        const nodes: SupplyChainNode[] = [
            makeNode({ id: 'RF-01', country: 'China', name: 'Ganfeng Xinyu' }),
            makeNode({ id: 'RF-02', country: 'China', name: 'Tianqi Kwinana' }),
            makeNode({ id: 'F-01', country: 'SouthKorea', name: 'EcoPro' }),
            makeNode({ id: 'F-02', country: 'Japan', name: 'Panasonic' }),
            makeNode({ id: 'RF-03', country: 'Chile', name: 'SQM Salar' }),
        ];

        const edges: SupplyChainEdge[] = [
            makeEdge({ id: 'E-RF01-F01', sourceNodeId: 'RF-01', targetNodeId: 'F-01' }),
            makeEdge({ id: 'E-RF01-F02', sourceNodeId: 'RF-01', targetNodeId: 'F-02' }),
            makeEdge({ id: 'E-RF02-F01', sourceNodeId: 'RF-02', targetNodeId: 'F-01' }),
            makeEdge({ id: 'E-RF03-F01', sourceNodeId: 'RF-03', targetNodeId: 'F-01' }), // 칠레 출발
        ];

        const result = simulateCountryRestriction('China', 0.8, nodes, edges);

        // 중국 출발 엣지만 포함 (3개)
        expect(result.affectedEdges).toHaveLength(3);
        expect(result.affectedEdges).toContain('E-RF01-F01');
        expect(result.affectedEdges).toContain('E-RF01-F02');
        expect(result.affectedEdges).toContain('E-RF02-F01');
        // 칠레 출발 엣지는 포함되지 않음
        expect(result.affectedEdges).not.toContain('E-RF03-F01');
    });

    it('칠레 수출 규제 시 다운스트림 정제소/공장으로 전파된다', () => {
        const nodes: SupplyChainNode[] = [
            makeNode({ id: 'M-01', country: 'Chile', type: 'Mine', name: 'SQM Salar' }),
            makeNode({ id: 'RF-01', country: 'China', type: 'Refinery', name: 'Ganfeng' }),
            makeNode({ id: 'F-01', country: 'SouthKorea', type: 'Factory', name: 'EcoPro' }),
        ];

        const edges: SupplyChainEdge[] = [
            makeEdge({ id: 'E-M01-RF01', sourceNodeId: 'M-01', targetNodeId: 'RF-01' }),
            makeEdge({ id: 'E-RF01-F01', sourceNodeId: 'RF-01', targetNodeId: 'F-01' }),
        ];

        const result = simulateCountryRestriction('Chile', 0.9, nodes, edges);

        // 칠레에서 출발하는 엣지 1개
        expect(result.affectedEdges).toEqual(['E-M01-RF01']);
        // 다운스트림 전파: RF-01 → F-01
        expect(result.affectedNodeIds).toContain('RF-01');
        expect(result.affectedNodeIds).toContain('F-01');
        // 전파 경로가 존재
        expect(result.propagationPaths.length).toBeGreaterThan(0);
    });

    it('아웃바운드 엣지가 없는 국가는 빈 결과를 반환한다', () => {
        const nodes: SupplyChainNode[] = [
            makeNode({ id: 'F-01', country: 'SouthKorea', type: 'Factory', name: 'EcoPro' }),
            makeNode({ id: 'RF-01', country: 'China', type: 'Refinery', name: 'Ganfeng' }),
        ];

        const edges: SupplyChainEdge[] = [
            makeEdge({ id: 'E-RF01-F01', sourceNodeId: 'RF-01', targetNodeId: 'F-01' }),
        ];

        // UnitedStates에는 노드가 없으므로 아웃바운드 엣지 없음
        const result = simulateCountryRestriction('UnitedStates', 0.8, nodes, edges);

        expect(result.affectedEdges).toEqual([]);
        expect(result.propagationPaths).toEqual([]);
        expect(result.affectedNodeIds).toEqual([]);
        expect(result.country).toBe('UnitedStates');
        expect(result.severity).toBe(0.8);
    });

    it('해당 국가의 모든 엣지가 포함된다 (완전성)', () => {
        const nodes: SupplyChainNode[] = [
            makeNode({ id: 'RF-01', country: 'China', name: 'Ganfeng' }),
            makeNode({ id: 'RF-02', country: 'China', name: 'Tianqi' }),
            makeNode({ id: 'RF-03', country: 'China', name: 'CATL Refinery' }),
            makeNode({ id: 'F-01', country: 'SouthKorea', type: 'Factory' }),
            makeNode({ id: 'F-02', country: 'Japan', type: 'Factory' }),
            makeNode({ id: 'F-03', country: 'UnitedStates', type: 'Factory' }),
        ];

        const edges: SupplyChainEdge[] = [
            makeEdge({ id: 'E-01', sourceNodeId: 'RF-01', targetNodeId: 'F-01' }),
            makeEdge({ id: 'E-02', sourceNodeId: 'RF-01', targetNodeId: 'F-02' }),
            makeEdge({ id: 'E-03', sourceNodeId: 'RF-02', targetNodeId: 'F-01' }),
            makeEdge({ id: 'E-04', sourceNodeId: 'RF-02', targetNodeId: 'F-03' }),
            makeEdge({ id: 'E-05', sourceNodeId: 'RF-03', targetNodeId: 'F-02' }),
        ];

        const result = simulateCountryRestriction('China', 0.7, nodes, edges);

        // 중국 노드 3개에서 출발하는 모든 엣지 5개 포함
        expect(result.affectedEdges).toHaveLength(5);
        expect(result.affectedEdges).toContain('E-01');
        expect(result.affectedEdges).toContain('E-02');
        expect(result.affectedEdges).toContain('E-03');
        expect(result.affectedEdges).toContain('E-04');
        expect(result.affectedEdges).toContain('E-05');
    });

    it('경로가 겹칠 때 영향받는 노드가 중복 제거된다', () => {
        // RF-01 → F-01 → F-03 및 RF-02 → F-01 → F-03 경로가 겹침
        const nodes: SupplyChainNode[] = [
            makeNode({ id: 'RF-01', country: 'China', type: 'Refinery' }),
            makeNode({ id: 'RF-02', country: 'China', type: 'Refinery' }),
            makeNode({ id: 'F-01', country: 'SouthKorea', type: 'Factory' }),
            makeNode({ id: 'F-03', country: 'Japan', type: 'Factory' }),
        ];

        const edges: SupplyChainEdge[] = [
            makeEdge({ id: 'E-01', sourceNodeId: 'RF-01', targetNodeId: 'F-01' }),
            makeEdge({ id: 'E-02', sourceNodeId: 'RF-02', targetNodeId: 'F-01' }),
            makeEdge({ id: 'E-03', sourceNodeId: 'F-01', targetNodeId: 'F-03' }),
        ];

        const result = simulateCountryRestriction('China', 0.8, nodes, edges);

        // F-01과 F-03가 중복 없이 포함
        const uniqueNodeIds = new Set(result.affectedNodeIds);
        expect(uniqueNodeIds.size).toBe(result.affectedNodeIds.length);
        expect(result.affectedNodeIds).toContain('F-01');
        expect(result.affectedNodeIds).toContain('F-03');
    });

    it('severity와 country 값이 결과에 정확히 반영된다', () => {
        const nodes: SupplyChainNode[] = [
            makeNode({ id: 'M-01', country: 'Chile', type: 'Mine' }),
            makeNode({ id: 'RF-01', country: 'China', type: 'Refinery' }),
        ];

        const edges: SupplyChainEdge[] = [
            makeEdge({ id: 'E-01', sourceNodeId: 'M-01', targetNodeId: 'RF-01' }),
        ];

        const result = simulateCountryRestriction('Chile', 0.65, nodes, edges);

        expect(result.country).toBe('Chile');
        expect(result.severity).toBe(0.65);
    });

    it('옵션으로 감쇄율과 임계값을 조정할 수 있다', () => {
        // 3단계 체인: M-01 → RF-01 → F-01 → F-02
        const nodes: SupplyChainNode[] = [
            makeNode({ id: 'M-01', country: 'Chile', type: 'Mine' }),
            makeNode({ id: 'RF-01', country: 'China', type: 'Refinery' }),
            makeNode({ id: 'F-01', country: 'SouthKorea', type: 'Factory' }),
            makeNode({ id: 'F-02', country: 'Japan', type: 'Factory' }),
        ];

        const edges: SupplyChainEdge[] = [
            makeEdge({ id: 'E-01', sourceNodeId: 'M-01', targetNodeId: 'RF-01' }),
            makeEdge({ id: 'E-02', sourceNodeId: 'RF-01', targetNodeId: 'F-01' }),
            makeEdge({ id: 'E-03', sourceNodeId: 'F-01', targetNodeId: 'F-02' }),
        ];

        // 높은 임계값으로 전파가 일찍 중단
        const highThreshold = simulateCountryRestriction('Chile', 0.5, nodes, edges, {
            attenuationRate: 0.3,
            impactThreshold: 0.1,
        });

        // 낮은 임계값으로 전파가 더 멀리 진행
        const lowThreshold = simulateCountryRestriction('Chile', 0.5, nodes, edges, {
            attenuationRate: 0.7,
            impactThreshold: 0.01,
        });

        // 낮은 임계값이 더 많은 노드에 영향
        expect(lowThreshold.affectedNodeIds.length).toBeGreaterThanOrEqual(
            highThreshold.affectedNodeIds.length,
        );
    });
});
