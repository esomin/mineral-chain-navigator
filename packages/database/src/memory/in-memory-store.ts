import type { SupplyChainNode, SupplyChainEdge } from '@navigator/shared';
import type { DataStore, SeedDataResult } from '../types.js';

/**
 * 인메모리 데이터 저장소.
 * Phase 1에서 사용하며, Map 기반으로 빠른 조회를 제공한다.
 * Phase 2에서 PgStore로 교체 가능한 DataStore 인터페이스를 구현한다.
 */
export class InMemoryStore implements DataStore {
    private nodes: Map<string, SupplyChainNode> = new Map();
    private edges: Map<string, SupplyChainEdge> = new Map();

    /** 모든 노드를 반환한다. */
    getNodes(): SupplyChainNode[] {
        return Array.from(this.nodes.values());
    }

    /** 모든 엣지를 반환한다. */
    getEdges(): SupplyChainEdge[] {
        return Array.from(this.edges.values());
    }

    /** ID로 노드를 조회한다. 존재하지 않으면 undefined 반환. */
    getNodeById(id: string): SupplyChainNode | undefined {
        return this.nodes.get(id);
    }

    /** ID로 엣지를 조회한다. 존재하지 않으면 undefined 반환. */
    getEdgeById(id: string): SupplyChainEdge | undefined {
        return this.edges.get(id);
    }

    /** 특정 노드로 들어오는 인바운드 엣지(targetNodeId === nodeId)를 반환한다. */
    getInboundEdges(nodeId: string): SupplyChainEdge[] {
        return Array.from(this.edges.values()).filter(
            (edge) => edge.targetNodeId === nodeId,
        );
    }

    /** 시드 데이터를 로드한다. 기존 데이터를 초기화하고 새로 로드한다. */
    loadSeedData(data: SeedDataResult): void {
        this.nodes.clear();
        this.edges.clear();

        for (const node of data.nodes) {
            this.nodes.set(node.id, node);
        }

        for (const edge of data.edges) {
            this.edges.set(edge.id, edge);
        }
    }
}
