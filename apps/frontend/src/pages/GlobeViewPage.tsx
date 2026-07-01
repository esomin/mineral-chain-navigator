import { useEffect, useState, useMemo, useCallback } from 'react';
import { useSupplyChainStore } from '../store/supply-chain-store';
import { GlobeView, type ArcWeightMode } from '../components/GlobeView';
import { FilterBar } from '../components/FilterBar';
import { NodeDetailPanel } from '../components/NodeDetailPanel';
import { ViewSwitcher } from '../components/ViewSwitcher';
import type { RiskScore } from '@navigator/shared/src/types/risk';

/**
 * 3D 지구본 뷰 페이지 (Phase 2).
 * Globe.gl 기반 3D 지구본에 리튬 공급망 경로를 아크로 시각화한다.
 * 거래량/거래가격 모드 토글을 제공하여 아크 가중치를 시각화한다.
 * Requirements 10.1, 10.2, 10.3, 10.4 구현.
 */
export function GlobeViewPage() {
    const { nodes, edges, selectedNodeId, filters, riskScores, setNodes, setEdges, setRiskScores, selectNode, setLoading, isLoading } =
        useSupplyChainStore();

    const [error, setError] = useState<string | null>(null);
    // 아크 가중치 모드: volume(무역량 비례) 또는 price(거래금액 비례)
    const [arcWeightMode, setArcWeightMode] = useState<ArcWeightMode>('volume');

    // 백엔드 API에서 그래프 데이터 로딩
    useEffect(() => {
        // 이미 데이터가 로드되어 있으면 건너뛰기 (뷰 전환 시 재요청 방지)
        if (nodes.length > 0) return;

        const fetchGraphData = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch('/api/graph');
                if (!response.ok) throw new Error(`API 에러: ${response.status}`);
                const data = await response.json();

                // Date 문자열을 Date 객체로 변환
                const parsedNodes = (data.nodes || []).map((n: Record<string, unknown>) => ({
                    ...n,
                    createdAt: new Date(n.createdAt as string),
                    updatedAt: new Date(n.updatedAt as string),
                }));
                const parsedEdges = (data.edges || []).map((e: Record<string, unknown>) => ({
                    ...e,
                    createdAt: new Date(e.createdAt as string),
                    updatedAt: new Date(e.updatedAt as string),
                }));

                setNodes(parsedNodes);
                setEdges(parsedEdges);
            } catch (err) {
                setError(err instanceof Error ? err.message : '데이터 로딩 실패');
            } finally {
                setLoading(false);
            }
        };

        fetchGraphData();
    }, [nodes.length, setNodes, setEdges, setLoading]);

    // 리스크 점수 로딩
    useEffect(() => {
        if (nodes.length === 0) return;

        const fetchRiskScores = async () => {
            try {
                const response = await fetch('/api/risk/recalculate', { method: 'POST' });
                if (!response.ok) return;
                const scores: RiskScore[] = await response.json();
                setRiskScores(scores);
            } catch {
                console.warn('리스크 점수 로딩 실패 - 기본값 사용');
            }
        };

        fetchRiskScores();
    }, [nodes]);

    // 리스크 점수를 nodeId → score Map으로 변환
    const riskScoreMap = useMemo(() => {
        const map = new Map<string, number>();
        riskScores
            .filter((rs) => rs.entityType === 'node')
            .forEach((rs) => map.set(rs.entityId, rs.score));
        return map;
    }, [riskScores]);

    // 필터링된 노드 (HS 코드 필터 적용)
    const filteredNodes = useMemo(() => {
        if (filters.hsCode === 'all') return nodes;
        const nodeIds = new Set<string>();
        for (const edge of edges) {
            if (edge.attributes.hsCode === filters.hsCode) {
                nodeIds.add(edge.sourceNodeId);
                nodeIds.add(edge.targetNodeId);
            }
        }
        return nodes.filter((node) => nodeIds.has(node.id));
    }, [nodes, edges, filters.hsCode]);

    // 필터링된 엣지 (HS 코드 필터 + 양쪽 노드 표시 조건)
    const filteredEdges = useMemo(() => {
        const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));
        return edges.filter(
            (edge) =>
                filteredNodeIds.has(edge.sourceNodeId) &&
                filteredNodeIds.has(edge.targetNodeId) &&
                (filters.hsCode === 'all' || edge.attributes.hsCode === filters.hsCode),
        );
    }, [edges, filteredNodes, filters.hsCode]);

    // 노드 클릭 핸들러
    const handleNodeClick = useCallback(
        (nodeId: string) => {
            selectNode(nodeId === selectedNodeId ? null : nodeId);
        },
        [selectNode, selectedNodeId],
    );

    // 패널 닫기 핸들러
    const handleClosePanel = useCallback(() => {
        selectNode(null);
    }, [selectNode]);

    // 선택된 노드 정보
    const selectedNode = useMemo(
        () => nodes.find((n) => n.id === selectedNodeId),
        [nodes, selectedNodeId],
    );

    // 선택된 노드에 연결된 엣지
    const connectedEdges = useMemo(
        () =>
            selectedNodeId
                ? edges.filter(
                    (e) =>
                        e.sourceNodeId === selectedNodeId ||
                        e.targetNodeId === selectedNodeId,
                )
                : [],
        [edges, selectedNodeId],
    );

    return (
        <div className="w-screen h-screen flex flex-col">
            <header className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                <div>
                    <h1 className="m-0 text-xl">Mineral Chain Navigator</h1>
                    <p className="mt-1 mb-0 text-sm text-gray-500">
                        리튬(HS 2825.20) 공급망 3D 지구본 시각화 • 노드: {filteredNodes.length}/{nodes.length} | 엣지: {filteredEdges.length}/{edges.length}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {/* 아크 가중치 모드 토글 (Requirement 10.4) */}
                    <div className="flex items-center gap-1" role="radiogroup" aria-label="아크 가중치 모드">
                        <button
                            onClick={() => setArcWeightMode('volume')}
                            role="radio"
                            aria-checked={arcWeightMode === 'volume'}
                            className={`px-3 py-1.5 text-xs outline-none border border-gray-300 rounded-l ${arcWeightMode === 'volume'
                                ? 'bg-green-500 !text-white font-bold !border-green-500 cursor-default'
                                : 'bg-white text-gray-700 cursor-pointer hover:bg-gray-100'
                                }`}
                        >
                            거래량
                        </button>
                        <button
                            onClick={() => setArcWeightMode('price')}
                            role="radio"
                            aria-checked={arcWeightMode === 'price'}
                            className={`px-3 py-1.5 text-xs outline-none border border-gray-300 border-l-0 rounded-r ${arcWeightMode === 'price'
                                ? 'bg-green-500 !text-white font-bold !border-green-500 cursor-default'
                                : 'bg-white text-gray-700 cursor-pointer hover:bg-gray-100'
                                }`}
                        >
                            거래금액
                        </button>
                    </div>
                    {/* 뷰 전환 스위처 */}
                    <ViewSwitcher currentView="globe" />
                </div>
            </header>

            {/* 필터 컨트롤 바 */}
            <FilterBar />

            <main className="flex-1 relative overflow-hidden">
                {/* 로딩 상태 */}
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                        <p>지구본 데이터 로딩 중...</p>
                    </div>
                )}

                {/* 에러 상태 */}
                {error && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 px-6 py-3 bg-red-50 border border-red-200 rounded z-10">
                        <span className="text-red-700">⚠ {error}</span>
                    </div>
                )}

                {/* 3D 지구본 렌더러 */}
                {filteredNodes.length > 0 && (
                    <GlobeView
                        nodes={filteredNodes}
                        edges={filteredEdges}
                        riskScores={riskScoreMap}
                        arcWeightMode={arcWeightMode}
                        onNodeClick={handleNodeClick}
                    />
                )}

                {/* 필터 결과 없음 */}
                {!isLoading && nodes.length > 0 && filteredNodes.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <p className="text-gray-400 text-sm">
                            필터 조건에 맞는 노드가 없습니다.
                        </p>
                    </div>
                )}

                {/* 노드 상세 패널 */}
                {selectedNode && (
                    <NodeDetailPanel
                        node={selectedNode}
                        connectedEdges={connectedEdges}
                        riskScore={riskScoreMap.get(selectedNode.id)}
                        onClose={handleClosePanel}
                    />
                )}
            </main>
        </div>
    );
}
