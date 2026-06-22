import type {
    Country,
    SupplyChainNode,
    SupplyChainEdge,
    PropagationPath,
} from '@navigator/shared';
import { computePropagationPath } from './compute-propagation.js';

/** 국가 수준 수출 규제 시뮬레이션 결과 */
export interface CountryRestrictionResult {
    country: Country;
    severity: number;
    affectedEdges: string[]; // 해당 국가에서 출발하는 모든 엣지 ID
    propagationPaths: PropagationPath[]; // 각 타겟 노드에서의 전파 경로
    affectedNodeIds: string[]; // 영향받는 모든 고유 다운스트림 노드 ID
}

/**
 * 국가 수준 수출 규제 시뮬레이션.
 *
 * 주어진 국가에서 출발하는 모든 엣지를 식별하고,
 * 각 타겟 노드에서 다운스트림으로 영향을 전파한다.
 *
 * @param country - 수출 규제 대상 국가
 * @param severity - 규제 강도 (0-1)
 * @param allNodes - 전체 공급망 노드 목록
 * @param allEdges - 전체 공급망 엣지 목록
 * @param options - 감쇄율 및 임계값 옵션
 * @returns 수출 규제 시뮬레이션 결과
 */
export function simulateCountryRestriction(
    country: Country,
    severity: number,
    allNodes: SupplyChainNode[],
    allEdges: SupplyChainEdge[],
    options?: {
        attenuationRate?: number;
        impactThreshold?: number;
    },
): CountryRestrictionResult {
    // 해당 국가에 속하는 노드 식별
    const countryNodeIds = new Set(
        allNodes.filter((n) => n.country === country).map((n) => n.id),
    );

    // 해당 국가 노드에서 출발하는 엣지 식별
    const outboundEdges = allEdges.filter((e) => countryNodeIds.has(e.sourceNodeId));
    const affectedEdges = outboundEdges.map((e) => e.id);

    // 아웃바운드 엣지가 없으면 빈 결과 반환
    if (outboundEdges.length === 0) {
        return {
            country,
            severity,
            affectedEdges: [],
            propagationPaths: [],
            affectedNodeIds: [],
        };
    }

    // 각 타겟 노드에서 다운스트림 전파 경로 계산
    const propagationPaths: PropagationPath[] = [];
    const affectedNodeSet = new Set<string>();

    for (const edge of outboundEdges) {
        const targetNodeId = edge.targetNodeId;

        // 이미 동일한 타겟 노드에서 전파를 시작한 경우 중복 방지
        if (affectedNodeSet.has(targetNodeId)) {
            continue;
        }

        // 엣지 대상 교란으로 전파 경로 계산
        const path = computePropagationPath(
            targetNodeId,
            {
                targetId: edge.id,
                targetType: 'edge',
                disruptionType: 'export_restriction',
                severity,
            },
            allNodes,
            allEdges,
            options,
        );

        // 유효한 전파 경로가 있으면 추가
        if (path.nodes.length > 0) {
            propagationPaths.push(path);
            for (const nodeId of path.nodes) {
                affectedNodeSet.add(nodeId);
            }
        }
    }

    return {
        country,
        severity,
        affectedEdges,
        propagationPaths,
        affectedNodeIds: Array.from(affectedNodeSet),
    };
}
