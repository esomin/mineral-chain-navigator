// 리스크 분석 컨트롤러
import type { RiskScore, Country } from '@navigator/shared';
import {
    computeNodeHHI,
    computeNodeRisk,
    computeEdgeRisk,
    flagHighRisk,
} from '@navigator/core';
import type { DataStore } from '@navigator/database';

/** 기본 WGI 점수 매핑 (높을수록 안정적, 0-100) */
const DEFAULT_WGI_SCORES: Map<Country, number> = new Map([
    ['SouthKorea', 75],
    ['Japan', 80],
    ['China', 45],
    ['Chile', 65],
    ['UnitedStates', 78],
    ['NA', 50],
]);

/** 고위험 임계값 */
const HIGH_RISK_THRESHOLD = 60;

/**
 * 리스크 계산 컨트롤러.
 * @navigator/core의 비즈니스 로직과 @navigator/database의 데이터를 조합하여
 * 리스크 점수를 계산한다.
 */
export class RiskController {
    constructor(private readonly store: DataStore) { }

    /**
     * 특정 노드의 리스크 점수를 계산하여 반환한다.
     * @param nodeId 노드 ID
     * @returns 계산된 RiskScore 또는 null (노드 미존재 시)
     */
    getNodeRisk(nodeId: string): RiskScore | null {
        const node = this.store.getNodeById(nodeId);
        if (!node) return null;

        const inboundEdges = this.store.getInboundEdges(nodeId);
        const hhi = computeNodeHHI(nodeId, inboundEdges);
        const wgi = DEFAULT_WGI_SCORES.get(node.country) ?? 50;

        const riskScore = computeNodeRisk(node, { hhi, wgi });
        const [flagged] = flagHighRisk([riskScore], HIGH_RISK_THRESHOLD);
        return flagged;
    }

    /**
     * 특정 엣지의 리스크 점수를 계산하여 반환한다.
     * @param edgeId 엣지 ID
     * @returns 계산된 RiskScore 또는 null (엣지 미존재 시)
     */
    getEdgeRisk(edgeId: string): RiskScore | null {
        const edge = this.store.getEdgeById(edgeId);
        if (!edge) return null;

        const allEdges = this.store.getEdges();
        const tradeDependency = this.computeTradeDependency(edge, allEdges);
        const regulatoryRisk = this.computeRegulatoryRisk(edge);

        const riskScore = computeEdgeRisk(edge, { tradeDependency, regulatoryRisk });
        const [flagged] = flagHighRisk([riskScore], HIGH_RISK_THRESHOLD);
        return flagged;
    }

    /**
     * 모든 노드와 엣지의 리스크 점수를 재계산한다.
     * @returns 전체 재계산된 RiskScore 배열
     */
    recalculateAll(): RiskScore[] {
        const nodes = this.store.getNodes();
        const allEdges = this.store.getEdges();
        const results: RiskScore[] = [];

        // 모든 노드 리스크 재계산
        for (const node of nodes) {
            const inboundEdges = this.store.getInboundEdges(node.id);
            const hhi = computeNodeHHI(node.id, inboundEdges);
            const wgi = DEFAULT_WGI_SCORES.get(node.country) ?? 50;
            results.push(computeNodeRisk(node, { hhi, wgi }));
        }

        // 모든 엣지 리스크 재계산
        for (const edge of allEdges) {
            const tradeDependency = this.computeTradeDependency(edge, allEdges);
            const regulatoryRisk = this.computeRegulatoryRisk(edge);
            results.push(computeEdgeRisk(edge, { tradeDependency, regulatoryRisk }));
        }

        return flagHighRisk(results, HIGH_RISK_THRESHOLD);
    }

    /** 엣지의 무역 의존도 계산 (0-1) */
    private computeTradeDependency(
        edge: { targetNodeId: string; attributes: { volume?: number } },
        allEdges: { targetNodeId: string; attributes: { volume?: number } }[],
    ): number {
        const edgeVolume = edge.attributes.volume ?? 0;
        if (edgeVolume === 0) return 0;

        const totalInboundVolume = allEdges
            .filter((e) => e.targetNodeId === edge.targetNodeId && (e.attributes.volume ?? 0) > 0)
            .reduce((sum, e) => sum + (e.attributes.volume ?? 0), 0);

        if (totalInboundVolume === 0) return 0;
        return edgeVolume / totalInboundVolume;
    }

    /** 엣지의 규제 리스크 계산 */
    private computeRegulatoryRisk(edge: { attributes: { iraCompliant?: boolean } }): number {
        const { iraCompliant } = edge.attributes;
        if (iraCompliant === false) return 80;
        if (iraCompliant === true) return 10;
        return 40;
    }
}
