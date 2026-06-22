import type {
    SupplyChainNode,
    SupplyChainEdge,
    Disruption,
    PropagationPath,
} from '@navigator/shared';

/** 기본 감쇄율 — 각 단계마다 영향이 30% 감소 */
export const DEFAULT_ATTENUATION_RATE = 0.7;

/** 전파 중단 임계값 — 영향이 이 값 이하로 떨어지면 더 이상 전파하지 않음 */
export const DEFAULT_IMPACT_THRESHOLD = 0.01;

/**
 * BFS 기반 다운스트림 영향 전파 경로 계산.
 *
 * startNodeId에서 시작하여 아웃바운드 엣지를 따라 다운스트림 노드로 전파한다.
 * 각 단계에서 감쇄율을 적용하며, 영향이 임계값 이하로 떨어지거나
 * 더 이상 다운스트림 노드가 없을 때 전파를 중단한다.
 *
 * edge 대상 교란의 경우, 해당 엣지의 targetNodeId에서 BFS를 시작한다.
 */
export function computePropagationPath(
    startNodeId: string,
    disruption: Disruption,
    allNodes: SupplyChainNode[],
    allEdges: SupplyChainEdge[],
    options?: {
        attenuationRate?: number;
        impactThreshold?: number;
    },
): PropagationPath {
    const attenuationRate = options?.attenuationRate ?? DEFAULT_ATTENUATION_RATE;
    const impactThreshold = options?.impactThreshold ?? DEFAULT_IMPACT_THRESHOLD;

    // 결과 저장
    const resultNodes: string[] = [];
    const resultEdges: string[] = [];
    const attenuationFactors: number[] = [];

    // edge 대상 교란의 경우, 엣지의 targetNodeId를 BFS 시작점으로 사용
    let bfsStartNodeId = startNodeId;
    if (disruption.targetType === 'edge') {
        const targetEdge = allEdges.find((e) => e.id === disruption.targetId);
        if (!targetEdge) {
            // 해당 엣지를 찾을 수 없으면 빈 경로 반환
            return { nodes: [], edges: [], attenuationFactors: [] };
        }
        bfsStartNodeId = targetEdge.targetNodeId;
    }

    // 시작 노드 존재 여부 확인
    const startNode = allNodes.find((n) => n.id === bfsStartNodeId);
    if (!startNode) {
        return { nodes: [], edges: [], attenuationFactors: [] };
    }

    // BFS 탐색
    // 방문 기록 — 순환 방지
    const visited = new Set<string>();
    // BFS 큐: [노드 ID, 현재 단계]
    const queue: Array<{ nodeId: string; step: number }> = [];

    // 시작 노드 추가
    visited.add(bfsStartNodeId);
    resultNodes.push(bfsStartNodeId);
    attenuationFactors.push(disruption.severity);
    queue.push({ nodeId: bfsStartNodeId, step: 0 });

    while (queue.length > 0) {
        const { nodeId, step } = queue.shift()!;
        const nextStep = step + 1;
        const nextImpact = disruption.severity * Math.pow(attenuationRate, nextStep);

        // 다음 단계 영향이 임계값 이하면 전파 중단
        if (nextImpact < impactThreshold) {
            continue;
        }

        // 현재 노드에서 나가는 엣지 찾기 (sourceNodeId === 현재 노드)
        const outboundEdges = allEdges.filter((e) => e.sourceNodeId === nodeId);

        for (const edge of outboundEdges) {
            const targetId = edge.targetNodeId;

            // 이미 방문한 노드는 건너뜀 (순환 방지)
            if (visited.has(targetId)) {
                continue;
            }

            // 대상 노드가 그래프에 존재하는지 확인
            const targetNode = allNodes.find((n) => n.id === targetId);
            if (!targetNode) {
                continue;
            }

            visited.add(targetId);
            resultNodes.push(targetId);
            resultEdges.push(edge.id);
            attenuationFactors.push(nextImpact);
            queue.push({ nodeId: targetId, step: nextStep });
        }
    }

    return {
        nodes: resultNodes,
        edges: resultEdges,
        attenuationFactors,
    };
}
