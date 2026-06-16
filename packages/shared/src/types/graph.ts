// Supply Chain Graph Data Model Types
// 2025 기준 리튬(HS 2825.20) 공급망, 5개국 14개 마스터 노드

export type NodeType = 'Resource' | 'Mine' | 'Refinery' | 'Factory';

export type EdgeType = 'Supply' | 'Delivery';

export type Country = 'SouthKorea' | 'Japan' | 'China' | 'Chile' | 'UnitedStates' | 'NA';

export interface GeoCoordinates {
    latitude: number;   // -90 ~ 90
    longitude: number;  // -180 ~ 180
}

export interface NodeMetadata {
    productionCapacity: number;
    capacityUnit: 'tons_lce' | 'tons' | 'gwh' | 'tons_cathode';
    annualOutput?: number;
    owner?: string;
    hsCode?: string;               // HS 2825.20
    [key: string]: unknown;
}

export interface EdgeAttributes {
    volume?: number;          // 물량 (kg 또는 톤)
    price?: number;           // 금액 (USD)
    unitPrice?: number;       // 단가 (USD/kg)
    priceType?: 'fob' | 'cif'; // 가격 기준 (FOB: 수출국 보고, CIF: 수입국 보고)
    hsCode?: string;          // HS 282520
    year?: number;            // 데이터 기준 연도
    iraCompliant?: boolean;   // IRA 준수 여부
    [key: string]: unknown;
}

export interface SupplyChainNode {
    id: string;
    type: NodeType;
    name: string;
    country: Country;
    coordinates: GeoCoordinates;
    metadata: NodeMetadata;
    description: string;
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
    country: string;
    coordinates: GeoCoordinates;
    metadata: {
        productionCapacity: number;
        capacityUnit: string;
        [key: string]: unknown;
    };
    description?: string;
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
