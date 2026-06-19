// 그래프 데이터 컨트롤러
import type { SupplyChainNode, SupplyChainEdge } from '@navigator/shared';
import type { DataStore } from '@navigator/database';

/**
 * 그래프 데이터 컨트롤러.
 * @navigator/database의 DataStore를 통해 노드와 엣지 데이터를 조회한다.
 */
export class GraphController {
    constructor(private readonly store: DataStore) { }

    /** 모든 노드를 반환한다. */
    getNodes(): SupplyChainNode[] {
        return this.store.getNodes();
    }

    /** 모든 엣지를 반환한다. */
    getEdges(): SupplyChainEdge[] {
        return this.store.getEdges();
    }

    /** 노드와 엣지를 모두 포함한 그래프 데이터를 반환한다. */
    getGraph(): { nodes: SupplyChainNode[]; edges: SupplyChainEdge[] } {
        return {
            nodes: this.store.getNodes(),
            edges: this.store.getEdges(),
        };
    }
}
