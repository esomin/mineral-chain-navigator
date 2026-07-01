/**
 * LOD 클러스터링 유틸리티 단위 테스트.
 * 줌 레벨에 따른 노드 집계/클러스터링 로직을 검증한다.
 */

import { describe, it, expect } from 'vitest';
import {
    computeLODClusters,
    toClusterableNodes,
    LOD_THRESHOLDS,
    type ClusterableNode,
} from './clustering';

// 테스트용 노드 데이터 생성 헬퍼
function createTestNode(overrides: Partial<ClusterableNode> = {}): ClusterableNode {
    return {
        id: 'test-node',
        type: 'Mine',
        country: 'China',
        coordinates: { latitude: 30.0, longitude: 116.0 },
        productionCapacity: 50000,
        capacityUnit: 'tons_lce',
        riskScore: 45,
        ...overrides,
    };
}

// 14개 마스터 노드 기반 테스트 데이터
function createMasterNodes(): ClusterableNode[] {
    return [
        createTestNode({ id: 'R-01', type: 'Resource', country: 'NA', coordinates: { latitude: 0, longitude: 0 }, productionCapacity: 0, riskScore: 10 }),
        createTestNode({ id: 'M-01', type: 'Mine', country: 'Chile', coordinates: { latitude: -23.5, longitude: -68.2 }, productionCapacity: 200000, riskScore: 25 }),
        createTestNode({ id: 'M-02', type: 'Mine', country: 'China', coordinates: { latitude: 27.8, longitude: 114.4 }, productionCapacity: 60000, riskScore: 50 }),
        createTestNode({ id: 'M-03', type: 'Mine', country: 'UnitedStates', coordinates: { latitude: 37.8, longitude: -117.9 }, productionCapacity: 5000, riskScore: 20 }),
        createTestNode({ id: 'RF-01', type: 'Refinery', country: 'China', coordinates: { latitude: 27.8, longitude: 114.9 }, productionCapacity: 100000, riskScore: 75 }),
        createTestNode({ id: 'RF-02', type: 'Refinery', country: 'China', coordinates: { latitude: 30.6, longitude: 105.0 }, productionCapacity: 50000, riskScore: 60 }),
        createTestNode({ id: 'RF-03', type: 'Refinery', country: 'Chile', coordinates: { latitude: -23.6, longitude: -70.4 }, productionCapacity: 40000, riskScore: 30 }),
        createTestNode({ id: 'RF-04', type: 'Refinery', country: 'SouthKorea', coordinates: { latitude: 34.9, longitude: 127.7 }, productionCapacity: 40000, riskScore: 35 }),
        createTestNode({ id: 'RF-05', type: 'Refinery', country: 'UnitedStates', coordinates: { latitude: 35.5, longitude: -86.6 }, productionCapacity: 30000, riskScore: 25 }),
        createTestNode({ id: 'F-01', type: 'Factory', country: 'SouthKorea', coordinates: { latitude: 36.0, longitude: 129.3 }, productionCapacity: 100000, riskScore: 40 }),
        createTestNode({ id: 'F-02', type: 'Factory', country: 'SouthKorea', coordinates: { latitude: 36.6, longitude: 127.5 }, productionCapacity: 30000, riskScore: 38 }),
        createTestNode({ id: 'F-03', type: 'Factory', country: 'Japan', coordinates: { latitude: 34.2, longitude: 135.2 }, productionCapacity: 10000, riskScore: 30 }),
        createTestNode({ id: 'F-04', type: 'Factory', country: 'China', coordinates: { latitude: 26.7, longitude: 119.5 }, productionCapacity: 100000, riskScore: 65 }),
        createTestNode({ id: 'F-05', type: 'Factory', country: 'UnitedStates', coordinates: { latitude: 39.5, longitude: -119.7 }, productionCapacity: 40000, riskScore: 22 }),
    ];
}

describe('computeLODClusters', () => {
    describe('줌 레벨 > CLUSTER_ZOOM (클러스터링 없음)', () => {
        it('모든 노드가 개별 표시되어야 한다', () => {
            const nodes = createMasterNodes();
            const result = computeLODClusters(nodes, LOD_THRESHOLDS.CLUSTER_ZOOM + 0.1);

            // 태스크 8.4.1 변경: computeLODClusters는 줌 레벨과 무관하게 항상 클러스터링 적용
            // 2개 이상 노드가 있는 국가는 클러스터로 묶임 (중국, 한국, 미국, 칠레)
            expect(result.clusters.length).toBeGreaterThan(0);
            expect(result.totalMemberCount).toBe(14);
        });

        it('높은 줌 레벨에서도 클러스터링이 동일하게 적용되어야 한다', () => {
            const nodes = createMasterNodes();
            const result = computeLODClusters(nodes, 2.0);

            // 태스크 8.4.1 변경: 줌 레벨과 무관하게 국가별 클러스터링이 항상 적용됨
            expect(result.clusters.length).toBeGreaterThan(0);
            expect(result.totalMemberCount).toBe(14);
        });
    });

    describe('줌 레벨 <= CLUSTER_ZOOM (국가별 클러스터링)', () => {
        it('2개 이상 노드를 가진 국가가 클러스터링되어야 한다', () => {
            const nodes = createMasterNodes();
            const result = computeLODClusters(nodes, LOD_THRESHOLDS.CLUSTER_ZOOM);

            // 중국(4), 한국(3), 칠레(2), 미국(3) → 클러스터 4개
            // NA(1), 일본(1) → 개별 표시 2개
            expect(result.clusters.length).toBeGreaterThan(0);

            // 중국 클러스터: M-02, RF-01, RF-02, F-04 (4개)
            const chinaCluster = result.clusters.find((c) => c.country === 'China');
            expect(chinaCluster).toBeDefined();
            expect(chinaCluster!.memberCount).toBe(4);

            // 한국 클러스터: RF-04, F-01, F-02 (3개)
            const koreaCluster = result.clusters.find((c) => c.country === 'SouthKorea');
            expect(koreaCluster).toBeDefined();
            expect(koreaCluster!.memberCount).toBe(3);
        });

        it('전체 멤버 수가 원본 노드 수와 동일해야 한다 (불변식)', () => {
            const nodes = createMasterNodes();
            const result = computeLODClusters(nodes, LOD_THRESHOLDS.CLUSTER_ZOOM);

            expect(result.totalMemberCount).toBe(nodes.length);
        });
    });

    describe('클러스터 속성 계산', () => {
        it('클러스터 중심점이 멤버 좌표의 평균이어야 한다', () => {
            const nodes = [
                createTestNode({ id: 'n1', country: 'China', coordinates: { latitude: 30, longitude: 110 } }),
                createTestNode({ id: 'n2', country: 'China', coordinates: { latitude: 28, longitude: 120 } }),
            ];

            const result = computeLODClusters(nodes, LOD_THRESHOLDS.CLUSTER_ZOOM);
            const cluster = result.clusters.find((c) => c.country === 'China');

            expect(cluster).toBeDefined();
            expect(cluster!.centroid.latitude).toBe(29); // (30 + 28) / 2
            expect(cluster!.centroid.longitude).toBe(115); // (110 + 120) / 2
        });

        it('클러스터 평균 리스크 점수가 정확해야 한다', () => {
            const nodes = [
                createTestNode({ id: 'n1', country: 'China', riskScore: 40 }),
                createTestNode({ id: 'n2', country: 'China', riskScore: 80 }),
            ];

            const result = computeLODClusters(nodes, LOD_THRESHOLDS.CLUSTER_ZOOM);
            const cluster = result.clusters.find((c) => c.country === 'China');

            expect(cluster!.averageRiskScore).toBe(60); // (40 + 80) / 2
        });

        it('클러스터 총 생산량이 멤버 합산이어야 한다', () => {
            const nodes = [
                createTestNode({ id: 'n1', country: 'China', productionCapacity: 50000 }),
                createTestNode({ id: 'n2', country: 'China', productionCapacity: 100000 }),
            ];

            const result = computeLODClusters(nodes, LOD_THRESHOLDS.CLUSTER_ZOOM);
            const cluster = result.clusters.find((c) => c.country === 'China');

            expect(cluster!.totalCapacity).toBe(150000);
        });

        it('클러스터 레이블에 국가명과 노드 수가 포함되어야 한다', () => {
            const nodes = [
                createTestNode({ id: 'n1', country: 'China' }),
                createTestNode({ id: 'n2', country: 'China' }),
                createTestNode({ id: 'n3', country: 'China' }),
            ];

            const result = computeLODClusters(nodes, LOD_THRESHOLDS.CLUSTER_ZOOM);
            const cluster = result.clusters.find((c) => c.country === 'China');

            expect(cluster!.label).toBe('중국 (3)');
        });
    });

    describe('빈 입력 처리', () => {
        it('빈 노드 배열 시 빈 결과를 반환해야 한다', () => {
            const result = computeLODClusters([], 0.3);

            expect(result.clusters).toHaveLength(0);
            expect(result.visibleNodes).toHaveLength(0);
            expect(result.totalMemberCount).toBe(0);
        });

        it('단일 노드 시 개별 표시해야 한다', () => {
            const nodes = [createTestNode({ id: 'only-one', country: 'Japan' })];
            const result = computeLODClusters(nodes, LOD_THRESHOLDS.CLUSTER_ZOOM);

            expect(result.clusters).toHaveLength(0);
            expect(result.visibleNodes).toEqual(['only-one']);
            expect(result.totalMemberCount).toBe(1);
        });
    });
});

describe('toClusterableNodes', () => {
    it('SupplyChainNode 형식을 ClusterableNode 형식으로 올바르게 변환해야 한다', () => {
        const nodes = [
            {
                id: 'RF-01',
                type: 'Refinery' as const,
                country: 'China' as const,
                coordinates: { latitude: 27.8, longitude: 114.9 },
                metadata: { productionCapacity: 100000, capacityUnit: 'tons' },
            },
        ];
        const riskScores = new Map([['RF-01', 75]]);

        const result = toClusterableNodes(nodes, riskScores);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
            id: 'RF-01',
            type: 'Refinery',
            country: 'China',
            coordinates: { latitude: 27.8, longitude: 114.9 },
            productionCapacity: 100000,
            capacityUnit: 'tons',
            riskScore: 75,
        });
    });

    it('리스크 점수가 없는 노드는 0으로 기본값 적용해야 한다', () => {
        const nodes = [
            {
                id: 'M-03',
                type: 'Mine' as const,
                country: 'UnitedStates' as const,
                coordinates: { latitude: 37.8, longitude: -117.9 },
                metadata: { productionCapacity: 5000, capacityUnit: 'tons_lce' },
            },
        ];
        const riskScores = new Map<string, number>();

        const result = toClusterableNodes(nodes, riskScores);

        expect(result[0].riskScore).toBe(0);
    });
});
