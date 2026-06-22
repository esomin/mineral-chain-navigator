import type {
    SupplyChainNode,
    SupplyChainEdge,
    PropagationPath,
    DeficitResult,
} from '@navigator/shared';

/**
 * 각 다운스트림 노드의 공급 부족 비율을 계산한다.
 *
 * 전파 경로 내 각 노드에 대해:
 * - originalSupply: 해당 노드로 들어오는 모든 인바운드 엣지의 volume 합계
 * - disruptedSupply: originalSupply * (1 - attenuationFactor)
 * - deficitPercentage: attenuationFactor * 100, [0, 100] 범위로 클램핑
 *
 * 소스 노드(index 0)는 severity 기반으로 부족률을 계산한다.
 * 인바운드 엣지가 없는 노드는 originalSupply = 0, deficitPercentage = 0.
 */
export function calculateSupplyDeficit(
    path: PropagationPath,
    allNodes: SupplyChainNode[],
    allEdges: SupplyChainEdge[],
): DeficitResult[] {
    const results: DeficitResult[] = [];

    for (let i = 0; i < path.nodes.length; i++) {
        const nodeId = path.nodes[i];
        const attenuationFactor = path.attenuationFactors[i];

        // 해당 노드로 들어오는 인바운드 엣지의 volume 합계 계산
        const inboundEdges = allEdges.filter((e) => e.targetNodeId === nodeId);
        const originalSupply = inboundEdges.reduce(
            (sum, edge) => sum + (edge.attributes.volume ?? 0),
            0,
        );

        // 인바운드 엣지가 없으면 공급 부족 없음
        if (originalSupply === 0) {
            results.push({
                nodeId,
                originalSupply: 0,
                disruptedSupply: 0,
                deficitPercentage: 0,
            });
            continue;
        }

        // 교란된 공급량 = 원래 공급량 * (1 - 감쇄 계수)
        const disruptedSupply = originalSupply * (1 - attenuationFactor);

        // 부족률 = 감쇄 계수 * 100, [0, 100] 범위로 클램핑
        const deficitPercentage = Math.min(100, Math.max(0, attenuationFactor * 100));

        results.push({
            nodeId,
            originalSupply,
            disruptedSupply,
            deficitPercentage,
        });
    }

    return results;
}
