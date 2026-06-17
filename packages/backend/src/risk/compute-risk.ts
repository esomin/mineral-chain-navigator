import type {
    RiskScore,
    RiskFactor,
    SupplyChainNode,
    SupplyChainEdge,
} from '@mineral-chain/shared';

/**
 * 노드별 공급원 집중도 HHI 동적 계산.
 * 인바운드 엣지 volume 비중으로 산출: HHI = Σ (volume_i / total × 100)²
 * 인바운드 없으면 0 반환.
 */
export function computeNodeHHI(nodeId: string, inboundEdges: SupplyChainEdge[]): number {
    const edgesWithVolume = inboundEdges.filter(
        (e) => e.targetNodeId === nodeId && e.attributes.volume != null && e.attributes.volume > 0,
    );

    if (edgesWithVolume.length === 0) return 0;

    const totalVolume = edgesWithVolume.reduce((sum, e) => sum + (e.attributes.volume ?? 0), 0);
    if (totalVolume === 0) return 0;

    const hhi = edgesWithVolume.reduce((sum, e) => {
        const sharePercent = ((e.attributes.volume ?? 0) / totalVolume) * 100;
        return sum + sharePercent * sharePercent;
    }, 0);

    return Math.round(hhi);
}

/** HHI 정규화. 0~10,000 → 0~100 리스크 */
export function normalizeHHI(hhi: number): number {
    const clamped = Math.max(0, Math.min(10000, hhi));
    return (clamped / 10000) * 100;
}

/** WGI 정규화. 0~100 거버넌스 점수 → 0~100 리스크 (반전) */
export function normalizeWGI(wgi: number): number {
    const clamped = Math.max(0, Math.min(100, wgi));
    return 100 - clamped;
}

/** HHI 팩터 기본 가중치 */
export const DEFAULT_HHI_WEIGHT = 0.6;

/** WGI 팩터 기본 가중치 */
export const DEFAULT_WGI_WEIGHT = 0.4;

/** 무역량 의존도 팩터 기본 가중치 */
export const DEFAULT_TRADE_VOLUME_WEIGHT = 0.5;

/** 규제 리스크 팩터 기본 가중치 */
export const DEFAULT_REGULATORY_WEIGHT = 0.5;

export interface NodeRiskFactors {
    hhi: number;  // 0-10000 (표준 HHI)
    wgi: number;  // 0-100 (WGI 종합 점수; 높을수록 안정적)
}

export interface EdgeRiskFactors {
    tradeDependency: number;  // 0-1 (전체 공급 중 비중)
    regulatoryRisk: number;   // 0-100 (IRA 미준수 등)
}

/** 노드 리스크 점수 계산 (HHI + WGI) */
export function computeNodeRisk(
    node: SupplyChainNode,
    factors: NodeRiskFactors,
): RiskScore {
    const normalizedHHI = normalizeHHI(factors.hhi);
    const normalizedWGI = normalizeWGI(factors.wgi);

    const hhiFactor: RiskFactor = {
        category: 'supply_concentration',
        weight: DEFAULT_HHI_WEIGHT,
        rawValue: factors.hhi,
        normalizedValue: normalizedHHI,
    };

    const wgiFactor: RiskFactor = {
        category: 'geopolitical',
        weight: DEFAULT_WGI_WEIGHT,
        rawValue: factors.wgi,
        normalizedValue: normalizedWGI,
    };

    const score =
        hhiFactor.weight * normalizedHHI +
        wgiFactor.weight * normalizedWGI;

    return {
        entityId: node.id,
        entityType: 'node',
        score,
        factors: [hhiFactor, wgiFactor],
        isHighRisk: false,
        computedAt: new Date(),
    };
}

/** 엣지 리스크 점수 계산 (무역 의존도 + 규제 리스크) */
export function computeEdgeRisk(
    edge: SupplyChainEdge,
    factors: EdgeRiskFactors,
): RiskScore {
    const normalizedTradeDependency = Math.max(0, Math.min(1, factors.tradeDependency)) * 100;
    const normalizedRegulatoryRisk = Math.max(0, Math.min(100, factors.regulatoryRisk));

    const tradeVolumeFactor: RiskFactor = {
        category: 'trade_volume',
        weight: DEFAULT_TRADE_VOLUME_WEIGHT,
        rawValue: factors.tradeDependency,
        normalizedValue: normalizedTradeDependency,
    };

    const regulatoryFactor: RiskFactor = {
        category: 'regulatory',
        weight: DEFAULT_REGULATORY_WEIGHT,
        rawValue: factors.regulatoryRisk,
        normalizedValue: normalizedRegulatoryRisk,
    };

    const score =
        tradeVolumeFactor.weight * normalizedTradeDependency +
        regulatoryFactor.weight * normalizedRegulatoryRisk;

    return {
        entityId: edge.id,
        entityType: 'edge',
        score,
        factors: [tradeVolumeFactor, regulatoryFactor],
        isHighRisk: false,
        computedAt: new Date(),
    };
}
