/**
 * LOD (Level of Detail) 클러스터링 유틸리티.
 *
 * 줌 레벨에 따라 노드를 집계/클러스터링하여
 * 성능을 최적화하고 시각적 혼잡도를 줄인다.
 *
 * 클러스터링 기준: 국가(country)별 그룹핑
 * - 줌 레벨이 임계값 이하일 때 국가 단위로 클러스터 생성
 * - 클러스터 내 노드 수, 총 생산량, 평균 리스크 점수 등 집계 정보 포함
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

// 줌 레벨 임계값 설정
export const LOD_THRESHOLDS = {
    /** 이 줌 레벨 이하에서는 국가별 클러스터링 적용, 이상이면 모든 노드 개별 표시 */
    CLUSTER_ZOOM: 0.8,
} as const;

/**
 * 줌 레벨에 따른 LOD 클러스터링 수행.
 *
 * - zoomLevel <= CLUSTER_ZOOM: 국가별 클러스터링 (최소 2개 노드)
 * - zoomLevel > CLUSTER_ZOOM: 모든 노드 개별 표시 (클러스터링 없음)
 *
 * 불변식: clusters.totalMemberCount === 원본 노드 수
 */
export function computeLODClusters(
    nodes: ClusterableNode[],
    zoomLevel: number,
): LODResult {
    // 줌 레벨이 임계값 초과이면 클러스터링 없음
    if (zoomLevel > LOD_THRESHOLDS.CLUSTER_ZOOM) {
        return {
            clusters: [],
            visibleNodes: nodes.map((n) => n.id),
            totalMemberCount: nodes.length,
        };
    }

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
            // 클러스터 생성
            const cluster = createCluster(country, group);
            clusters.push(cluster);
        } else {
            // 개별 노드로 표시
            for (const node of group) {
                visibleNodes.push(node.id);
            }
        }
    }

    // 불변식 검증: 전체 멤버 수 보존
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
    // 중심점 계산 (좌표 평균)
    const centroid = {
        latitude: members.reduce((sum, n) => sum + n.coordinates.latitude, 0) / members.length,
        longitude: members.reduce((sum, n) => sum + n.coordinates.longitude, 0) / members.length,
    };

    // 총 생산량 합산
    const totalCapacity = members.reduce((sum, n) => sum + n.productionCapacity, 0);

    // 평균 리스크 점수
    const averageRiskScore =
        members.reduce((sum, n) => sum + n.riskScore, 0) / members.length;

    // 국가 표시명 매핑
    const countryLabels: Record<Country, string> = {
        SouthKorea: '한국',
        Japan: '일본',
        China: '중국',
        Chile: '칠레',
        UnitedStates: '미국',
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
 * Web Worker에 전달하기 위해 직렬화 가능한 단순 객체로 변환한다.
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
