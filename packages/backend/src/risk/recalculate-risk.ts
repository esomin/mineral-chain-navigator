import type {
    RiskScore,
    SupplyChainNode,
    SupplyChainEdge,
    Country,
} from '@mineral-chain/shared';
import { computeNodeHHI, computeNodeRisk, computeEdgeRisk } from './compute-risk.js';

/**
 * 변경된 노드 ID를 기반으로 영향받는 엔티티(노드 + 엣지) ID를 결정한다.
 *
 * - 변경된 노드 자체
 * - 변경된 노드와 엣지로 연결된 이웃 노드 (upstream/downstream)
 * - source 또는 target이 변경된 노드인 엣지
 */
export function getAffectedEntityIds(
    changedNodeIds: string[],
    allEdges: SupplyChainEdge[],
): { nodeIds: Set<string>; edgeIds: Set<string> } {
    const nodeIds = new Set<string>(changedNodeIds);
    const edgeIds = new Set<string>();

    for (const edge of allEdges) {
        if (changedNodeIds.includes(edge.sourceNodeId) || changedNodeIds.includes(edge.targetNodeId)) {
            edgeIds.add(edge.id);
            nodeIds.add(edge.sourceNodeId);
            nodeIds.add(edge.targetNodeId);
        }
    }

    return { nodeIds, edgeIds };
}

/**
 * 변경된 노드들에 대해 영향받는 엔티티의 리스크를 재계산한다.
 *
 * 1. 영향받는 노드/엣지 식별
 * 2. 각 영향받는 노드: HHI 재계산 + WGI 조회 → 노드 리스크 계산
 * 3. 각 영향받는 엣지: tradeDependency + regulatoryRisk → 엣지 리스크 계산
 */
export function recalculateAffected(
    changedNodeIds: string[],
    allNodes: SupplyChainNode[],
    allEdges: SupplyChainEdge[],
    wgiScores: Map<Country, number>,
): RiskScore[] {
    if (changedNodeIds.length === 0) return [];

    const { nodeIds, edgeIds } = getAffectedEntityIds(changedNodeIds, allEdges);
    const results: RiskScore[] = [];

    // 노드 리스크 재계산
    for (const nodeId of nodeIds) {
        const node = allNodes.find((n) => n.id === nodeId);
        if (!node) continue;

        const inboundEdges = allEdges.filter((e) => e.targetNodeId === nodeId);
        const hhi = computeNodeHHI(nodeId, inboundEdges);
        const wgi = wgiScores.get(node.country) ?? 50;

        const riskScore = computeNodeRisk(node, { hhi, wgi });
        results.push(riskScore);
    }

    // 엣지 리스크 재계산
    for (const edgeId of edgeIds) {
        const edge = allEdges.find((e) => e.id === edgeId);
        if (!edge) continue;

        const tradeDependency = computeTradeDependency(edge, allEdges);
        const regulatoryRisk = computeRegulatoryRisk(edge);

        const riskScore = computeEdgeRisk(edge, { tradeDependency, regulatoryRisk });
        results.push(riskScore);
    }

    return results;
}

/**
 * 엣지의 무역 의존도 계산.
 * edge volume / target 노드로의 총 인바운드 volume (0-1 비율)
 */
function computeTradeDependency(edge: SupplyChainEdge, allEdges: SupplyChainEdge[]): number {
    const edgeVolume = edge.attributes.volume ?? 0;
    if (edgeVolume === 0) return 0;

    const totalInboundVolume = allEdges
        .filter((e) => e.targetNodeId === edge.targetNodeId && (e.attributes.volume ?? 0) > 0)
        .reduce((sum, e) => sum + (e.attributes.volume ?? 0), 0);

    if (totalInboundVolume === 0) return 0;

    return edgeVolume / totalInboundVolume;
}

/**
 * 엣지의 규제 리스크 계산.
 * iraCompliant === false → 80
 * iraCompliant === true → 10
 * otherwise → 40
 */
function computeRegulatoryRisk(edge: SupplyChainEdge): number {
    const { iraCompliant } = edge.attributes;
    if (iraCompliant === false) return 80;
    if (iraCompliant === true) return 10;
    return 40;
}
