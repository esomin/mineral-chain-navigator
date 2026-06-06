// Supply Chain Graph Data Model Types

export type NodeType = 'Resource' | 'Mine' | 'Refinery' | 'Gigafactory' | 'Country' | 'Policy';

export type EdgeType = 'Supply' | 'Delivery' | 'Export_Restriction' | 'Ownership';

export interface GeoCoordinates {
    latitude: number;   // -90 ~ 90
    longitude: number;  // -180 ~ 180
}

export interface OwnershipInfo {
    entity: string;
    share: number; // 0-1
}

export interface NodeMetadata {
    productionCapacity?: number;
    annualOutput?: number;
    ownershipStructure?: OwnershipInfo[];
    esgComplianceStatus?: 'verified' | 'unverified' | 'non_compliant';
    [key: string]: unknown;
}

export interface EdgeAttributes {
    volume?: number;
    price?: number;
    hsCode?: string;
    regulatoryBody?: string;
    [key: string]: unknown;
}

export interface SupplyChainNode {
    id: string;
    type: NodeType;
    name: string;
    coordinates: GeoCoordinates;
    metadata: NodeMetadata;
    createdAt: Date;
    updatedAt: Date;
}

export interface SupplyChainEdge {
    id: string;
    type: EdgeType;
    sourceNodeId: string;
    targetNodeId: string;
    attributes: EdgeAttributes;
    createdAt: Date;
    updatedAt: Date;
}

// Input types for creation
export interface CreateNodeInput {
    id: string;
    type: string;
    name: string;
    coordinates: GeoCoordinates;
    metadata?: NodeMetadata;
}

export interface CreateEdgeInput {
    id: string;
    type: string;
    sourceNodeId: string;
    targetNodeId: string;
    attributes?: EdgeAttributes;
}

// Validation result
export interface ValidationResult {
    valid: boolean;
    errors: string[];
}
