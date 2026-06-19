import { describe, it, expect, beforeEach } from 'vitest';
import type { SupplyChainNode, SupplyChainEdge } from '@navigator/shared';
import { InMemoryStore } from './in-memory-store.js';
import type { SeedDataResult } from '../types.js';

// 테스트용 노드 픽스처
function createTestNode(id: string, country = 'SouthKorea' as const): SupplyChainNode {
    return {
        id,
        type: 'Mine',
        name: `Test Node ${id}`,
        country,
        coordinates: { latitude: 37.5, longitude: 127.0 },
        metadata: { productionCapacity: 1000, capacityUnit: 'tons' },
        description: `테스트 노드 ${id}`,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
    };
}

// 테스트용 엣지 픽스처
function createTestEdge(
    id: string,
    sourceNodeId: string,
    targetNodeId: string,
): SupplyChainEdge {
    return {
        id,
        type: 'Supply',
        sourceNodeId,
        targetNodeId,
        attributes: { volume: 500 },
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
    };
}

describe('InMemoryStore', () => {
    let store: InMemoryStore;

    beforeEach(() => {
        store = new InMemoryStore();
    });

    describe('초기 상태', () => {
        it('빈 노드 배열을 반환한다', () => {
            expect(store.getNodes()).toEqual([]);
        });

        it('빈 엣지 배열을 반환한다', () => {
            expect(store.getEdges()).toEqual([]);
        });
    });

    describe('loadSeedData', () => {
        it('시드 데이터를 로드하면 노드와 엣지를 조회할 수 있다', () => {
            const seedData: SeedDataResult = {
                nodes: [createTestNode('N-01'), createTestNode('N-02')],
                edges: [createTestEdge('E-01', 'N-01', 'N-02')],
                errors: [],
            };

            store.loadSeedData(seedData);

            expect(store.getNodes()).toHaveLength(2);
            expect(store.getEdges()).toHaveLength(1);
        });

        it('기존 데이터를 초기화하고 새로 로드한다', () => {
            const firstLoad: SeedDataResult = {
                nodes: [createTestNode('N-01')],
                edges: [],
                errors: [],
            };
            const secondLoad: SeedDataResult = {
                nodes: [createTestNode('N-02'), createTestNode('N-03')],
                edges: [createTestEdge('E-01', 'N-02', 'N-03')],
                errors: [],
            };

            store.loadSeedData(firstLoad);
            store.loadSeedData(secondLoad);

            expect(store.getNodes()).toHaveLength(2);
            expect(store.getNodeById('N-01')).toBeUndefined();
            expect(store.getNodeById('N-02')).toBeDefined();
        });
    });

    describe('getNodeById', () => {
        it('존재하는 노드를 ID로 조회한다', () => {
            const seedData: SeedDataResult = {
                nodes: [createTestNode('N-01'), createTestNode('N-02')],
                edges: [],
                errors: [],
            };
            store.loadSeedData(seedData);

            const node = store.getNodeById('N-01');
            expect(node).toBeDefined();
            expect(node!.id).toBe('N-01');
        });

        it('존재하지 않는 ID에 대해 undefined를 반환한다', () => {
            expect(store.getNodeById('non-existent')).toBeUndefined();
        });
    });

    describe('getEdgeById', () => {
        it('존재하는 엣지를 ID로 조회한다', () => {
            const seedData: SeedDataResult = {
                nodes: [createTestNode('N-01'), createTestNode('N-02')],
                edges: [createTestEdge('E-01', 'N-01', 'N-02')],
                errors: [],
            };
            store.loadSeedData(seedData);

            const edge = store.getEdgeById('E-01');
            expect(edge).toBeDefined();
            expect(edge!.id).toBe('E-01');
        });

        it('존재하지 않는 ID에 대해 undefined를 반환한다', () => {
            expect(store.getEdgeById('non-existent')).toBeUndefined();
        });
    });

    describe('getInboundEdges', () => {
        it('특정 노드로 들어오는 엣지를 반환한다', () => {
            const seedData: SeedDataResult = {
                nodes: [
                    createTestNode('N-01'),
                    createTestNode('N-02'),
                    createTestNode('N-03'),
                ],
                edges: [
                    createTestEdge('E-01', 'N-01', 'N-02'),
                    createTestEdge('E-02', 'N-03', 'N-02'),
                    createTestEdge('E-03', 'N-01', 'N-03'),
                ],
                errors: [],
            };
            store.loadSeedData(seedData);

            const inbound = store.getInboundEdges('N-02');
            expect(inbound).toHaveLength(2);
            expect(inbound.map(e => e.id).sort()).toEqual(['E-01', 'E-02']);
        });

        it('인바운드 엣지가 없으면 빈 배열을 반환한다', () => {
            const seedData: SeedDataResult = {
                nodes: [createTestNode('N-01')],
                edges: [],
                errors: [],
            };
            store.loadSeedData(seedData);

            expect(store.getInboundEdges('N-01')).toEqual([]);
        });

        it('존재하지 않는 노드에 대해 빈 배열을 반환한다', () => {
            expect(store.getInboundEdges('non-existent')).toEqual([]);
        });
    });
});
