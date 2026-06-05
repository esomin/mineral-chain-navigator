// Simulation Engine Types (Phase 2)

export type DisruptionType = 'export_restriction' | 'facility_closure' | 'strike' | 'natural_disaster';

export interface Disruption {
    targetId: string;
    targetType: 'node' | 'edge';
    disruptionType: DisruptionType;
    severity: number; // 0-1
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
