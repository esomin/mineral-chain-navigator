// JSON Serialization Format Types

export interface SerializedNode {
    id: string;
    type: string;
    name: string;
    country: string;
    coordinates: { lat: number; lng: number };
    metadata: Record<string, unknown>;
    description: string;
    created_at: string;   // ISO 8601
    updated_at: string;   // ISO 8601
}

export interface SerializedEdge {
    id: string;
    type: string;
    source_node_id: string;
    target_node_id: string;
    attributes: Record<string, unknown>;
    description?: string;
    created_at: string;   // ISO 8601
    updated_at: string;   // ISO 8601
}
