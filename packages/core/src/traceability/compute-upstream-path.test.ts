import { describe, it, expect } from 'vitest';
import type { SupplyChainNode, SupplyChainEdge } from '@navigator/shared';
import { computeUpstreamPaths, getNodeEsgStatus, getNodeCertifications } from './compute-upstream-path.js';

// 테스트 헬퍼: 노드 생성
function createNode(
    id: string,
    type: 'Resource' | 'Mine' | 'Refinery' | 'Factory',
    options?: {
        country?: string;
        name?: string;
        esgStatus?: string;
        certifications?: string[];
    },
): SupplyChainNode {
    return {
        id,
        type,
        name: options?.name ?? `${type}-${id}`,
        country: (options?.country ?? 'China') as SupplyChainNode['country'],
        coordinates: { latitude: 0, longitude: 0 },
        metadata: {
            productionCapacity: 1000,
            capacityUnit: 'tons',
            esgStatus: options?.esgStatus,
            certifications: options?.certifications,
        },
        description: `Test ${type} node`,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
    };
}

// 테스트 헬퍼: 엣지 생성
function createEdge(
    id: string,
    sourceNodeId: string,
    targetNodeId: string,
    type: 'Supply' | 'Delivery' = 'Supply',
): SupplyChainEdge {
    return {
        id,
        type,
        sourceNodeId,
        targetNodeId,
        attributes: { volume: 1000, price: 50000 },
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
    };
}

describe('getNodeEsgStatus', () => {
    it('metadata에 유효한 esgStatus가 있으면 해당 값을 반환한다', () => {
        const node = createNode('F-01', 'Factory', { esgStatus: 'compliant' });
        expect(getNodeEsgStatus(node)).toBe('compliant');
    });

    it('metadata에 esgStatus가 없으면 unknown을 반환한다', () => {
        const node = createNode('F-01', 'Factory');
        // metadata에 esgStatus를 undefined로 설정
        delete node.metadata['esgStatus'];
        expect(getNodeEsgStatus(node)).toBe('unknown');
    });

    it('유효하지 않은 esgStatus 값이면 unknown을 반환한다', () => {
        const node = createNode('F-01', 'Factory', { esgStatus: 'invalid_value' });
        expect(getNodeEsgStatus(node)).toBe('unknown');
    });

    it('non_compliant 상태를 올바르게 반환한다', () => {
        const node = createNode('F-01', 'Factory', { esgStatus: 'non_compliant' });
        expect(getNodeEsgStatus(node)).toBe('non_compliant');
    });

    it('unverified 상태를 올바르게 반환한다', () => {
        const node = createNode('RF-01', 'Refinery', { esgStatus: 'unverified' });
        expect(getNodeEsgStatus(node)).toBe('unverified');
    });
});

describe('getNodeCertifications', () => {
    it('인증 정보 배열이 있으면 반환한다', () => {
        const node = createNode('F-01', 'Factory', {
            certifications: ['ISO 14001', 'IRMA'],
        });
        expect(getNodeCertifications(node)).toEqual(['ISO 14001', 'IRMA']);
    });

    it('인증 정보가 없으면 빈 배열을 반환한다', () => {
        const node = createNode('F-01', 'Factory');
        delete node.metadata['certifications'];
        expect(getNodeCertifications(node)).toEqual([]);
    });

    it('비문자열 요소를 필터링한다', () => {
        const node = createNode('F-01', 'Factory');
        node.metadata['certifications'] = ['ISO 14001', 123, null, 'IRMA'] as unknown[];
        expect(getNodeCertifications(node)).toEqual(['ISO 14001', 'IRMA']);
    });
});

describe('computeUpstreamPaths', () => {
    describe('기본 동작', () => {
        it('존재하지 않는 노드 ID로 호출하면 빈 결과를 반환한다', () => {
            const result = computeUpstreamPaths('nonexistent', [], []);
            expect(result.upstreamPaths).toHaveLength(0);
            expect(result.sourceMinIds).toHaveLength(0);
            expect(result.factoryNodeId).toBe('nonexistent');
        });

        it('Factory가 아닌 노드로 호출하면 빈 결과를 반환한다', () => {
            const nodes = [createNode('M-01', 'Mine')];
            const result = computeUpstreamPaths('M-01', nodes, []);
            expect(result.upstreamPaths).toHaveLength(0);
        });

        it('인바운드 엣지가 없는 Factory는 빈 결과를 반환한다', () => {
            const nodes = [createNode('F-01', 'Factory')];
            const result = computeUpstreamPaths('F-01', nodes, []);
            expect(result.upstreamPaths).toHaveLength(0);
            expect(result.factoryName).toBe('Factory-F-01');
        });
    });

    describe('단일 경로 역추적', () => {
        it('Factory → Refinery → Mine 단일 경로를 올바르게 추적한다', () => {
            const nodes = [
                createNode('M-01', 'Mine', { esgStatus: 'compliant', country: 'Chile' }),
                createNode('RF-01', 'Refinery', { esgStatus: 'compliant', country: 'China' }),
                createNode('F-01', 'Factory', { esgStatus: 'compliant', country: 'SouthKorea' }),
            ];
            const edges = [
                createEdge('E-01', 'M-01', 'RF-01', 'Supply'),
                createEdge('E-02', 'RF-01', 'F-01', 'Delivery'),
            ];

            const result = computeUpstreamPaths('F-01', nodes, edges);

            expect(result.factoryNodeId).toBe('F-01');
            expect(result.factoryName).toBe('Factory-F-01');
            expect(result.upstreamPaths).toHaveLength(1);
            expect(result.sourceMinIds).toContain('M-01');
            expect(result.intermediateRefineryIds).toContain('RF-01');
            expect(result.hasUnverifiedPaths).toBe(false);

            // 경로 순서: Factory → Refinery → Mine
            const path = result.upstreamPaths[0];
            expect(path.nodes).toHaveLength(3);
            expect(path.nodes[0].nodeId).toBe('F-01');
            expect(path.nodes[0].nodeType).toBe('Factory');
            expect(path.nodes[1].nodeId).toBe('RF-01');
            expect(path.nodes[1].nodeType).toBe('Refinery');
            expect(path.nodes[2].nodeId).toBe('M-01');
            expect(path.nodes[2].nodeType).toBe('Mine');

            // 엣지 확인
            expect(path.edges).toHaveLength(2);
            expect(path.edges[0].edgeId).toBe('E-02');
            expect(path.edges[1].edgeId).toBe('E-01');
        });

        it('Factory → Mine 직접 연결 경로도 올바르게 추적한다', () => {
            const nodes = [
                createNode('M-01', 'Mine', { country: 'Chile' }),
                createNode('F-01', 'Factory', { country: 'SouthKorea' }),
            ];
            const edges = [createEdge('E-01', 'M-01', 'F-01', 'Supply')];

            const result = computeUpstreamPaths('F-01', nodes, edges);

            expect(result.upstreamPaths).toHaveLength(1);
            expect(result.sourceMinIds).toContain('M-01');
            expect(result.intermediateRefineryIds).toHaveLength(0);

            const path = result.upstreamPaths[0];
            expect(path.nodes).toHaveLength(2);
            expect(path.nodes[0].nodeId).toBe('F-01');
            expect(path.nodes[1].nodeId).toBe('M-01');
        });
    });

    describe('다중 경로 역추적', () => {
        it('여러 Mine에서 오는 다중 경로를 모두 추적한다', () => {
            const nodes = [
                createNode('M-01', 'Mine', { country: 'Chile' }),
                createNode('M-02', 'Mine', { country: 'China' }),
                createNode('RF-01', 'Refinery', { country: 'China' }),
                createNode('RF-02', 'Refinery', { country: 'Chile' }),
                createNode('F-01', 'Factory', { country: 'SouthKorea' }),
            ];
            const edges = [
                createEdge('E-01', 'M-01', 'RF-01', 'Supply'),
                createEdge('E-02', 'M-02', 'RF-01', 'Supply'),
                createEdge('E-03', 'M-01', 'RF-02', 'Supply'),
                createEdge('E-04', 'RF-01', 'F-01', 'Delivery'),
                createEdge('E-05', 'RF-02', 'F-01', 'Delivery'),
            ];

            const result = computeUpstreamPaths('F-01', nodes, edges);

            // RF-01으로부터 M-01, M-02 두 경로 + RF-02로부터 M-01 한 경로 = 총 3 경로
            expect(result.upstreamPaths).toHaveLength(3);
            expect(result.sourceMinIds).toContain('M-01');
            expect(result.sourceMinIds).toContain('M-02');
            expect(result.intermediateRefineryIds).toContain('RF-01');
            expect(result.intermediateRefineryIds).toContain('RF-02');
        });

        it('같은 Mine으로 수렴하는 여러 경로를 구분하여 추적한다', () => {
            const nodes = [
                createNode('M-01', 'Mine', { country: 'Chile' }),
                createNode('RF-01', 'Refinery', { country: 'China' }),
                createNode('RF-02', 'Refinery', { country: 'Chile' }),
                createNode('F-01', 'Factory', { country: 'SouthKorea' }),
            ];
            const edges = [
                createEdge('E-01', 'M-01', 'RF-01', 'Supply'),
                createEdge('E-02', 'M-01', 'RF-02', 'Supply'),
                createEdge('E-03', 'RF-01', 'F-01', 'Delivery'),
                createEdge('E-04', 'RF-02', 'F-01', 'Delivery'),
            ];

            const result = computeUpstreamPaths('F-01', nodes, edges);

            // RF-01 경유 + RF-02 경유 = 2개 경로
            expect(result.upstreamPaths).toHaveLength(2);
            // 모두 M-01에서 끝남
            for (const path of result.upstreamPaths) {
                const lastNode = path.nodes[path.nodes.length - 1];
                expect(lastNode.nodeId).toBe('M-01');
                expect(lastNode.nodeType).toBe('Mine');
            }
        });
    });

    describe('ESG 상태 검증', () => {
        it('미검증 노드가 있는 경로를 플래깅한다', () => {
            const nodes = [
                createNode('M-01', 'Mine', { esgStatus: 'compliant' }),
                createNode('RF-01', 'Refinery', { esgStatus: 'unverified' }),
                createNode('F-01', 'Factory', { esgStatus: 'compliant' }),
            ];
            const edges = [
                createEdge('E-01', 'M-01', 'RF-01'),
                createEdge('E-02', 'RF-01', 'F-01'),
            ];

            const result = computeUpstreamPaths('F-01', nodes, edges);

            expect(result.hasUnverifiedPaths).toBe(true);
            expect(result.upstreamPaths[0].hasUnverifiedSegment).toBe(true);
        });

        it('모든 노드가 compliant이면 플래깅하지 않는다', () => {
            const nodes = [
                createNode('M-01', 'Mine', { esgStatus: 'compliant' }),
                createNode('RF-01', 'Refinery', { esgStatus: 'compliant' }),
                createNode('F-01', 'Factory', { esgStatus: 'compliant' }),
            ];
            const edges = [
                createEdge('E-01', 'M-01', 'RF-01'),
                createEdge('E-02', 'RF-01', 'F-01'),
            ];

            const result = computeUpstreamPaths('F-01', nodes, edges);

            expect(result.hasUnverifiedPaths).toBe(false);
            expect(result.upstreamPaths[0].hasUnverifiedSegment).toBe(false);
        });

        it('unknown ESG 상태도 미검증으로 플래깅한다', () => {
            const nodes = [
                createNode('M-01', 'Mine'), // esgStatus 미설정 → unknown
                createNode('RF-01', 'Refinery', { esgStatus: 'compliant' }),
                createNode('F-01', 'Factory', { esgStatus: 'compliant' }),
            ];
            // esgStatus를 undefined로 제거
            delete nodes[0].metadata['esgStatus'];
            const edges = [
                createEdge('E-01', 'M-01', 'RF-01'),
                createEdge('E-02', 'RF-01', 'F-01'),
            ];

            const result = computeUpstreamPaths('F-01', nodes, edges);

            expect(result.hasUnverifiedPaths).toBe(true);
        });

        it('경로 내 노드에 인증 정보가 포함된다', () => {
            const nodes = [
                createNode('M-01', 'Mine', {
                    esgStatus: 'compliant',
                    certifications: ['IRMA Standard'],
                }),
                createNode('RF-01', 'Refinery', {
                    esgStatus: 'compliant',
                    certifications: ['ISO 14001'],
                }),
                createNode('F-01', 'Factory', {
                    esgStatus: 'compliant',
                    certifications: ['ISO 9001'],
                }),
            ];
            const edges = [
                createEdge('E-01', 'M-01', 'RF-01'),
                createEdge('E-02', 'RF-01', 'F-01'),
            ];

            const result = computeUpstreamPaths('F-01', nodes, edges);
            const path = result.upstreamPaths[0];

            expect(path.nodes[0].certifications).toContain('ISO 9001');
            expect(path.nodes[1].certifications).toContain('ISO 14001');
            expect(path.nodes[2].certifications).toContain('IRMA Standard');
        });
    });

    describe('순환 참조 방지', () => {
        it('순환 경로가 있어도 무한루프에 빠지지 않는다', () => {
            const nodes = [
                createNode('M-01', 'Mine'),
                createNode('RF-01', 'Refinery'),
                createNode('RF-02', 'Refinery'),
                createNode('F-01', 'Factory'),
            ];
            const edges = [
                createEdge('E-01', 'M-01', 'RF-01'),
                createEdge('E-02', 'RF-01', 'RF-02'),
                createEdge('E-03', 'RF-02', 'RF-01'), // 순환!
                createEdge('E-04', 'RF-02', 'F-01'),
            ];

            // 무한루프 없이 완료되어야 함
            const result = computeUpstreamPaths('F-01', nodes, edges);

            expect(result.upstreamPaths.length).toBeGreaterThanOrEqual(1);
            // M-01에 도달하는 경로가 있어야 함
            expect(result.sourceMinIds).toContain('M-01');
        });
    });

    describe('엣지 케이스', () => {
        it('Resource 노드에서 경로가 끝나면 해당 경로는 결과에 포함되지 않는다', () => {
            const nodes = [
                createNode('R-01', 'Resource'),
                createNode('RF-01', 'Refinery'),
                createNode('F-01', 'Factory'),
            ];
            const edges = [
                createEdge('E-01', 'R-01', 'RF-01'),
                createEdge('E-02', 'RF-01', 'F-01'),
            ];

            const result = computeUpstreamPaths('F-01', nodes, edges);

            // Resource에서 끝나는 경로는 유효한 역추적 경로가 아님
            expect(result.upstreamPaths).toHaveLength(0);
            expect(result.sourceMinIds).toHaveLength(0);
        });

        it('Mine과 Resource 모두 도달 가능한 경우 Mine 경로만 포함한다', () => {
            const nodes = [
                createNode('R-01', 'Resource'),
                createNode('M-01', 'Mine'),
                createNode('RF-01', 'Refinery'),
                createNode('F-01', 'Factory'),
            ];
            const edges = [
                createEdge('E-01', 'R-01', 'RF-01'),
                createEdge('E-02', 'M-01', 'RF-01'),
                createEdge('E-03', 'RF-01', 'F-01'),
            ];

            const result = computeUpstreamPaths('F-01', nodes, edges);

            expect(result.upstreamPaths).toHaveLength(1);
            expect(result.sourceMinIds).toContain('M-01');
        });

        it('여러 엣지 속성(volume, price)이 TraceabilityEdge에 포함된다', () => {
            const nodes = [
                createNode('M-01', 'Mine'),
                createNode('RF-01', 'Refinery'),
                createNode('F-01', 'Factory'),
            ];
            const edges: SupplyChainEdge[] = [
                {
                    id: 'E-01',
                    type: 'Supply',
                    sourceNodeId: 'M-01',
                    targetNodeId: 'RF-01',
                    attributes: { volume: 5000, price: 200000 },
                    createdAt: new Date('2025-01-01'),
                    updatedAt: new Date('2025-01-01'),
                },
                {
                    id: 'E-02',
                    type: 'Delivery',
                    sourceNodeId: 'RF-01',
                    targetNodeId: 'F-01',
                    attributes: { volume: 4500, price: 300000 },
                    createdAt: new Date('2025-01-01'),
                    updatedAt: new Date('2025-01-01'),
                },
            ];

            const result = computeUpstreamPaths('F-01', nodes, edges);
            const path = result.upstreamPaths[0];

            expect(path.edges[0].volume).toBe(4500);
            expect(path.edges[0].price).toBe(300000);
            expect(path.edges[1].volume).toBe(5000);
            expect(path.edges[1].price).toBe(200000);
        });
    });
});
