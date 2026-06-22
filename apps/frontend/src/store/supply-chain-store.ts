import { create } from 'zustand';
import type { SupplyChainNode, SupplyChainEdge, NodeType, Country, RiskScore } from '@navigator/shared';

// 그래프 필터 상태
export interface GraphFilters {
    nodeTypes: NodeType[];
    countries: Country[];
    riskLevel: 'all' | 'low' | 'medium' | 'high';
}

// 공급망 그래프 전역 상태
export interface SupplyChainState {
    // 그래프 데이터
    nodes: SupplyChainNode[];
    edges: SupplyChainEdge[];

    // 리스크 점수 (뷰 전환 시 상태 보존을 위해 전역 관리)
    riskScores: RiskScore[];

    // UI 상태
    selectedNodeId: string | null;
    filters: GraphFilters;
    isLoading: boolean;
    zoomLevel: number;

    // 액션
    setNodes: (nodes: SupplyChainNode[]) => void;
    setEdges: (edges: SupplyChainEdge[]) => void;
    setRiskScores: (riskScores: RiskScore[]) => void;
    selectNode: (nodeId: string | null) => void;
    setFilters: (filters: Partial<GraphFilters>) => void;
    setLoading: (isLoading: boolean) => void;
    setZoomLevel: (zoomLevel: number) => void;
    reset: () => void;
}

// 초기 필터 상태
const initialFilters: GraphFilters = {
    nodeTypes: [],
    countries: [],
    riskLevel: 'all',
};

// Zustand 스토어 생성 - 공급망 그래프 상태 관리
export const useSupplyChainStore = create<SupplyChainState>((set) => ({
    // 초기 상태
    nodes: [],
    edges: [],
    riskScores: [],
    selectedNodeId: null,
    filters: initialFilters,
    isLoading: false,
    zoomLevel: 1.0,

    // 노드 데이터 설정
    setNodes: (nodes) => set({ nodes }),

    // 엣지 데이터 설정
    setEdges: (edges) => set({ edges }),

    // 리스크 점수 설정 (뷰 전환 시에도 유지됨)
    setRiskScores: (riskScores) => set({ riskScores }),

    // 노드 선택/해제
    selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

    // 필터 업데이트 (부분 업데이트 지원)
    setFilters: (newFilters) =>
        set((state) => ({
            filters: { ...state.filters, ...newFilters },
        })),

    // 로딩 상태 설정
    setLoading: (isLoading) => set({ isLoading }),

    // 줌 레벨 설정
    setZoomLevel: (zoomLevel) => set({ zoomLevel }),

    // 상태 초기화
    reset: () =>
        set({
            nodes: [],
            edges: [],
            riskScores: [],
            selectedNodeId: null,
            filters: initialFilters,
            isLoading: false,
            zoomLevel: 1.0,
        }),
}));
