// Simulation Engine Types (Phase 2)

export type DisruptionType =
    | 'export_restriction'  // 수출 통제
    | 'logistics_disruption' // 물류 마비
    | 'facility_closure'     // 조업 중단
    | 'stockpile_policy'     // 비축 정책
    | 'demand_shock'         // 수요 충격

export interface Disruption {
    targetId: string;
    targetType: 'node' | 'edge';
    disruptionType: DisruptionType;
    severity: number; // 0-1
    country?: string;
    nodeType?: string;
}

export interface DisruptionScenario {
    id: string;
    name: string;
    disruptions: Disruption[];
}

export interface PropagationPath {
    nodes: string[];              // affected node IDs in order
    edges: string[];              // path edge IDs in order
    attenuationFactors: number[]; // impact attenuation per step
}

export interface DeficitResult {
    nodeId: string;
    originalSupply: number;
    disruptedSupply: number;
    deficitPercentage: number; // 0-100
}

export interface SimulationResult {
    scenarioId: string;
    propagationPaths: PropagationPath[];
    deficits: DeficitResult[];
    executionTimeMs: number;
}
