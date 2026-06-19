import type { SupplyChainNode, SupplyChainEdge } from '@navigator/shared';

/**
 * 시드 데이터 로딩 결과를 담는 인터페이스.
 */
export interface SeedDataResult {
    nodes: SupplyChainNode[];
    edges: SupplyChainEdge[];
    errors: string[];
}

/**
 * 파이프라인 출력 데이터 형식.
 * pipeline 패키지에서 정규화된 데이터를 전달받는 인터페이스.
 */
export interface PipelineOutput {
    nodes: SupplyChainNode[];
    edges: SupplyChainEdge[];
}

/**
 * 데이터 저장소 추상 인터페이스.
 * InMemoryStore와 향후 PgStore 모두 이 인터페이스를 구현한다.
 */
export interface DataStore {
    /** 모든 노드를 반환한다. */
    getNodes(): SupplyChainNode[];
    /** 모든 엣지를 반환한다. */
    getEdges(): SupplyChainEdge[];
    /** ID로 노드를 조회한다. */
    getNodeById(id: string): SupplyChainNode | undefined;
    /** ID로 엣지를 조회한다. */
    getEdgeById(id: string): SupplyChainEdge | undefined;
    /** 특정 노드로 들어오는 인바운드 엣지를 반환한다. */
    getInboundEdges(nodeId: string): SupplyChainEdge[];
    /** 시드 데이터를 로드한다. */
    loadSeedData(data: SeedDataResult): void;
}
