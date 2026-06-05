// Risk Analysis Types

export type RiskFactorCategory =
    | 'geopolitical'
    | 'supply_concentration'
    | 'production_dependency'
    | 'trade_volume'
    | 'route_vulnerability'
    | 'regulatory';

export interface RiskFactor {
    category: RiskFactorCategory;
    weight: number;           // 0-1
    rawValue: number;
    normalizedValue: number;  // 0-100
}

export interface RiskScore {
    entityId: string;
    entityType: 'node' | 'edge';
    score: number;            // 0-100 normalized
    factors: RiskFactor[];
    isHighRisk: boolean;
    computedAt: Date;
}
