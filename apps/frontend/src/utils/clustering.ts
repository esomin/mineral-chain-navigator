/**
 * LOD (Level of Detail) 클러스터링 유틸리티.
 *
 * 국가(country)별 그룹핑으로 클러스터를 생성한다.
 * 줌 레벨과 무관하게 버튼 토글로 제어된다.
 */

import type { NodeType, Country } from '@navigator/shared';

// 직렬화 가능한 노드 데이터 (Worker 간 전달용)
export interface ClusterableNode {
    id: string;
    type: NodeType;
    country: Country;
    coordinates: { latitude: number; longitude: number };
    productionCapacity: number;
    capacityUnit: string;
    riskScore: number;
}

// 클러스터 결과
export interface ClusterResult {
    id: string;
    type: 'cluster';
    label: string;
    country: Country;
    memberNodeIds: string[];
    memberCount: number;
    centroid: { latitude: number; longitude: number };
    totalCapacity: number;
    averageRiskScore: number;
}

// LOD 클러스터링 결과 (클러스터 + 비클러스터 노드)
export interface LODResult {
    clusters: ClusterResult[];
    visibleNodes: string[];  // 클러스터링되지 않은 개별 표시 노드 ID 목록
    totalMemberCount: number; // 불변식: 전체 노드 수와 동일해야 함
}

// 하위 호환을 위해 유지 (내부적으로 사용되지 않음)
export const LOD_THRESHOLDS = {
    CLUSTER_ZOOM: 1.0,
} as const;

/**
 * 국가별 LOD 클러스터링 수행.
 * 줌 레벨과 무관하게 항상 클러스터링을 적용한다.
 * 최소 2개 노드가 있는 국가만 클러스터로 묶는다.
 *
 * 불변식: clusters.totalMemberCount === 원본 노드 수
 */
export function computeLODClusters(
    nodes: ClusterableNode[],
    _zoomLevel: number,
): LODResult {
    // 국가별 노드 그룹핑
    const countryGroups = new Map<Country, ClusterableNode[]>();
    for (const node of nodes) {
        const group = countryGroups.get(node.country) || [];
        group.push(node);
        countryGroups.set(node.country, group);
    }

    const minNodesForCluster = 2;

    const clusters: ClusterResult[] = [];
    const visibleNodes: string[] = [];

    for (const [country, group] of countryGroups) {
        if (group.length >= minNodesForCluster) {
            clusters.push(createCluster(country, group));
        } else {
            for (const node of group) {
                visibleNodes.push(node.id);
            }
        }
    }

    const totalMemberCount =
        clusters.reduce((sum, c) => sum + c.memberCount, 0) + visibleNodes.length;

    return {
        clusters,
        visibleNodes,
        totalMemberCount,
    };
}

/**
 * 국가별 클러스터 생성.
 * 중심점(centroid)은 멤버 노드 좌표의 평균으로 계산한다.
 */
function createCluster(country: Country, members: ClusterableNode[]): ClusterResult {
    const centroid = {
        latitude: members.reduce((sum, n) => sum + n.coordinates.latitude, 0) / members.length,
        longitude: members.reduce((sum, n) => sum + n.coordinates.longitude, 0) / members.length,
    };

    const totalCapacity = members.reduce((sum, n) => sum + n.productionCapacity, 0);
    const averageRiskScore =
        members.reduce((sum, n) => sum + n.riskScore, 0) / members.length;

    const countryLabels: Record<Country, string> = {
        SouthKorea: '한국',
        Japan: '일본',
        China: '중국',
        Chile: '칠레',
        UnitedStates: '미국',
        Australia: '호주',
        Argentina: '아르헨티나',
        NA: 'Global',
    };

    return {
        id: `cluster-${country}`,
        type: 'cluster',
        label: `${countryLabels[country]} (${members.length})`,
        country,
        memberNodeIds: members.map((n) => n.id),
        memberCount: members.length,
        centroid,
        totalCapacity,
        averageRiskScore,
    };
}

/**
 * SupplyChainNode를 클러스터링 가능 형식으로 변환.
 */
export function toClusterableNodes(
    nodes: Array<{
        id: string;
        type: NodeType;
        country: Country;
        coordinates: { latitude: number; longitude: number };
        metadata: { productionCapacity: number; capacityUnit: string };
    }>,
    riskScores: Map<string, number>,
): ClusterableNode[] {
    return nodes.map((node) => ({
        id: node.id,
        type: node.type,
        country: node.country,
        coordinates: node.coordinates,
        productionCapacity: node.metadata.productionCapacity,
        capacityUnit: node.metadata.capacityUnit,
        riskScore: riskScores.get(node.id) ?? 0,
    }));
}
