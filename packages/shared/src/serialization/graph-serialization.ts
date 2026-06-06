import type { SupplyChainNode, SupplyChainEdge } from '../types/graph.js';
import type { SerializedNode, SerializedEdge } from '../types/serialization.js';

/**
 * Serializes a SupplyChainNode to JSON-compatible format.
 * Converts camelCase to snake_case and Date to ISO 8601 string.
 */
export function serializeNode(node: SupplyChainNode): SerializedNode {
    return {
        id: node.id,
        type: node.type,
        name: node.name,
        coordinates: {
            lat: node.coordinates.latitude,
            lng: node.coordinates.longitude,
        },
        metadata: { ...node.metadata } as Record<string, unknown>,
        created_at: node.createdAt.toISOString(),
        updated_at: node.updatedAt.toISOString(),
    };
}

/**
 * Deserializes a SerializedNode back into a SupplyChainNode.
 * Converts snake_case to camelCase and ISO 8601 string to Date.
 */
export function deserializeNode(json: SerializedNode): SupplyChainNode {
    return {
        id: json.id,
        type: json.type as SupplyChainNode['type'],
        name: json.name,
        coordinates: {
            latitude: json.coordinates.lat,
            longitude: json.coordinates.lng,
        },
        metadata: { ...json.metadata },
        createdAt: new Date(json.created_at),
        updatedAt: new Date(json.updated_at),
    };
}

/**
 * Serializes a SupplyChainEdge to JSON-compatible format.
 * Converts camelCase to snake_case and Date to ISO 8601 string.
 */
export function serializeEdge(edge: SupplyChainEdge): SerializedEdge {
    return {
        id: edge.id,
        type: edge.type,
        source_node_id: edge.sourceNodeId,
        target_node_id: edge.targetNodeId,
        attributes: { ...edge.attributes } as Record<string, unknown>,
        created_at: edge.createdAt.toISOString(),
        updated_at: edge.updatedAt.toISOString(),
    };
}

/**
 * Deserializes a SerializedEdge back into a SupplyChainEdge.
 * Converts snake_case to camelCase and ISO 8601 string to Date.
 */
export function deserializeEdge(json: SerializedEdge): SupplyChainEdge {
    return {
        id: json.id,
        type: json.type as SupplyChainEdge['type'],
        sourceNodeId: json.source_node_id,
        targetNodeId: json.target_node_id,
        attributes: { ...json.attributes },
        createdAt: new Date(json.created_at),
        updatedAt: new Date(json.updated_at),
    };
}
