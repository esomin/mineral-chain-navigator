import { useEffect, useState, useMemo, useCallback } from 'react';
import { useSupplyChainStore } from '../store/supply-chain-store';
import { MapView } from '../components/views/MapView';
import { FilterBar } from '../components/common/FilterBar';
import { NodeDetailPanel } from '../components/panels/NodeDetailPanel';
import { ViewSwitcher } from '../components/common/ViewSwitcher';
import { RiskScore } from '@navigator/shared/src/types/risk';

/**
 * GIS 지도 뷰 페이지 (Phase 2).
 * Deck.gl 기반 세계 지도에 27개 마스터 노드와 물류 경로를 시각화한다.
 * GraphView와 동일한 Zustand 스토어를 공유하여 상태 동기화를 유지한다.
 */
export function MapViewPage() {
    const { nodes, edges, selectedNodeId, filters, riskScores, setNodes, setEdges, setRiskScores, selectNode, setLoading, isLoading } =
        useSupplyChainStore();

    const [error, setError] = useState<string | null>(null);

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

    // 필터링된 노드 (HS 코드 및 국가 필터 적용)
    const filteredNodes = useMemo(() => {
        const nodeIds = new Set<string>();
        for (const edge of edges) {
            const hsCode = edge.attributes?.hsCode;
            if (!hsCode || filters.hsCode.includes(hsCode) || filters.hsCode.length === 0) {
                nodeIds.add(edge.sourceNodeId);
                nodeIds.add(edge.targetNodeId);
            }
        }
        // hsCode 필터링 조건에 부합하는 nodeIds가 비어있는 경우(예: 시드 엣지에 hsCode 속성이 없을 경우) 전체 노드를 fallback으로 검토
        const matchedNodes = nodeIds.size > 0 ? nodes.filter((node) => nodeIds.has(node.id)) : nodes;
        return matchedNodes.filter((node) => filters.countries.length === 0 || filters.countries.includes(node.country));
    }, [nodes, edges, filters.hsCode, filters.countries]);

    // 필터링된 엣지 (HS 코드 필터 + 양쪽 노드 표시 조건)
    const filteredEdges = useMemo(() => {
        const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));
        return edges.filter((edge) => {
            if (!filteredNodeIds.has(edge.sourceNodeId) || !filteredNodeIds.has(edge.targetNodeId)) {
                return false;
            }
            const hsCode = edge.attributes?.hsCode;
            if (hsCode && filters.hsCode.length > 0 && !filters.hsCode.includes(hsCode)) {
                return false;
            }
            return true;
        });
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
        <div className="w-screen h-screen flex flex-col bg-background text-foreground">
            <header className="px-4 py-3 border-b border-border bg-card flex items-center justify-between">
                <div>
                    <h1 className="m-0 text-xl font-bold text-foreground">Lithium Supply Chain Navigator</h1>
                    <p className="mt-1 mb-0 text-sm text-muted-foreground">
                        리튬(HS 2825.20) 공급망 GIS 지도 시각화 • 노드: {filteredNodes.length}/{nodes.length} | 엣지: {filteredEdges.length}/{edges.length}
                    </p>
                </div>
                {/* 뷰 전환 스위처 */}
                {/* <ViewSwitcher currentView="map" /> */}
            </header>

            {/* 필터 컨트롤 바 */}
            <FilterBar />

            <main className="flex-1 relative overflow-hidden bg-background">
                {/* 로딩 상태 */}
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-10 text-muted-foreground">
                        <p>지도 데이터 로딩 중...</p>
                    </div>
                )}

                {/* 에러 상태 */}
                {error && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 px-6 py-3 bg-destructive/10 border border-destructive rounded-lg z-10">
                        <span className="text-destructive font-medium">⚠ {error}</span>
                    </div>
                )}

                {/* 지도 렌더러 */}
                {filteredNodes.length > 0 && (
                    <MapView
                        nodes={filteredNodes}
                        edges={filteredEdges}
                        riskScores={riskScoreMap}
                        onNodeClick={handleNodeClick}
                    />
                )}

                {/* 필터 결과 없음 */}
                {!isLoading && nodes.length > 0 && filteredNodes.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <p className="text-muted-foreground text-sm">
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
